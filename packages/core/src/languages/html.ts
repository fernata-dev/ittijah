/**
 * HTML adapter (parse5 with source locations). Handles elements, class/style attributes,
 * <style> blocks and text nodes (including {{ template }} placeholders).
 */
import { parse, parseFragment } from "parse5";
import { buildTextNodes, hasRtl } from "../bidi/message.js";
import { decodeEntities } from "./entities.js";
import { parseCss, walkCss } from "./css.js";
import { splitTokens } from "./js.js";
import type { Attribute, ChildInfo, ElementNode } from "../types.js";
import type { Emitter } from "./emitter.js";

type N = any;

const TEMPLATE_EXPR = /^\s*(\{\{\{?|\{%|<%=?|\$\{)\s*([\s\S]*?)\s*(\}?\}\}|%\}|%>|\})\s*$/;

export function walkHtml(text: string, emit: Emitter): void {
  const isDocument = /<!doctype|<html[\s>]/i.test(text);
  const doc: N = isDocument
    ? parse(text, { sourceCodeLocationInfo: true })
    : parseFragment(text, { sourceCodeLocationInfo: true });

  const stack: ElementNode[] = [];

  function attrRange(loc: N, name: string, value: string): [number, number] | null {
    const l = loc?.attrs?.[name];
    if (!l) return null;
    const raw = text.slice(l.startOffset, l.endOffset);
    const m = raw.match(/^[^=]*=\s*(["']?)/);
    if (!m) return null;
    const start = l.startOffset + m[0].length;
    return [start, start + (m[1] ? raw.length - m[0].length - 1 : value.length)];
  }

  function visit(node: N): void {
    if (
      node.nodeName === "#text" ||
      node.nodeName === "#comment" ||
      node.nodeName === "#documentType"
    )
      return;
    const loc = node.sourceCodeLocation;
    let element: ElementNode | null = null;

    if (node.tagName && loc?.startTag) {
      const attributes: Attribute[] = [];
      for (const a of node.attrs ?? []) {
        const range = attrRange(loc.startTag, a.name, a.value);
        const al = loc.startTag.attrs?.[a.name];
        const whole: [number, number] = al
          ? [al.startOffset, al.endOffset]
          : [loc.startTag.startOffset, loc.startTag.startOffset];
        const raw = al ? text.slice(al.startOffset, al.endOffset) : "";
        const isBool = !raw.includes("=");
        const templated = /\{\{|\{%|<%|\$\{/.test(a.value);
        attributes.push({
          name: a.name,
          value: isBool
            ? { kind: "boolean" }
            : templated
              ? { kind: "dynamic", text: a.value, range: range ?? whole }
              : { kind: "static", value: a.value, range: range ?? whole },
          range: whole,
        });
      }
      const children: ChildInfo[] = [];
      for (const c of node.childNodes ?? []) {
        if (c.nodeName === "#text") {
          if (!c.value.trim()) continue;
          const m = c.value.match(TEMPLATE_EXPR);
          children.push(m ? { kind: "expression", text: m[2]! } : { kind: "text", value: c.value });
        } else if (c.tagName) children.push({ kind: "element", name: c.tagName });
      }
      const nameStart = loc.startTag.startOffset + 1;
      element = {
        name: node.tagName,
        intrinsic: true,
        attributes,
        hasSpread: false,
        nameRange: [nameStart, nameStart + node.tagName.length],
        insertAttrAt: nameStart + node.tagName.length,
        ancestors: [...stack].reverse(),
        source: "html",
        conditionalTests: [],
        children,
        getAttr: (n: string) => attributes.find((a) => a.name === n),
      };
      emit.element(element);

      const cls = element.getAttr("class");
      if (cls?.value.kind === "static") {
        emit.classList({
          tokens: splitTokens(cls.value.value, cls.value.range[0]),
          complete: true,
          element,
          origin: "attribute",
        });
      } else if (cls?.value.kind === "dynamic") {
        // Keep the static tokens of templated class attributes, minus the ones touching {{ }}.
        const tokens = splitTokens(cls.value.text, cls.value.range[0]).filter(
          (t) => !/[{}%<>$]/.test(t.value),
        );
        if (tokens.length)
          emit.classList({ tokens, complete: false, element, origin: "attribute" });
      }
      const style = element.getAttr("style");
      if (style?.value.kind === "static" && style.value.value.trim()) {
        try {
          walkCss(
            parseCss(style.value.value, "css"),
            style.value.range[0],
            true,
            emit.cssDeclaration,
          );
        } catch {
          /* invalid inline style: ignore */
        }
      }

      if (node.tagName === "style") {
        const t = node.childNodes?.[0];
        const tl = t?.sourceCodeLocation;
        if (t && tl) {
          try {
            walkCss(
              parseCss(text.slice(tl.startOffset, tl.endOffset), "scss"),
              tl.startOffset,
              false,
              emit.cssDeclaration,
            );
          } catch {
            /* ignore */
          }
        }
        return;
      }
      if (node.tagName === "script") return;

      // Text: each text node is analyzed on its own; dir="auto" elements are first-strong contexts.
      const dir = element.getAttr("dir");
      const firstStrong = dir?.value.kind === "static" && dir.value.value === "auto";
      for (const c of node.childNodes ?? []) {
        if (c.nodeName !== "#text" || !c.sourceCodeLocation || !hasRtl(c.value)) continue;
        const { startOffset, endOffset } = c.sourceCodeLocation;
        const decoded = decodeEntities(text.slice(startOffset, endOffset), startOffset);
        for (const tn of buildTextNodes(decoded, "message", {
          kind: "html-text",
          range: [startOffset, endOffset],
          rtlLocale: false,
          firstStrongContext: firstStrong,
          markEncoding: "entity",
        })) {
          if (hasRtl(tn.text)) emit.text(tn);
        }
      }
      stack.push(element);
    }

    const kids =
      node.tagName === "template" && node.content ? node.content.childNodes : node.childNodes;
    for (const c of kids ?? []) visit(c);
    if (element) stack.pop();
  }

  visit(doc);
}
