/**
 * Bidi analysis based on the Unicode Bidirectional Algorithm (UAX #9).
 *
 * Instead of running the full algorithm we look for four patterns whose mis-rendering is
 * *deterministic* once the paragraph is right-to-left — i.e. the result does not depend on
 * fonts, the browser or the value of a placeholder. Everything else is deliberately ignored:
 * the rule must not cry wolf.
 *
 *  leading-ltr         first strong character is Latin / a placeholder (rule P2/P3)
 *  neutral-before-ltr  "@user", "#tag", "--fix", "/path", ".env" after RTL text (rule N1/N2)
 *  neutral-after-ltr   "C++", "C#", "Disney+", "Brand®" followed by RTL text (rule N1/N2)
 *  signed-number       "-5", "+20 100 123" after RTL text (rules W4–W7, N1, L2)
 */
import { ISOLATED, PH_NUMERIC, PH_UNKNOWN } from "./message.js";

export type BidiClass =
  "R" | "L" | "EN" | "AN" | "WS" | "ON" | "NSM" | "PH" | "PN" | "ISO" | "LRM" | "RLM";

const AL_OR_R =
  /[\u0590-\u05FF\u0608\u060B\u060D\u061B-\u064A\u066D-\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const NSM_IN_RTL =
  /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/;
const LETTER = /\p{L}/u;
const MARK = /\p{M}/u;

export function bidiClass(ch: string): BidiClass {
  switch (ch) {
    case PH_UNKNOWN:
      return "PH";
    case PH_NUMERIC:
      return "PN";
    case ISOLATED:
      return "ISO";
    case "\u200E":
      return "LRM";
    case "\u200F":
    case "\u061C":
      return "RLM";
  }
  const code = ch.codePointAt(0)!;
  if (code >= 0x30 && code <= 0x39) return "EN";
  if (code >= 0x06f0 && code <= 0x06f9) return "EN";
  if ((code >= 0x0660 && code <= 0x0669) || code === 0x066b || code === 0x066c) return "AN";
  if (/\s/.test(ch)) return "WS";
  if (NSM_IN_RTL.test(ch)) return "NSM";
  if (AL_OR_R.test(ch)) return "R";
  if (code >= 0x10800 && code <= 0x10fff) return "R";
  if (code >= 0x1e800 && code <= 0x1efff) return "R";
  if (MARK.test(ch)) return "NSM";
  if (LETTER.test(ch)) return "L";
  return "ON";
}

export type Check = "leading-ltr" | "neutral-before-ltr" | "neutral-after-ltr" | "signed-number";

export interface Finding {
  check: Check;
  /** Index range in the analyzed text (end exclusive). */
  start: number;
  end: number;
  message: string;
  /** Where an invisible mark should be inserted, and which one. */
  mark?: { index: number; after: boolean; char: "\u200E" | "\u200F" };
}

export interface AnalyzeOptions {
  /** Run the leading-ltr check (only meaningful where direction is auto-detected). */
  firstStrong: boolean;
  /** The text is known to belong to an RTL locale. */
  rtlLocale: boolean;
  checks?: Partial<Record<Check, boolean>>;
}

/** Characters that, glued in front of a Latin word, jump to its far side in RTL text. */
const PREFIX_NEUTRALS = new Set(["@", "#", "$", "/", "\\", "~", "-", "."]);
/** Characters that, glued after a Latin word, jump to its near side in RTL text. */
const SUFFIX_NEUTRALS = new Set(["+", "#", "\u2122", "\u00AE", "\u2120"]);
/** What may follow a suffix run for it to be "the end of the Latin token". */
const AFTER_SUFFIX = /[\s\u060C\u061B\u061F.,:;!?)\]]/;
const SIGNS = new Set(["-", "+", "\u2212"]);

function classify(text: string): BidiClass[] {
  const cls: BidiClass[] = new Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const c = bidiClass(String.fromCodePoint(text.codePointAt(i)!));
      cls[i] = c;
      cls[i + 1] = c;
      i++;
      continue;
    }
    cls[i] = bidiClass(text[i]!);
  }
  // W1: non-spacing marks take the class of the preceding character.
  for (let i = 0; i < cls.length; i++) {
    if (cls[i] === "NSM") cls[i] = i > 0 ? cls[i - 1]! : "ON";
  }
  return cls;
}

/** Is the paragraph this text forms right-to-left? */
function isRtlParagraph(cls: BidiClass[], rtlLocale: boolean): boolean {
  let r = 0;
  let l = 0;
  for (const c of cls) {
    if (c === "R") r++;
    else if (c === "L") l++;
  }
  if (r === 0) return false;
  return rtlLocale || r >= l;
}

const NEUTRALISH = new Set<BidiClass>(["WS", "ON", "ISO"]);

/** Nearest strong-ish class scanning backwards from `i` (exclusive); "sos" at the start. */
function strongBefore(cls: BidiClass[], i: number): BidiClass | "sos" {
  for (let k = i - 1; k >= 0; k--) {
    if (!NEUTRALISH.has(cls[k]!)) return cls[k]!;
  }
  return "sos";
}

function strongAfter(cls: BidiClass[], i: number): BidiClass | "eos" {
  for (let k = i; k < cls.length; k++) {
    if (!NEUTRALISH.has(cls[k]!)) return cls[k]!;
  }
  return "eos";
}

const isStrongR = (c: BidiClass | "sos" | "eos") => c === "R" || c === "RLM";

function show(
  text: string,
  placeholders: Map<number, string> | undefined,
  start: number,
  end: number,
): string {
  let out = "";
  for (let i = start; i < end; i++) {
    const ch = text[i]!;
    if (ch === PH_UNKNOWN || ch === PH_NUMERIC) out += placeholders?.get(i) ?? "{\u2026}";
    else if (ch === ISOLATED) out += "\u2026";
    else out += ch;
  }
  return out;
}

export function analyzeText(
  text: string,
  options: AnalyzeOptions,
  placeholders?: Map<number, string>,
): Finding[] {
  const findings: Finding[] = [];
  const cls = classify(text);
  if (!isRtlParagraph(cls, options.rtlLocale)) return findings;
  const enabled = (c: Check) => options.checks?.[c] !== false;

  // ---- leading-ltr -------------------------------------------------------------------
  if (options.firstStrong && enabled("leading-ltr")) {
    for (let i = 0; i < cls.length; i++) {
      const c = cls[i]!;
      if (c === "R" || c === "RLM" || c === "LRM") break; // explicit marks are deliberate
      if (c === "L" || c === "PH") {
        let end = i;
        while (end < cls.length && cls[end] !== "R") end++;
        while (end > i && /\s/.test(text[end - 1]!)) end--;
        const lead = show(text, placeholders, i, end);
        const what = c === "PH" ? `the placeholder ${lead}` : `Latin text "${lead}"`;
        const ifValue =
          c === "PH" ? " If its value is Latin (names, e-mails, product names\u2026)," : "";
        findings.push({
          check: "leading-ltr",
          start: i,
          end,
          message:
            `This Arabic/Hebrew string starts with ${what} before any RTL letter.${ifValue} ` +
            `wherever direction is detected from the first strong character \u2014 dir="auto", <title>, ` +
            `push notifications, e-mail subjects, Android/iOS default text direction \u2014 the whole ` +
            `string is laid out left-to-right: the RTL words come out in reversed order and ` +
            `trailing punctuation lands on the wrong side. Start the string with U+200F ` +
            `RIGHT-TO-LEFT MARK, or wrap the leading part in FSI (U+2068) \u2026 PDI (U+2069).`,
          mark: { index: 0, after: false, char: "\u200F" },
        });
        break;
      }
    }
  }

  // ---- neutral-before-ltr: "@ittijah" -> "ittijah@" ----------------------------------
  if (enabled("neutral-before-ltr")) {
    for (let i = 0; i < text.length; i++) {
      if (!PREFIX_NEUTRALS.has(text[i]!)) continue;
      if (i > 0 && cls[i - 1] !== "WS") continue;
      let j = i;
      while (j < text.length && PREFIX_NEUTRALS.has(text[j]!)) j++;
      if (j - i > 3 || j >= text.length) {
        i = j;
        continue;
      }
      const next = cls[j]!;
      if (next !== "L" && next !== "PH") {
        i = j;
        continue;
      }
      if (!isStrongR(strongBefore(cls, i))) {
        i = j;
        continue;
      }
      let wordEnd = j;
      while (wordEnd < text.length && cls[wordEnd] !== "WS" && cls[wordEnd] !== "R") wordEnd++;
      const prefix = text.slice(i, j);
      const word = show(text, placeholders, j, wordEnd);
      const valueNote =
        next === "PH"
          ? " (assuming the placeholder holds Latin text, as handles and paths do)"
          : "";
      findings.push({
        check: "neutral-before-ltr",
        start: i,
        end: wordEnd,
        message:
          `"${prefix}${word}" renders as "${word}${prefix}"${valueNote}. "${prefix}" is a neutral ` +
          `character sitting between RTL text and a Latin word, so the bidi algorithm gives it the ` +
          `paragraph's RTL direction and moves it to the far side of the word. Insert U+200E ` +
          `LEFT-TO-RIGHT MARK before "${prefix}", or isolate the token with LRI (U+2066) \u2026 PDI ` +
          `(U+2069) / <bdi>.`,
        mark: { index: i, after: false, char: "\u200E" },
      });
      i = wordEnd;
    }
  }

  // ---- neutral-after-ltr: "C++" -> "++C" ---------------------------------------------
  if (enabled("neutral-after-ltr")) {
    for (let i = 0; i < text.length - 1; i++) {
      if (cls[i] !== "L" || !SUFFIX_NEUTRALS.has(text[i + 1]!)) continue;
      let j = i + 1;
      while (j < text.length && SUFFIX_NEUTRALS.has(text[j]!)) j++;
      if (j < text.length && !AFTER_SUFFIX.test(text[j]!)) continue;
      const after = strongAfter(cls, j);
      if (!(isStrongR(after) || after === "eos")) continue;
      let wordStart = i;
      while (wordStart > 0 && cls[wordStart - 1] !== "WS" && cls[wordStart - 1] !== "R")
        wordStart--;
      if (cls[wordStart] !== "L") continue;
      const suffix = text.slice(i + 1, j);
      const word = show(text, placeholders, wordStart, i + 1);
      findings.push({
        check: "neutral-after-ltr",
        start: wordStart,
        end: j,
        message:
          `"${word}${suffix}" renders as "${suffix}${word}". "${suffix}" sits between a Latin word ` +
          `and ${after === "eos" ? "the end of an RTL paragraph" : "RTL text"}, so it takes the RTL ` +
          `direction and is drawn on the wrong side of "${word}". Insert U+200E LEFT-TO-RIGHT MARK ` +
          `after "${suffix}", or isolate the token with LRI (U+2066) \u2026 PDI (U+2069) / <bdi>.`,
        mark: { index: j - 1, after: true, char: "\u200E" },
      });
      i = j;
    }
  }

  // ---- signed-number: "-5" -> "5-", "+20 100 123" -> "123 100 20+" -------------------
  if (enabled("signed-number")) {
    for (let i = 0; i < text.length - 1; i++) {
      const sign = text[i]!;
      if (!SIGNS.has(sign)) continue;
      // A sign must stand alone: "ל-998" / "ب-5" is a hyphen joining a prefix to a number,
      // which resolves correctly (RTL on both sides, rule N1). Only " -5" / "^-5" are signs.
      if (i > 0 && cls[i - 1] !== "WS") continue;
      const next = cls[i + 1]!;
      if (next !== "EN" && next !== "AN" && next !== "PN") continue;
      const before = strongBefore(cls, i);
      if (!(isStrongR(before) || before === "sos")) continue;
      // collect the number and, for "+", following digit groups (phone numbers)
      let end = i + 1;
      const groups: string[] = [];
      let g = end;
      while (end < text.length && (cls[end] === "EN" || cls[end] === "AN" || cls[end] === "PN"))
        end++;
      groups.push(show(text, placeholders, g, end));
      if (sign === "+") {
        for (;;) {
          let k = end;
          while (k < text.length && (text[k] === " " || text[k] === "-")) k++;
          if (k === end || k >= text.length || !(cls[k] === "EN" || cls[k] === "AN")) break;
          g = k;
          while (k < text.length && (cls[k] === "EN" || cls[k] === "AN")) k++;
          groups.push(text.slice(g, k));
          end = k;
        }
        const digits = groups.join("").replace(/\D/g, "").length;
        // "+3 more" is legitimately read either way in Arabic UIs; only phone numbers are bugs.
        if (next === "PN" || (groups.length < 2 && digits < 7)) continue;
      }
      if (end < text.length && cls[end] === "L") continue; // "-5px", "+1x": part of a Latin token
      const logical = show(text, placeholders, i, end);
      const visual =
        sign === "+" ? `${[...groups].reverse().join(" ")}${sign}` : `${groups.join("")}${sign}`;
      findings.push({
        check: "signed-number",
        start: i,
        end,
        message:
          `"${logical}" renders as "${visual}" in RTL text. The "${sign}" is not attached to the ` +
          `number by the bidi algorithm (it is only joined to digits on both sides), so it resolves ` +
          `to the surrounding RTL direction and is drawn on the far side${sign === "+" ? "; the digit groups are reordered right-to-left as well" : ""}. ` +
          `Wrap the number in LRI (U+2066) \u2026 PDI (U+2069) or put U+200E LEFT-TO-RIGHT MARK before "${sign}".`,
        mark: { index: i, after: false, char: "\u200E" },
      });
      i = end;
    }
  }
  return findings;
}
