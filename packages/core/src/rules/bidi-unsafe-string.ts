import picomatch from "picomatch";
import { analyzeText, type Check } from "../bidi/analyze.js";
import type { Rule, RuleContext, Suggestion, TextNode } from "../types.js";
import { docsUrl } from "./util.js";

export interface Options {
  /**
   * Check strings that start with Latin text / a placeholder (opt-in). They only break where
   * direction is detected from the first strong character — OS notifications, <title>,
   * e-mail subjects, dir="auto" — not inside a dir="rtl" page. Validation on real projects
   * showed most such strings are only rendered in-page, so this is off by default.
   */
  leadingLtr: boolean;
  /** Enable/disable individual checks. */
  checks: Partial<Record<Check, boolean>>;
  /** Translation keys to skip (globs, e.g. "legal.*"). */
  ignoreKeys: string[];
}

const MARK_NAMES: Record<string, { escape: string; entity: string; name: string }> = {
  "\u200E": { escape: "\\u200E", entity: "&lrm;", name: "LRM" },
  "\u200F": { escape: "\\u200F", entity: "&rlm;", name: "RLM" },
};

export const bidiUnsafeString: Rule<Options> = {
  meta: {
    id: "bidi-unsafe-string",
    description: "Detect Arabic/Hebrew strings whose punctuation, handles, signed numbers or leading Latin text are reordered by the Unicode Bidirectional Algorithm.",
    bug: "In Arabic UI text, \"follow us on @ittijah\" is displayed with the handle as \"ittijah@\", and a temperature of -5 is displayed as \"5-\": the bidi algorithm moves neutral characters to the wrong side.",
    docsUrl: docsUrl("bidi-unsafe-string"),
    defaultSeverity: "error",
    fixable: false,
    languages: ["js", "html", "json", "yaml", "po"],
  },
  defaultOptions: { leadingLtr: false, checks: {}, ignoreKeys: [] },

  create(ctx: RuleContext<Options>) {
    const ignoreKey = ctx.options.ignoreKeys.length ? picomatch(ctx.options.ignoreKeys) : null;
    return {
      text(node: TextNode) {
        if (node.key && ignoreKey?.(node.key)) return;
        const findings = analyzeText(
          node.text,
          { firstStrong: node.firstStrongContext && ctx.options.leadingLtr, rtlLocale: node.rtlLocale, checks: ctx.options.checks },
          node.placeholders,
        );
        for (const f of findings) {
          const start = node.offsets[f.start] ?? node.range[0];
          const end = node.ends[Math.max(f.start, f.end - 1)] ?? node.range[1];
          let suggestions: Suggestion[] | undefined;
          if (f.mark && node.markEncoding !== "none") {
            const at = f.mark.after ? node.ends[f.mark.index] : node.offsets[f.mark.index];
            const mark = MARK_NAMES[f.mark.char]!;
            if (at !== undefined) {
              suggestions = [{ desc: `Insert ${mark.name} (${mark[node.markEncoding]})`, fix: [{ range: [at, at], text: mark[node.markEncoding] }] }];
            }
          }
          ctx.report({
            message: `[${f.check}] ${f.message}${node.key ? ` (key: ${node.key})` : ""}`,
            range: [start, Math.max(start, end)],
            suggestions,
          });
        }
      },
    };
  },
};
