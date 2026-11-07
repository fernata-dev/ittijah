/**
 * Translation catalogs: JSON (i18next, next-intl, vue-i18n, FormatJS…), ARB (Flutter),
 * YAML (Rails, Symfony…) and gettext PO.
 */
import { parseTree, type Node as JsonNode, type ParseError } from "jsonc-parser";
import { isMap, isPair, isScalar, isSeq, parseAllDocuments, type Node as YamlNode } from "yaml";
import { buildTextNodes, concatDecoded, decodeEscapes, hasRtl, pinned, plain, type Decoded, type TextNodeBase } from "../bidi/message.js";
import type { Emitter } from "./emitter.js";

export interface TranslationOptions {
  rtlLocale: boolean;
  arb: boolean;
}

function emitString(emit: Emitter, decoded: Decoded, range: [number, number], key: string, opts: TranslationOptions, markEncoding: TextNodeBase["markEncoding"]) {
  const base: TextNodeBase = { kind: "translation", range, key, rtlLocale: opts.rtlLocale, firstStrongContext: true, markEncoding };
  for (const tn of buildTextNodes(decoded, "message", base)) if (hasRtl(tn.text)) emit.text(tn);
}

export function walkJson(text: string, emit: Emitter, opts: TranslationOptions): void {
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (!root) throw new Error("Invalid JSON");
  const visit = (node: JsonNode, path: string[]) => {
    if (node.type === "object") {
      for (const prop of node.children ?? []) {
        const [k, v] = prop.children ?? [];
        if (!k || !v) continue;
        const key = String(k.value);
        if (opts.arb && key.startsWith("@")) continue; // ARB metadata
        visit(v, [...path, key]);
      }
    } else if (node.type === "array") {
      (node.children ?? []).forEach((c, i) => visit(c, [...path, String(i)]));
    } else if (node.type === "string") {
      const raw = text.slice(node.offset + 1, node.offset + node.length - 1);
      if (!hasRtl(raw) && !/\\u0[5-8]|\\u[fF][bBcCdDeE]/.test(raw)) return;
      emitString(emit, decodeEscapes(raw, node.offset + 1), [node.offset, node.offset + node.length], path.join("."), opts, "escape");
    }
  };
  visit(root, []);
}

export function walkYaml(text: string, emit: Emitter, opts: TranslationOptions): void {
  const documents = parseAllDocuments(text, { strict: false, uniqueKeys: false });
  for (const doc of Array.isArray(documents) ? documents : []) {
    const visit = (node: YamlNode | null | undefined, path: string[]) => {
      if (!node) return;
      if (isMap(node)) {
        for (const pair of node.items) {
          if (!isPair(pair)) continue;
          const k = isScalar(pair.key) ? String(pair.key.value) : "?";
          visit(pair.value as YamlNode, [...path, k]);
        }
      } else if (isSeq(node)) {
        node.items.forEach((item, i) => visit(item as YamlNode, [...path, String(i)]));
      } else if (isScalar(node) && typeof node.value === "string" && node.range) {
        const value = node.value;
        if (!hasRtl(value)) return;
        const [start, valueEnd] = node.range;
        const raw = text.slice(start, valueEnd);
        let decoded: Decoded;
        let enc: TextNodeBase["markEncoding"] = "none";
        if (node.type === "PLAIN" && raw === value) decoded = plain(raw, start);
        else if (node.type === "QUOTE_DOUBLE" && !raw.includes("\n")) {
          decoded = decodeEscapes(raw.slice(1, -1), start + 1);
          enc = "escape";
        } else if (node.type === "QUOTE_SINGLE" && !raw.includes("\n") && !raw.includes("''")) decoded = plain(raw.slice(1, -1), start + 1);
        else decoded = pinned(value, start, valueEnd);
        emitString(emit, decoded, [start, valueEnd], path.join("."), opts, enc);
      }
    };
    visit(doc.contents as YamlNode, []);
  }
}

/** Minimal gettext PO parser: analyzes msgstr / msgstr[n] values. */
export function walkPo(text: string, emit: Emitter, opts: TranslationOptions): void {
  const lineRe = /^(.*)$/gm;
  let m: RegExpExecArray | null;
  let current: { field: string; parts: Decoded[]; start: number; end: number } | null = null;
  let msgid = "";
  const flush = () => {
    if (!current) return;
    if (current.field === "msgid") msgid = current.parts.map((p) => p.text).join("");
    else if (current.field.startsWith("msgstr")) {
      const decoded = concatDecoded(current.parts);
      if (hasRtl(decoded.text)) emitString(emit, decoded, [current.start, current.end], msgid, opts, "none");
    }
    current = null;
  };
  while ((m = lineRe.exec(text))) {
    const line = m[1]!;
    const lineStart = m.index;
    if (m[0].length === 0) lineRe.lastIndex++;
    const trimmed = line.trimStart();
    if (trimmed.startsWith("#")) {
      flush();
      continue;
    }
    const field = trimmed.match(/^(msgctxt|msgid_plural|msgid|msgstr(?:\[\d+\])?)\s+"/);
    const strMatch = line.match(/"((?:[^"\\]|\\.)*)"\s*$/);
    if (field) {
      flush();
      current = { field: field[1]!, parts: [], start: lineStart, end: lineStart + line.length };
    }
    if (current && strMatch && (field || trimmed.startsWith('"'))) {
      const rawStart = lineStart + line.lastIndexOf('"' + strMatch[1]! + '"') + 1;
      current.parts.push(decodeEscapes(strMatch[1]!, rawStart));
      current.end = lineStart + line.length;
    } else if (!trimmed) flush();
  }
  flush();
}
