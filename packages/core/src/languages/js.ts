/**
 * JavaScript / TypeScript / JSX / TSX adapter (Babel parser, no type information needed).
 */
import { parse, type ParserPlugin } from "@babel/parser";
import { buildTextNodes, decodeEscapes, hasRtl, ISOLATED, isNumericName, PH_NUMERIC, PH_UNKNOWN, type Decoded } from "../bidi/message.js";
import { decodeEntities } from "./entities.js";
import type {
  Attribute,
  AttrValue,
  ChildInfo,
  ClassListNode,
  ClassToken,
  ElementNode,
  StyleObjectNode,
  StyleProp,
  TextNode,
} from "../types.js";
import type { Emitter } from "./emitter.js";

// Babel AST nodes are handled structurally to keep this file free of heavy typings.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

/** Functions whose string arguments are class lists. */
const CLASS_HELPERS = new Set([
  "cn", "clsx", "classnames", "classNames", "cx", "twMerge", "twJoin", "cva", "tv", "ctl", "clx", "classes", "tw",
]);
/** Helpers whose *object values* are class lists (variants), rather than object keys. */
const VARIANT_HELPERS = new Set(["cva", "tv"]);

const SKIP_KEYS = new Set([
  "type", "start", "end", "loc", "range", "extra", "leadingComments", "trailingComments", "innerComments", "comments", "tokens", "errors",
]);

/** Inline HTML elements whose text belongs to the parent's paragraph. */
const INLINE_ELEMENTS = new Set([
  "a", "abbr", "b", "cite", "code", "data", "dfn", "em", "i", "kbd", "label", "mark", "q", "s", "samp", "small", "span", "strong", "sub", "sup", "time", "u", "var", "del", "ins",
]);

function pluginsFor(filePath: string): ParserPlugin[][] {
  if (/\.[mc]?ts$/.test(filePath)) return [["typescript"], ["typescript", "jsx"]];
  if (/\.tsx$/.test(filePath)) return [["typescript", "jsx"]];
  return [["jsx"], ["jsx", "flow"], ["typescript", "jsx"]];
}

export function parseJs(text: string, filePath: string): N {
  let lastError: unknown;
  for (const plugins of pluginsFor(filePath)) {
    for (const sourceType of ["module", "script"] as const) {
      try {
        return parse(text, {
          sourceType,
          plugins: [...plugins, "decorators"] as ParserPlugin[],
          errorRecovery: true,
          allowReturnOutsideFunction: true,
          allowAwaitOutsideFunction: true,
          allowImportExportEverywhere: true,
        } as Parameters<typeof parse>[1]);
      } catch (e) {
        lastError = e;
      }
    }
  }
  throw lastError;
}

interface ImportInfo {
  source: string;
  imported: string; // "*" for namespace, "default" for default imports
}

interface WalkState {
  elements: ElementNode[];
  tests: string[];
}

export interface JsAdapterOptions {
  /** Strings in this file are translations (e.g. locales/ar.ts). */
  translationFile: boolean;
  rtlLocale: boolean;
}

export function walkJs(text: string, filePath: string, emit: Emitter, opts: JsAdapterOptions): void {
  const ast = parseJs(text, filePath);
  const src = (n: N) => text.slice(n.start, n.end);
  const imports = new Map<string, ImportInfo>();
  for (const stmt of ast.program.body) {
    if (stmt.type !== "ImportDeclaration") continue;
    for (const spec of stmt.specifiers ?? []) {
      const imported =
        spec.type === "ImportNamespaceSpecifier" ? "*" : spec.type === "ImportDefaultSpecifier" ? "default" : spec.imported?.name ?? spec.imported?.value;
      imports.set(spec.local.name, { source: stmt.source.value, imported });
    }
  }

  const handled = new WeakSet<object>();
  const inlined = new WeakSet<object>();
  const wantText = hasRtl(text);

  // ------------------------------------------------------------------ class lists ------
  function collectClassStrings(node: N, out: { tokens: ClassToken[]; complete: boolean }, valuesMode: boolean): void {
    if (!node) return;
    switch (node.type) {
      case "StringLiteral":
        pushTokens(node.value, node.start + 1, node, out);
        return;
      case "TemplateLiteral": {
        if (node.expressions.length) out.complete = false;
        const group = ++groupCounter;
        for (const q of node.quasis) {
          const raw = q.value.raw as string;
          const tokens = splitTokens(raw, q.start);
          // tokens glued to ${…} are partial class names: drop them.
          for (const t of tokens) {
            const touchesStart = t.range[0] === q.start && q !== node.quasis[0];
            const touchesEnd = t.range[1] === q.end && q !== node.quasis[node.quasis.length - 1];
            if (!touchesStart && !touchesEnd) out.tokens.push({ ...t, group });
          }
        }
        return;
      }
      case "ConditionalExpression":
        out.complete = false;
        collectClassStrings(node.consequent, out, valuesMode);
        collectClassStrings(node.alternate, out, valuesMode);
        return;
      case "LogicalExpression":
        out.complete = false;
        collectClassStrings(node.right, out, valuesMode);
        if (node.operator !== "&&") collectClassStrings(node.left, out, valuesMode);
        return;
      case "ArrayExpression":
        for (const el of node.elements) collectClassStrings(el, out, valuesMode);
        return;
      case "ObjectExpression":
        out.complete = false;
        for (const p of node.properties) {
          if (p.type !== "ObjectProperty") continue;
          if (valuesMode) collectClassStrings(p.value, out, true);
          else if (!p.computed && p.key.type === "StringLiteral") pushTokens(p.key.value, p.key.start + 1, p.key, out);
          else if (!p.computed && p.key.type === "Identifier") out.tokens.push({ value: p.key.name, range: [p.key.start, p.key.end] });
        }
        return;
      case "CallExpression": {
        const name = calleeName(node.callee);
        if (name && CLASS_HELPERS.has(name)) {
          handled.add(node);
          const values = VARIANT_HELPERS.has(name);
          for (const arg of node.arguments) collectClassStrings(arg, out, values);
          return;
        }
        out.complete = false;
        return;
      }
      case "TaggedTemplateExpression":
        if (calleeName(node.tag) === "tw") {
          handled.add(node);
          collectClassStrings(node.quasi, out, valuesMode);
          return;
        }
        out.complete = false;
        return;
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "ParenthesizedExpression":
        collectClassStrings(node.expression, out, valuesMode);
        return;
      default:
        out.complete = false;
    }
  }

  let groupCounter = 0;
  function pushTokens(value: string, base: number, node: N, out: { tokens: ClassToken[] }) {
    const group = ++groupCounter;
    // Escapes in class strings are rare; only map offsets when the raw text matches.
    const raw = text.slice(node.start + 1, node.end - 1);
    if (raw !== value) {
      if (value.split(/\s+/).some(Boolean)) out.tokens.push(...splitTokens(value, base).map((t) => ({ ...t, group, range: [node.start, node.end] as [number, number] })));
      return;
    }
    out.tokens.push(...splitTokens(value, base).map((t) => ({ ...t, group })));
  }

  function emitClassList(node: N, element: ElementNode | undefined, origin: ClassListNode["origin"]) {
    const out = { tokens: [] as ClassToken[], complete: true };
    collectClassStrings(node, out, false);
    if (out.tokens.length) emit.classList({ tokens: out.tokens, complete: out.complete, element, origin });
  }

  // ------------------------------------------------------------------ style objects ----
  function emitStyleObject(obj: N, element: ElementNode | undefined) {
    const props: StyleProp[] = [];
    let complete = true;
    for (const p of obj.properties) {
      if (p.type !== "ObjectProperty" || p.computed) {
        complete = false;
        continue;
      }
      const key = p.key.type === "Identifier" ? p.key.name : p.key.type === "StringLiteral" ? p.key.value : null;
      if (key === null) {
        complete = false;
        continue;
      }
      const v = p.value;
      let value: StyleProp["value"] = { kind: "dynamic" };
      if (v.type === "StringLiteral") value = { kind: "static", value: v.value, range: [v.start + 1, v.end - 1], quoted: true };
      else if (v.type === "NumericLiteral") value = { kind: "static", value: v.value, range: [v.start, v.end], quoted: false };
      else if (v.type === "UnaryExpression" && v.operator === "-" && v.argument.type === "NumericLiteral")
        value = { kind: "static", value: -v.argument.value, range: [v.start, v.end], quoted: false };
      else if (v.type === "TemplateLiteral" && v.expressions.length === 0)
        value = { kind: "static", value: v.quasis[0].value.cooked ?? "", range: [v.start + 1, v.end - 1], quoted: true };
      props.push({
        key,
        keyRange: p.key.type === "StringLiteral" ? [p.key.start + 1, p.key.end - 1] : [p.key.start, p.key.end],
        keyQuoted: p.key.type === "StringLiteral",
        value,
      });
    }
    if (props.length) emit.styleObject({ props, complete, element });
  }

  // ------------------------------------------------------------------ elements ---------
  function jsxName(n: N): string {
    if (n.type === "JSXIdentifier") return n.name;
    if (n.type === "JSXMemberExpression") return `${jsxName(n.object)}.${n.property.name}`;
    if (n.type === "JSXNamespacedName") return `${n.namespace.name}:${n.name.name}`;
    return "";
  }

  function attrValue(v: N): AttrValue {
    if (!v) return { kind: "boolean" };
    if (v.type === "StringLiteral") return { kind: "static", value: v.value, range: [v.start + 1, v.end - 1] };
    if (v.type === "JSXExpressionContainer") {
      const e = v.expression;
      if (e.type === "StringLiteral") return { kind: "static", value: e.value, range: [e.start + 1, e.end - 1] };
      if (e.type === "TemplateLiteral" && e.expressions.length === 0)
        return { kind: "static", value: e.quasis[0].value.cooked ?? "", range: [e.start + 1, e.end - 1] };
      return { kind: "dynamic", text: src(e), range: [e.start, e.end], node: e };
    }
    return { kind: "dynamic", text: src(v), range: [v.start, v.end], node: v };
  }

  function buildElement(el: N, state: WalkState): ElementNode {
    const opening = el.openingElement;
    const name = jsxName(opening.name);
    const attributes: Attribute[] = [];
    let hasSpread = false;
    for (const a of opening.attributes) {
      if (a.type === "JSXSpreadAttribute") {
        hasSpread = true;
        continue;
      }
      const attrName = a.name.type === "JSXNamespacedName" ? `${a.name.namespace.name}:${a.name.name.name}` : a.name.name;
      attributes.push({ name: attrName, value: attrValue(a.value), range: [a.start, a.end] });
    }
    const children: ChildInfo[] = [];
    for (const c of el.children ?? []) {
      if (c.type === "JSXText") {
        if (c.value.trim()) children.push({ kind: "text", value: c.value });
      } else if (c.type === "JSXExpressionContainer") {
        if (c.expression.type !== "JSXEmptyExpression") children.push({ kind: "expression", text: src(c.expression) });
      } else if (c.type === "JSXElement") children.push({ kind: "element", name: jsxName(c.openingElement.name) });
      else if (c.type === "JSXFragment") children.push({ kind: "element", name: "" });
    }
    const root = name.split(".")[0]!;
    const imp = imports.get(root);
    const nameEnd = opening.typeArguments?.end ?? opening.typeParameters?.end ?? opening.name.end;
    const node: ElementNode = {
      name,
      intrinsic: /^[a-z]/.test(name) && !name.includes("."),
      attributes,
      hasSpread,
      nameRange: [opening.name.start, opening.name.end],
      insertAttrAt: nameEnd,
      ancestors: [...state.elements].reverse(),
      source: "jsx",
      importSource: imp?.source,
      importedName: imp ? (name.includes(".") ? name.split(".").pop() : imp.imported === "default" ? root : imp.imported) : undefined,
      conditionalTests: [...state.tests],
      children,
      getAttr: (n: string) => attributes.find((a) => a.name === n),
    };
    return node;
  }

  // ------------------------------------------------------------------ text -------------
  function placeholderFor(expr: N): string {
    const t = src(expr).replace(/\s+/g, "");
    const last = t.split(/[.?[\]()]/).filter(Boolean).pop() ?? t;
    if (expr.type === "NumericLiteral") return PH_NUMERIC;
    if (/^(toLocaleString|toFixed|format|formatNumber|toString)$/.test(last) || isNumericName(last)) return PH_NUMERIC;
    return PH_UNKNOWN;
  }

  /** Concatenate JSX children of a "text root" element into one Decoded with sentinels. */
  function jsxChildrenText(el: N, acc: Decoded & { placeholders: Map<number, string> }) {
    for (const c of el.children ?? []) {
      if (c.type === "JSXText") {
        const d = decodeEntities(text.slice(c.start, c.end), c.start);
        acc.text += d.text;
        acc.offsets.push(...d.offsets);
        acc.ends.push(...d.ends);
      } else if (c.type === "JSXExpressionContainer") {
        const e = c.expression;
        if (e.type === "JSXEmptyExpression") continue;
        if (e.type === "StringLiteral") {
          const d = decodeEscapes(text.slice(e.start + 1, e.end - 1), e.start + 1);
          acc.text += d.text;
          acc.offsets.push(...d.offsets);
          acc.ends.push(...d.ends);
          continue;
        }
        acc.placeholders.set(acc.text.length, `{${src(e)}}`);
        acc.text += placeholderFor(e);
        acc.offsets.push(c.start);
        acc.ends.push(c.end);
      } else if (c.type === "JSXElement" || c.type === "JSXFragment") {
        const name = c.type === "JSXFragment" ? "" : jsxName(c.openingElement.name);
        const attrs = c.type === "JSXFragment" ? [] : c.openingElement.attributes;
        const hasDir = attrs.some((a: N) => a.type === "JSXAttribute" && a.name?.name === "dir");
        if (name === "bdi" || name === "bdo" || hasDir) {
          acc.text += ISOLATED;
          acc.offsets.push(c.start);
          acc.ends.push(c.end);
        } else if (name === "" || INLINE_ELEMENTS.has(name)) {
          inlined.add(c);
          jsxChildrenText(c, acc);
        } else if (name === "br") {
          acc.text += " ";
          acc.offsets.push(c.start);
          acc.ends.push(c.end);
        } else {
          // Components or block elements: unknown content.
          acc.placeholders.set(acc.text.length, `<${name}>`);
          acc.text += PH_UNKNOWN;
          acc.offsets.push(c.start);
          acc.ends.push(c.end);
        }
      }
    }
  }

  function emitJsxText(el: N, element: ElementNode) {
    if (inlined.has(el)) return;
    const hasRtlChild = (n: N): boolean =>
      (n.children ?? []).some(
        (c: N) =>
          (c.type === "JSXText" && hasRtl(c.value)) ||
          (c.type === "JSXExpressionContainer" && c.expression.type === "StringLiteral" && hasRtl(c.expression.value)) ||
          ((c.type === "JSXElement" || c.type === "JSXFragment") && hasRtlChild(c)),
      );
    if (!hasRtlChild(el)) return;
    const acc = { text: "", offsets: [] as number[], ends: [] as number[], placeholders: new Map<number, string>() };
    jsxChildrenText(el, acc);
    if (!hasRtl(acc.text)) return;
    const dir = element.getAttr("dir");
    const node: TextNode = {
      kind: "jsx-text",
      text: acc.text,
      offsets: acc.offsets,
      ends: acc.ends,
      placeholders: acc.placeholders,
      range: [el.start, el.end],
      rtlLocale: false,
      firstStrongContext: dir?.value.kind === "static" && dir.value.value === "auto",
      markEncoding: "entity",
    };
    emit.text(node);
  }

  function emitStringText(n: N, decoded: Decoded, withSentinels: boolean, key: string | undefined, markEncoding: TextNode["markEncoding"] = "escape") {
    const base = {
      kind: opts.translationFile ? ("translation" as const) : ("js-string" as const),
      range: [n.start, n.end] as [number, number],
      key,
      rtlLocale: opts.rtlLocale,
      firstStrongContext: opts.translationFile,
      markEncoding,
    };
    const nodes = buildTextNodes(decoded, "message", base);
    if (withSentinels) {
      // Template literal: ${expr} sentinels were inserted before tokenization.
      for (const tn of nodes) {
        for (let i = 0; i < tn.text.length; i++) {
          const ch = tn.text[i];
          if ((ch === PH_UNKNOWN || ch === PH_NUMERIC) && !tn.placeholders.has(i)) {
            tn.placeholders.set(i, text.slice(tn.offsets[i], tn.ends[i]));
          }
        }
      }
    }
    for (const tn of nodes) if (hasRtl(tn.text)) emit.text(tn);
  }

  // ------------------------------------------------------------------ walker -----------
  const state: WalkState = { elements: [], tests: [] };
  const keyStack: string[] = [];

  function visit(node: N, parent: N, parentKey: string): void {
    if (!node || typeof node.type !== "string") return;

    switch (node.type) {
      case "ImportDeclaration":
      case "ExportAllDeclaration":
      case "TSImportType":
      case "TSLiteralType":
      case "TSExternalModuleReference":
        return;
      case "ExportNamedDeclaration":
        if (node.source) return;
        break;
      case "JSXElement": {
        const element = buildElement(node, state);
        emit.element(element);
        for (const a of node.openingElement.attributes) {
          if (a.type !== "JSXAttribute" || !a.value) continue;
          const an = a.name.name;
          if ((an === "className" || an === "class") && a.value) {
            const v = a.value.type === "JSXExpressionContainer" ? a.value.expression : a.value;
            emitClassList(v, element, "attribute");
          } else if (an === "style" && a.value.type === "JSXExpressionContainer" && a.value.expression.type === "ObjectExpression") {
            emitStyleObject(a.value.expression, element);
            handled.add(a.value.expression);
          }
        }
        if (wantText) emitJsxText(node, element);
        // Attribute expressions belong to the parent's element context.
        for (const a of node.openingElement.attributes) visit(a, node, "attributes");
        state.elements.push(element);
        const savedTests = state.tests;
        state.tests = [];
        for (const c of node.children ?? []) visit(c, node, "children");
        state.tests = savedTests;
        state.elements.pop();
        return;
      }
      case "JSXText":
        return; // handled by emitJsxText
      case "ConditionalExpression":
      case "IfStatement": {
        visit(node.test, node, "test");
        state.tests.push(src(node.test));
        visit(node.consequent, node, "consequent");
        visit(node.alternate, node, "alternate");
        state.tests.pop();
        return;
      }
      case "LogicalExpression": {
        visit(node.left, node, "left");
        state.tests.push(src(node.left));
        visit(node.right, node, "right");
        state.tests.pop();
        return;
      }
      case "CallExpression": {
        const name = calleeName(node.callee);
        if (name && CLASS_HELPERS.has(name) && !handled.has(node)) emitClassList(node, undefined, "helper");
        break;
      }
      case "TaggedTemplateExpression":
        if (calleeName(node.tag) === "tw" && !handled.has(node)) emitClassList(node, undefined, "helper");
        break;
      case "StringLiteral": {
        if (!wantText || !hasRtl(node.value)) return;
        if (parentKey === "key" && parent?.type === "ObjectProperty" && !parent.computed) return;
        if (parent?.type === "JSXAttribute" && /^(className|class|style|href|src)$/.test(parent.name?.name)) return;
        const raw = text.slice(node.start + 1, node.end - 1);
        // JSX attribute strings are not JS strings: no escapes, but HTML entities.
        const inJsxAttr = parent?.type === "JSXAttribute";
        const decoded = inJsxAttr ? decodeEntities(raw, node.start + 1) : decodeEscapes(raw, node.start + 1);
        emitStringText(node, decoded, false, keyStack.join(".") || undefined, inJsxAttr ? "entity" : "escape");
        return;
      }
      case "TemplateLiteral": {
        if (!wantText || !node.quasis.some((q: N) => hasRtl(q.value.raw))) break;
        const parts: Decoded[] = [];
        node.quasis.forEach((q: N, i: number) => {
          parts.push(decodeEscapes(q.value.raw, q.start));
          const e = node.expressions[i];
          if (e) parts.push({ text: placeholderFor(e), offsets: [e.start - 2], ends: [e.end + 1] });
        });
        const decoded: Decoded = {
          text: parts.map((p) => p.text).join(""),
          offsets: parts.flatMap((p) => p.offsets),
          ends: parts.flatMap((p) => p.ends),
        };
        emitStringText(node, decoded, true, keyStack.join(".") || undefined);
        for (const e of node.expressions) visit(e, node, "expressions");
        return;
      }
      case "ObjectProperty": {
        const k = !node.computed && (node.key.type === "Identifier" ? node.key.name : node.key.type === "StringLiteral" ? node.key.value : null);
        if (k) keyStack.push(k);
        visit(node.key, node, "key");
        visit(node.value, node, "value");
        if (k) keyStack.pop();
        return;
      }
    }

    for (const key in node) {
      if (SKIP_KEYS.has(key)) continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const v of value) if (v && typeof v.type === "string") visit(v, node, key);
      } else if (value && typeof value.type === "string") {
        visit(value, node, key);
      }
    }
  }

  visit(ast.program, null, "");
}

function calleeName(callee: N): string | null {
  if (!callee) return null;
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier") {
    // e.g. tw.div`…`, utils.cn(...)
    if (callee.object.type === "Identifier" && callee.object.name === "tw") return "tw";
    return callee.property.name;
  }
  return null;
}

export function splitTokens(value: string, base: number): ClassToken[] {
  const out: ClassToken[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) out.push({ value: m[0], range: [base + m.index, base + m.index + m[0].length] });
  return out;
}
