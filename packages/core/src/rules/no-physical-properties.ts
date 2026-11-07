import type { AtRule, ChildNode, Container, Declaration, Root, Rule as CssRule } from "postcss";
import type {
  ClassListNode,
  CssDeclarationNode,
  Fix,
  Rule,
  RuleContext,
  StyleObjectNode,
  StyleProp,
} from "../types.js";
import { docsUrl } from "./util.js";

// ---------------------------------------------------------------------------------------
// Mappings
// ---------------------------------------------------------------------------------------

/** Physical property -> logical property. */
export const CSS_PROPERTY_MAP: Record<string, string> = {
  "margin-left": "margin-inline-start",
  "margin-right": "margin-inline-end",
  "padding-left": "padding-inline-start",
  "padding-right": "padding-inline-end",
  left: "inset-inline-start",
  right: "inset-inline-end",
  "border-left": "border-inline-start",
  "border-right": "border-inline-end",
  "border-left-width": "border-inline-start-width",
  "border-right-width": "border-inline-end-width",
  "border-left-style": "border-inline-start-style",
  "border-right-style": "border-inline-end-style",
  "border-left-color": "border-inline-start-color",
  "border-right-color": "border-inline-end-color",
  "border-top-left-radius": "border-start-start-radius",
  "border-top-right-radius": "border-start-end-radius",
  "border-bottom-left-radius": "border-end-start-radius",
  "border-bottom-right-radius": "border-end-end-radius",
};

/** Property whose *value* left/right is physical -> logical keyword per value. */
export const CSS_VALUE_MAP: Record<string, Record<string, string>> = {
  "text-align": { left: "start", right: "end" },
  float: { left: "inline-start", right: "inline-end" },
  clear: { left: "inline-start", right: "inline-end" },
};

/** Counterpart on the other side, for symmetric-pair detection. */
const COUNTERPART: Record<string, string> = {};
for (const p of Object.keys(CSS_PROPERTY_MAP)) {
  const other = p.includes("left") ? p.replace("left", "right") : p.replace("right", "left");
  COUNTERPART[p] = other;
}

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
/** React style-object keys. */
const STYLE_KEY_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CSS_PROPERTY_MAP).map(([k, v]) => [camel(k), camel(v)]),
);
const STYLE_VALUE_MAP: Record<string, Record<string, string>> = {
  textAlign: CSS_VALUE_MAP["text-align"]!,
  float: CSS_VALUE_MAP.float!,
  cssFloat: CSS_VALUE_MAP.float!,
  clear: CSS_VALUE_MAP.clear!,
};

// ---------------------------------------------------------------------------------------
// Tailwind
// ---------------------------------------------------------------------------------------

const SPACING_VALUE =
  /^(?:\d+(?:\.\d+)?|px|auto|full|\d+\/\d+|\[[^\]]+\]|\([^)]+\)|screen|min|max|fit|svw|lvw|dvw)$/;
const RADIUS_VALUE = /^(?:none|xs|sm|md|lg|xl|2xl|3xl|4xl|full|\[[^\]]+\]|\([^)]+\))$/;
const BORDER_VALUE =
  /^(?:\d+|\[[^\]]+\]|\([^)]+\)|transparent|current|inherit|black|white|[a-z]+-\d{2,3}(?:\/\d+)?|[a-z]+\/\d+)$/;

export interface TailwindMatch {
  family: string;
  side: "l" | "r" | "tl" | "tr" | "bl" | "br";
  suffix: string;
  replacement: string;
  needsFloat: boolean;
}

/** Map a Tailwind utility (without variants / important / negative prefix). */
export function matchTailwindUtility(base: string): TailwindMatch | null {
  let m: RegExpMatchArray | null;
  if ((m = base.match(/^(m|p|scroll-m|scroll-p)([lr])-(.+)$/)) && SPACING_VALUE.test(m[3]!)) {
    const side = m[2] as "l" | "r";
    return {
      family: m[1]!,
      side,
      suffix: m[3]!,
      replacement: `${m[1]}${side === "l" ? "s" : "e"}-${m[3]}`,
      needsFloat: false,
    };
  }
  if ((m = base.match(/^text-(left|right)$/))) {
    return {
      family: "text-align",
      side: m[1] === "left" ? "l" : "r",
      suffix: "",
      replacement: m[1] === "left" ? "text-start" : "text-end",
      needsFloat: false,
    };
  }
  if ((m = base.match(/^(float|clear)-(left|right)$/))) {
    return {
      family: m[1]!,
      side: m[2] === "left" ? "l" : "r",
      suffix: "",
      replacement: `${m[1]}-${m[2] === "left" ? "start" : "end"}`,
      needsFloat: true,
    };
  }
  if ((m = base.match(/^(left|right)-(.+)$/)) && SPACING_VALUE.test(m[2]!)) {
    return {
      family: "inset",
      side: m[1] === "left" ? "l" : "r",
      suffix: m[2]!,
      replacement: `${m[1] === "left" ? "start" : "end"}-${m[2]}`,
      needsFloat: false,
    };
  }
  if ((m = base.match(/^border-([lr])(?:-(.+))?$/)) && (!m[2] || BORDER_VALUE.test(m[2]))) {
    const side = m[1] as "l" | "r";
    return {
      family: "border",
      side,
      suffix: m[2] ?? "",
      replacement: `border-${side === "l" ? "s" : "e"}${m[2] ? "-" + m[2] : ""}`,
      needsFloat: false,
    };
  }
  if (
    (m = base.match(/^rounded-(l|r|tl|tr|bl|br)(?:-(.+))?$/)) &&
    (!m[2] || RADIUS_VALUE.test(m[2]))
  ) {
    const map: Record<string, string> = { l: "s", r: "e", tl: "ss", tr: "se", bl: "es", br: "ee" };
    const side = m[1] as TailwindMatch["side"];
    return {
      family: "rounded",
      side,
      suffix: m[2] ?? "",
      replacement: `rounded-${map[side]}${m[2] ? "-" + m[2] : ""}`,
      needsFloat: false,
    };
  }
  return null;
}

interface ParsedClass {
  variants: string[];
  important: "" | "prefix" | "suffix";
  negative: boolean;
  base: string;
}

export function parseTailwindClass(token: string): ParsedClass {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of token) {
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth = Math.max(0, depth - 1);
    if (ch === ":" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  let base = cur;
  let important: ParsedClass["important"] = "";
  if (base.startsWith("!")) {
    important = "prefix";
    base = base.slice(1);
  } else if (base.endsWith("!")) {
    important = "suffix";
    base = base.slice(0, -1);
  }
  let negative = false;
  if (base.startsWith("-")) {
    negative = true;
    base = base.slice(1);
  }
  return { variants: parts, important, negative, base };
}

const DIR_VARIANT = /^(rtl|ltr)$|dir[=-]|\[dir|:dir\(|^group-(rtl|ltr)|^peer-(rtl|ltr)/;

// ---------------------------------------------------------------------------------------
// CSS helpers
// ---------------------------------------------------------------------------------------

const DIR_SELECTOR =
  /\[\s*dir\b|:dir\(|\.(?:rtl|ltr)\b|\[class[*~^|]?=["']?(?:rtl|ltr)|:lang\(|\[lang\b/i;
const DIR_AT_PARAMS = /\b(?:rtl|ltr|dir|direction)\b/i;
const RTL_DIRECTIVE = /^!?\s*(?:rtl:|@noflip|@flip)/i;

interface RootInfo {
  /** Base selectors that have a direction-scoped override somewhere in this stylesheet. */
  overridden: Set<string>;
  hasDirScopedRules: boolean;
  /** Offsets covered by rtl:begin:ignore … rtl:end:ignore. */
  ignoredRanges: [number, number][];
}

const rootInfoCache = new WeakMap<Root, RootInfo>();

function selectorChain(node: ChildNode | Container): string[] {
  const chain: string[] = [];
  let p: Container | undefined =
    node.type === "rule" ? (node as CssRule) : (node.parent as Container | undefined);
  while (p && p.type !== "root") {
    if (p.type === "rule") chain.unshift((p as CssRule).selector);
    else if (p.type === "atrule") chain.unshift(`@${(p as AtRule).name} ${(p as AtRule).params}`);
    p = p.parent as Container | undefined;
  }
  return chain;
}

/** Resolve nested selectors (Sass / CSS nesting) to a flat selector, first branch only. */
function resolvedSelector(rule: CssRule): string {
  const chain: string[] = [];
  let p: Container | undefined = rule;
  while (p && p.type !== "root") {
    if (p.type === "rule") chain.unshift(((p as CssRule).selector.split(",")[0] ?? "").trim());
    p = p.parent as Container | undefined;
  }
  return chain.reduce(
    (acc, sel) => (acc ? (sel.includes("&") ? sel.replace(/&/g, acc) : `${acc} ${sel}`) : sel),
    "",
  );
}

/** Remove direction qualifiers so `[dir=rtl] .a` and `html.rtl .a` both normalize to `.a`. */
function stripDir(selector: string): string {
  return selector
    .replace(/(?:html|body|:root)?\s*\[\s*dir\s*[~|^$*]?=\s*["']?\w+["']?\s*\]/gi, " ")
    .replace(/(?:html|body|:root)?\s*:dir\(\s*\w+\s*\)/gi, " ")
    .replace(/(?:html|body|:root)?\.(?:rtl|ltr)\b/gi, " ")
    .replace(/(?:html|body)?\s*:lang\([^)]*\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getRootInfo(root: Root): RootInfo {
  const cached = rootInfoCache.get(root);
  if (cached) return cached;
  const info: RootInfo = { overridden: new Set(), hasDirScopedRules: false, ignoredRanges: [] };
  let open: number | null = null;
  root.walk((node) => {
    if (node.type === "comment") {
      const t = node.text.trim();
      const offset = node.source?.start?.offset ?? 0;
      if (/^!?\s*rtl:begin:ignore/i.test(t)) open = offset;
      else if (/^!?\s*rtl:end:ignore/i.test(t) && open !== null) {
        info.ignoredRanges.push([open, node.source?.end?.offset ?? offset]);
        open = null;
      }
    } else if (node.type === "rule") {
      const chain = selectorChain(node).join(" ");
      if (DIR_SELECTOR.test(chain)) {
        info.hasDirScopedRules = true;
        info.overridden.add(stripDir(resolvedSelector(node)));
      }
    } else if (
      node.type === "atrule" &&
      /^(include|mixin)$/.test(node.name) &&
      DIR_AT_PARAMS.test(node.params)
    ) {
      info.hasDirScopedRules = true;
      const parent = node.parent;
      if (parent?.type === "rule")
        info.overridden.add(stripDir(resolvedSelector(parent as CssRule)));
    }
  });
  if (open !== null) info.ignoredRanges.push([open, Number.POSITIVE_INFINITY]);
  rootInfoCache.set(root, info);
  return info;
}

function precededByDirective(node: ChildNode): boolean {
  const prev = node.prev();
  return prev?.type === "comment" && RTL_DIRECTIVE.test(prev.text.trim());
}

function isRtlIgnored(decl: Declaration, info: RootInfo): boolean {
  if (precededByDirective(decl)) return true;
  const rawValue = (decl.raws as { value?: { raw?: string } }).value?.raw ?? "";
  if (
    /\/\*\s*!?\s*(?:rtl:|@noflip)/i.test(rawValue) ||
    /\/\*\s*!?\s*(?:rtl:|@noflip)/i.test(decl.raws.between ?? "")
  )
    return true;
  const offset = decl.source?.start?.offset ?? 0;
  if (info.ignoredRanges.some(([a, b]) => offset >= a && offset <= b)) return true;
  let p: Container | undefined = decl.parent as Container | undefined;
  while (p && p.type !== "root") {
    if (precededByDirective(p as ChildNode)) return true;
    const first = p.first;
    if (first?.type === "comment" && /^!?\s*(?:rtl:ignore|@noflip)/i.test(first.text.trim()))
      return true;
    p = p.parent as Container | undefined;
  }
  return false;
}

export function namesPhysicalSide(selector: string): boolean {
  return selector
    .split(/[\s>+~,.#:[\]()="'&*^$|]+/)
    .flatMap((t) => t.split(/[-_]+/))
    .some((t) => /^(left|right)$/i.test(t));
}

const norm = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();

function siblingsOf(decl: Declaration): Declaration[] {
  return (decl.parent?.nodes ?? []).filter((n): n is Declaration => n.type === "decl");
}

// ---------------------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------------------

export interface Options {
  /** Check Tailwind utility classes (needs Tailwind detected or settings.tailwind=true). */
  tailwind: boolean;
  /** Check React `style={{ … }}` objects. */
  styleObjects: boolean;
  /** Extra properties to ignore, e.g. ["text-align"]. */
  ignoreProperties: string[];
}

const GENERATED_RTL_FILE = /(?:^|[./\\_-])rtl\.s?css$/i;

export const noPhysicalProperties: Rule<Options> = {
  meta: {
    id: "no-physical-properties",
    description:
      "Disallow physical left/right CSS properties, values and Tailwind utilities; use logical (start/end) equivalents.",
    bug: "A sidebar with `margin-left: 16px` keeps its gap on the left in Arabic, so the content touches the right screen edge while the gap sits on the wrong side.",
    docsUrl: docsUrl("no-physical-properties"),
    defaultSeverity: "error",
    fixable: true,
    languages: ["css", "scss", "html", "js"],
  },
  defaultOptions: { tailwind: true, styleObjects: true, ignoreProperties: [] },

  create(ctx: RuleContext<Options>) {
    const { project, file, options } = ctx;
    const ignored = new Set(options.ignoreProperties.map((p) => p.toLowerCase()));
    const flipped = project.buildTimeFlip;

    function cssDeclaration({ decl, baseOffset, inline }: CssDeclarationNode) {
      if (flipped && !inline) return;
      const prop = decl.prop.toLowerCase();
      const value = decl.value.trim().toLowerCase();
      if (ignored.has(prop)) return;
      const toProp = CSS_PROPERTY_MAP[prop];
      const valueMap = CSS_VALUE_MAP[prop];
      const toValue = valueMap?.[value.replace(/\s*!important$/, "")];
      if (!toProp && !toValue) return;

      const root = decl.root();
      const info = getRootInfo(root);
      const chain = selectorChain(decl).join(" ");
      // Direction-scoped (manual RTL override) or @supports fallbacks: intentional.
      if (DIR_SELECTOR.test(chain)) return;
      if (/@include\s+[\w-]*\b(?:rtl|ltr|dir)\b/i.test(chain)) return;
      if (/@supports\s+not\b/i.test(chain)) return;
      if (isRtlIgnored(decl, info)) return;
      const parentRule = decl.parent?.type === "rule" ? (decl.parent as CssRule) : null;
      // `.popover.right { left: 4px }`, `.label_left`, `[data-side="right"]`: the selector names a
      // physical side, so the author is deliberately physical (often a placement computed by a
      // positioning library). Converting it would break it in RTL.
      if (parentRule && namesPhysicalSide(parentRule.selector)) return;
      if (parentRule && info.overridden.has(stripDir(resolvedSelector(parentRule)))) return;

      const siblings = siblingsOf(decl);
      if (toProp) {
        const other = COUNTERPART[prop]!;
        const twin = siblings.find((d) => d !== decl && d.prop.toLowerCase() === other);
        // margin-left: auto; margin-right: auto  -> direction-neutral
        if (twin && norm(twin.value) === norm(decl.value)) return;
        if (prop === "left" || prop === "right") {
          // left: 50%; transform: translateX(-50%) centering is direction-neutral
          if (/(^|[^\d.])50%/.test(value)) return;
          // left: 0 + width: 100% covers the whole line in both directions
          if (
            /^0(px|rem|em|%)?$/.test(value) &&
            siblings.some(
              (d) => /^(width|min-width)$/i.test(d.prop) && /^100(%|vw)$/.test(norm(d.value)),
            )
          )
            return;
        }
      }

      const start = baseOffset + decl.source!.start!.offset;
      let range: [number, number];
      let fix: Fix[] | undefined;
      let message: string;
      if (toProp) {
        range = [start, start + decl.prop.length];
        message = `"${decl.prop}" is physical: in RTL it stays on the ${prop.includes("left") ? "left" : "right"}. Use "${toProp}".`;
        fix = [{ range, text: toProp }];
      } else {
        const valueStart = start + decl.prop.length + (decl.raws.between?.length ?? 1);
        const src = file.text.slice(valueStart, valueStart + 200);
        const m = src.match(/\b(left|right)\b/i);
        const kw = (m?.[1] ?? value).toLowerCase();
        range = m
          ? [valueStart + m.index!, valueStart + m.index! + m[1]!.length]
          : [start, start + decl.prop.length];
        message = `"${decl.prop}: ${kw}" is physical: in RTL it stays ${kw}. Use "${decl.prop}: ${toValue}".`;
        fix = m ? [{ range, text: toValue! }] : undefined;
      }
      // If the stylesheet already contains manual [dir] overrides, converting could change
      // how they interact: report, but leave the change to a human.
      ctx.report({ message, range, fix: info.hasDirScopedRules ? undefined : fix });
    }

    function classList(node: ClassListNode) {
      if (!options.tailwind || flipped) return;
      const tw = project.tailwind;
      const htmlCdn =
        file.language === "html" && /cdn\.tailwindcss\.com|@tailwindcss\/browser/.test(file.text);
      if (!tw.enabled && !htmlCdn) return;
      const parsed = node.tokens.map((t) => ({ token: t, cls: parseTailwindClass(t.value) }));
      // Any rtl:/ltr: variant in the list means direction is handled by hand.
      if (parsed.some((p) => p.cls.variants.some((v) => DIR_VARIANT.test(v)))) return;
      const matches = parsed
        .map((p) => ({ ...p, match: matchTailwindUtility(p.cls.base) }))
        .filter((p) => p.match && !ignored.has(p.match.family));
      if (!matches.length) return;
      // In incomplete lists (conditionals, variants) only tokens of the same literal apply together.
      const key = (p: (typeof matches)[number]) =>
        `${node.complete ? "" : (p.token.group ?? "")}|${p.cls.variants.join(":")}|${p.cls.negative}|${p.match!.family}|${p.match!.suffix}`;
      const sides = new Map<string, Set<string>>();
      for (const p of matches) {
        const k = key(p);
        if (!sides.has(k)) sides.set(k, new Set());
        sides.get(k)!.add(p.match!.side);
      }
      const centered = parsed.some(
        (p) =>
          /^-?translate-x-(1\/2|\[-?50%\])$/.test(p.cls.base) || p.cls.base === "-translate-x-1/2",
      );
      const logicalOk = htmlCdn || tw.logical;
      for (const p of matches) {
        const m = p.match!;
        const s = sides.get(key(p))!;
        const pairs: Record<string, string> = {
          l: "r",
          r: "l",
          tl: "tr",
          tr: "tl",
          bl: "br",
          br: "bl",
        };
        if (s.has(pairs[m.side]!)) continue; // ml-4 mr-4, left-0 right-0: symmetric
        if (m.family === "inset" && (centered || m.suffix === "1/2" || /\[50%\]/.test(m.suffix)))
          continue;
        const prefix = p.cls.variants.length ? p.cls.variants.join(":") + ":" : "";
        const neg = p.cls.negative ? "-" : "";
        const imp = (s: string) =>
          p.cls.important === "prefix" ? "!" + s : p.cls.important === "suffix" ? s + "!" : s;
        const replacement = prefix + imp(neg + m.replacement);
        const supported = m.needsFloat ? htmlCdn || tw.logicalFloat : logicalOk;
        const versionNote = supported
          ? ""
          : ` (needs Tailwind ${m.needsFloat ? "3.4" : "3.3"}+; you have ${tw.version ?? "an older version"})`;
        ctx.report({
          message: `"${p.token.value}" is a physical utility: it does not flip in RTL. Use "${replacement}"${versionNote}.`,
          range: p.token.range,
          fix: supported ? [{ range: p.token.range, text: replacement }] : undefined,
        });
      }
    }

    function styleObject(node: StyleObjectNode) {
      if (!options.styleObjects || project.reactNative) return;
      const byKey = new Map<string, StyleProp>(node.props.map((p) => [p.key, p]));
      const staticVal = (p: StyleProp | undefined) =>
        p && p.value.kind === "static" ? String(p.value.value).trim().toLowerCase() : null;
      for (const p of node.props) {
        const toKey = STYLE_KEY_MAP[p.key];
        const vmap = STYLE_VALUE_MAP[p.key];
        const val = staticVal(p);
        if (toKey) {
          const kebab = p.key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
          if (ignored.has(kebab)) continue;
          const otherKey = p.key.includes("Left")
            ? p.key.replace("Left", "Right")
            : p.key.includes("Right")
              ? p.key.replace("Right", "Left")
              : p.key === "left"
                ? "right"
                : "left";
          const twin = byKey.get(otherKey);
          if (twin && val !== null && staticVal(twin) === val) continue;
          if ((p.key === "left" || p.key === "right") && val !== null && /(^|[^\d.])50%/.test(val))
            continue;
          ctx.report({
            message: `Style key "${p.key}" is physical: in RTL it stays on the ${/left/i.test(p.key) ? "left" : "right"}. Use "${toKey}".`,
            range: p.keyRange,
            fix: [{ range: p.keyRange, text: toKey }],
          });
        } else if (
          vmap &&
          val !== null &&
          vmap[val] &&
          p.value.kind === "static" &&
          p.value.quoted
        ) {
          const kebab =
            p.key === "textAlign" ? "text-align" : p.key === "cssFloat" ? "float" : p.key;
          if (ignored.has(kebab)) continue;
          ctx.report({
            message: `"${p.key}: '${val}'" is physical: in RTL it stays ${val}. Use "${vmap[val]}".`,
            range: p.value.range,
            fix: [{ range: p.value.range, text: vmap[val]! }],
          });
        }
      }
    }

    return {
      file() {
        if (GENERATED_RTL_FILE.test(file.path)) return false;
        return undefined;
      },
      cssDeclaration,
      classList,
      styleObject,
    };
  },
};
