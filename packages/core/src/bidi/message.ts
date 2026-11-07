/**
 * Turns raw source strings into `TextNode`s ready for bidi analysis:
 *  1. decode escapes while keeping a per-character map back to source offsets;
 *  2. collapse placeholders ({name}, %s, {{x}}, ICU plural/select…) to sentinel characters;
 *  3. collapse already-isolated chunks (FSI…PDI, <bdi>…</bdi>, dir="…" spans) to a sentinel;
 *  4. drop inline markup tags (<b>, </0>, <br/>) which do not affect bidi resolution.
 */
import type { TextNode } from "../types.js";

export const PH_UNKNOWN = "\uE000";
export const PH_NUMERIC = "\uE001";
export const ISOLATED = "\uE002";

export interface Decoded {
  text: string;
  offsets: number[];
  ends: number[];
}

/** Characters from Hebrew, Arabic, Syriac, Thaana, NKo… and their presentation forms. */
export const RTL_CHAR =
  /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]|\uD802[\uDC00-\uDFFF]|\uD83A[\uDC00-\uDFFF]/;

export function hasRtl(s: string): boolean {
  return RTL_CHAR.test(s);
}

/** Identity decoding: every character maps to `base + i`. */
export function plain(raw: string, base: number): Decoded {
  const offsets = new Array<number>(raw.length);
  const ends = new Array<number>(raw.length);
  for (let i = 0; i < raw.length; i++) {
    offsets[i] = base + i;
    ends[i] = base + i + 1;
  }
  return { text: raw, offsets, ends };
}

/** Same offset for every character (used when exact mapping is impossible, e.g. YAML block scalars). */
export function pinned(text: string, start: number, end: number): Decoded {
  return {
    text,
    offsets: new Array<number>(text.length).fill(start),
    ends: new Array<number>(text.length).fill(end),
  };
}

const SIMPLE_ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
  v: "\v",
  "0": "\0",
  e: "\x1b",
  a: "\x07",
  N: "\u0085",
  _: "\u00A0",
  L: "\u2028",
  P: "\u2029",
};

/**
 * Decode C-like escapes used by JSON, JS, YAML double-quoted scalars and PO files.
 * `raw` is the content between the quotes; `base` its source offset.
 */
export function decodeEscapes(raw: string, base: number): Decoded {
  if (!raw.includes("\\")) return plain(raw, base);
  let text = "";
  const offsets: number[] = [];
  const ends: number[] = [];
  const push = (s: string, start: number, end: number) => {
    for (let k = 0; k < s.length; k++) {
      text += s[k];
      offsets.push(base + start);
      ends.push(base + end);
    }
  };
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i]!;
    if (ch !== "\\" || i === raw.length - 1) {
      push(ch, i, i + 1);
      i++;
      continue;
    }
    const next = raw[i + 1]!;
    let m: RegExpMatchArray | null;
    if (next === "u" && raw[i + 2] === "{" && (m = raw.slice(i).match(/^\\u\{([0-9a-fA-F]+)\}/))) {
      push(String.fromCodePoint(parseInt(m[1]!, 16)), i, i + m[0].length);
      i += m[0].length;
    } else if (next === "u" && (m = raw.slice(i).match(/^\\u([0-9a-fA-F]{4})/))) {
      push(String.fromCharCode(parseInt(m[1]!, 16)), i, i + 6);
      i += 6;
    } else if (next === "U" && (m = raw.slice(i).match(/^\\U([0-9a-fA-F]{8})/))) {
      push(String.fromCodePoint(parseInt(m[1]!, 16)), i, i + 10);
      i += 10;
    } else if (next === "x" && (m = raw.slice(i).match(/^\\x([0-9a-fA-F]{2})/))) {
      push(String.fromCharCode(parseInt(m[1]!, 16)), i, i + 4);
      i += 4;
    } else if (next === "\n") {
      i += 2; // line continuation
    } else if (next === "\r") {
      i += raw[i + 2] === "\n" ? 3 : 2;
    } else {
      push(SIMPLE_ESCAPES[next] ?? next, i, i + 2);
      i += 2;
    }
  }
  return { text, offsets, ends };
}

export function concatDecoded(parts: Decoded[]): Decoded {
  return {
    text: parts.map((p) => p.text).join(""),
    offsets: parts.flatMap((p) => p.offsets),
    ends: parts.flatMap((p) => p.ends),
  };
}

// ---------------------------------------------------------------------------------------
// Placeholders
// ---------------------------------------------------------------------------------------

const NUMERIC_NAME =
  /^(?:n|i|count|cnt|num|number|total|amount|qty|quantity|index|idx|page|pages|size|length|len|percent|percentage|pct|year|years|month|months|week|weeks|day|days|hour|hours|minute|minutes|mins?|second|seconds|secs?|max|min|limit|remaining|step|steps|current|price|cost|balance|score|points|rating|age|duration|time|date|datetime|progress|ratio|level|rank|position|order|sum|average|avg|value|val)$/i;
const NUMERIC_SUFFIX =
  /(?:Count|Number|Num|Total|Amount|Qty|Index|Size|Length|Percent|Price|Score|Points|Seconds|Minutes|Hours|Days|Date|Time|Id|ID)$|_(?:count|number|num|total|amount|price|date|time|id)$|^(?:id|ID)$/;

/** Heuristic: does a placeholder name denote a number/date (direction-neutral content)? */
export function isNumericName(name: string): boolean {
  const last =
    name
      .trim()
      .split(/[.\s[\]]/)
      .filter(Boolean)
      .pop() ?? "";
  return (
    NUMERIC_NAME.test(last) || NUMERIC_SUFFIX.test(last) || /^(?:num|count|total)[A-Z_]/.test(last)
  );
}

interface Token {
  start: number;
  end: number;
  /** Replacement sentinel, or "" to drop the token entirely. */
  replacement: string;
  raw: string;
}

const ISOLATE_OPEN = /[\u2066\u2067\u2068\u202A\u202B\u202D\u202E]/;

/** Find the matching `}` for a `{` at `start`, honoring nesting. Returns -1 if unbalanced. */
function matchBrace(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

interface Branch {
  start: number;
  end: number; // exclusive, content only
  plural: boolean;
}

/**
 * Tokenize a decoded message. ICU plural/select arguments are collapsed in the outer message
 * and their branch contents are returned separately so each branch is analyzed on its own.
 */
function tokenize(s: string, pluralContext: boolean): { tokens: Token[]; branches: Branch[] } {
  const tokens: Token[] = [];
  const branches: Branch[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    const rest = () => s.slice(i);
    let m: RegExpMatchArray | null;

    // Unicode isolates / embeddings: the content is already protected.
    if (ISOLATE_OPEN.test(c)) {
      const closer = c >= "\u2066" ? "\u2069" : "\u202C";
      const close = s.indexOf(closer, i + 1);
      const end = close === -1 ? s.length : close + 1;
      tokens.push({ start: i, end, replacement: ISOLATED, raw: s.slice(i, end) });
      i = end;
      continue;
    }

    if (c === "<") {
      // <bdi>…</bdi>, <bdo>…</bdo>, <x dir="…">…</x>: isolated.
      if (
        (m = rest().match(/^<(bdi|bdo)\b[^<>]*>[\s\S]*?<\/\1\s*>/i)) ||
        (m = rest().match(/^<([A-Za-z0-9]+)\b[^<>]*\bdir\s*=[^<>]*>[\s\S]*?<\/\1\s*>/))
      ) {
        tokens.push({ start: i, end: i + m[0].length, replacement: ISOLATED, raw: m[0] });
        i += m[0].length;
        continue;
      }
      // Other inline markup is transparent for bidi.
      if ((m = rest().match(/^<\/?[A-Za-z0-9][\w.:-]*(\s[^<>]*)?\/?>/))) {
        tokens.push({ start: i, end: i + m[0].length, replacement: "", raw: m[0] });
        i += m[0].length;
        continue;
      }
    }

    if (c === "{") {
      // {{ name }} / {{{ name }}} (i18next, Handlebars, vue-i18n, Angular)
      if ((m = rest().match(/^\{\{\{?\s*([^{}]*?)\s*\}?\}\}/))) {
        const name = m[1]!.split(/[,|]/)[0]!.replace(/^[-#/^>&]\s*/, "");
        tokens.push({
          start: i,
          end: i + m[0].length,
          replacement: isNumericName(name) ? PH_NUMERIC : PH_UNKNOWN,
          raw: m[0],
        });
        i += m[0].length;
        continue;
      }
      // ICU complex argument: {count, plural, one {…} other {…}}
      if ((m = rest().match(/^\{\s*([\w.$-]+)\s*,\s*(plural|selectordinal|select)\s*,/))) {
        const close = matchBrace(s, i);
        if (close !== -1) {
          const kind = m[2]!;
          tokens.push({
            start: i,
            end: close + 1,
            replacement: kind === "select" ? PH_UNKNOWN : PH_NUMERIC,
            raw: s.slice(i, close + 1),
          });
          // collect branches
          let j = i + m[0].length;
          while (j < close) {
            const open = s.indexOf("{", j);
            if (open === -1 || open > close) break;
            const end = matchBrace(s, open);
            if (end === -1 || end > close) break;
            branches.push({ start: open + 1, end, plural: kind !== "select" });
            j = end + 1;
          }
          i = close + 1;
          continue;
        }
      }
      // ICU simple argument: {name} / {name, number} / {0}
      if ((m = rest().match(/^\{\s*([\w.$-]+)\s*(?:,\s*(\w+)[^{}]*)?\}/))) {
        const type = m[2];
        const numeric = type
          ? /^(number|date|time|duration|spellout|ordinal)$/.test(type)
          : isNumericName(m[1]!);
        tokens.push({
          start: i,
          end: i + m[0].length,
          replacement: numeric ? PH_NUMERIC : PH_UNKNOWN,
          raw: m[0],
        });
        i += m[0].length;
        continue;
      }
    }

    if (c === "%") {
      if (s[i + 1] === "%") {
        i += 2;
        continue;
      }
      // Rails %{name}, Python %(name)s, printf/iOS %1$s %d %@ %.2f %lld
      if ((m = rest().match(/^%\{([\w.]+)\}/)) || (m = rest().match(/^%<([\w.]+)>[a-z]/))) {
        tokens.push({
          start: i,
          end: i + m[0].length,
          replacement: isNumericName(m[1]!) ? PH_NUMERIC : PH_UNKNOWN,
          raw: m[0],
        });
        i += m[0].length;
        continue;
      }
      if ((m = rest().match(/^%\(([\w.]+)\)[-+ 0#]*\d*(?:\.\d+)?([sdifeEgGxXrc])/))) {
        const numeric = /[difeEgGxX]/.test(m[2]!) || isNumericName(m[1]!);
        tokens.push({
          start: i,
          end: i + m[0].length,
          replacement: numeric ? PH_NUMERIC : PH_UNKNOWN,
          raw: m[0],
        });
        i += m[0].length;
        continue;
      }
      if (
        (m = rest().match(
          /^%(?:\d+\$)?[-+ 0#']*\d*(?:\.\d+)?(?:hh|h|ll|l|q|z|t|j)?([sdiufFeEgGxXoc@])/,
        ))
      ) {
        const numeric = /[diufFeEgGxXo]/.test(m[1]!);
        tokens.push({
          start: i,
          end: i + m[0].length,
          replacement: numeric ? PH_NUMERIC : PH_UNKNOWN,
          raw: m[0],
        });
        i += m[0].length;
        continue;
      }
    }

    if (c === "$") {
      // i18next nesting $t(key) and ${name}
      if ((m = rest().match(/^\$t\([^()]*\)/)) || (m = rest().match(/^\$\{\s*([\w.]+)\s*\}/))) {
        tokens.push({
          start: i,
          end: i + m[0].length,
          replacement: m[1] && isNumericName(m[1]) ? PH_NUMERIC : PH_UNKNOWN,
          raw: m[0],
        });
        i += m[0].length;
        continue;
      }
    }

    if (c === "#" && pluralContext) {
      tokens.push({ start: i, end: i + 1, replacement: PH_NUMERIC, raw: "#" });
      i++;
      continue;
    }
    i++;
  }
  return { tokens, branches };
}

export type MessageFormat = "message" | "plain";

export interface TextNodeBase {
  kind: TextNode["kind"];
  range: [number, number];
  key?: string;
  rtlLocale: boolean;
  firstStrongContext: boolean;
  markEncoding: TextNode["markEncoding"];
}

function apply(
  decoded: Decoded,
  from: number,
  to: number,
  tokens: Token[],
  base: TextNodeBase,
): TextNode {
  let text = "";
  const offsets: number[] = [];
  const ends: number[] = [];
  const placeholders = new Map<number, string>();
  let i = from;
  const relevant = tokens
    .filter((t) => t.start >= from && t.end <= to)
    .sort((a, b) => a.start - b.start);
  for (const t of relevant) {
    for (; i < t.start; i++) {
      text += decoded.text[i];
      offsets.push(decoded.offsets[i]!);
      ends.push(decoded.ends[i]!);
    }
    if (t.replacement) {
      placeholders.set(text.length, t.raw);
      text += t.replacement;
      offsets.push(decoded.offsets[t.start]!);
      ends.push(decoded.ends[t.end - 1]!);
    }
    i = t.end;
  }
  for (; i < to; i++) {
    text += decoded.text[i];
    offsets.push(decoded.offsets[i]!);
    ends.push(decoded.ends[i]!);
  }
  return { ...base, text, offsets, ends, placeholders };
}

/**
 * Build one or more TextNodes from a decoded string. With format "message", placeholder
 * syntaxes are recognized; ICU plural/select branches become additional TextNodes.
 */
export function buildTextNodes(
  decoded: Decoded,
  format: MessageFormat,
  base: TextNodeBase,
): TextNode[] {
  if (format === "plain") return [apply(decoded, 0, decoded.text.length, [], base)];
  const out: TextNode[] = [];
  const visit = (from: number, to: number, pluralContext: boolean) => {
    const slice = decoded.text.slice(from, to);
    const { tokens, branches } = tokenize(slice, pluralContext);
    const shifted = tokens.map((t) => ({ ...t, start: t.start + from, end: t.end + from }));
    out.push(apply(decoded, from, to, shifted, base));
    for (const b of branches) visit(b.start + from, b.end + from, b.plural);
  };
  visit(0, decoded.text.length, false);
  return out;
}
