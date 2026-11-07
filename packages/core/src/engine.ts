import { detectLanguage, isRtlLocalePath } from "./languages/detect.js";
import type { Emitter } from "./languages/emitter.js";
import { parseCss, walkCss } from "./languages/css.js";
import { walkJs } from "./languages/js.js";
import { walkHtml } from "./languages/html.js";
import { walkJson, walkPo, walkYaml } from "./languages/translations.js";
import { hasRtl } from "./bidi/message.js";
import { parseSuppressions } from "./directives.js";
import { LineIndex } from "./location.js";
import { DEFAULT_PROJECT } from "./project.js";
import { rules as builtinRules } from "./rules/index.js";
import type {
  Diagnostic,
  FileInfo,
  Fix,
  LintResult,
  ProjectInfo,
  ResolvedRuleConfig,
  Rule,
  RuleVisitor,
} from "./types.js";

export interface LintTextOptions {
  text: string;
  filePath: string;
  /** Rules to run with their severity/options. Defaults to every rule at its default severity. */
  rules?: Map<string, ResolvedRuleConfig>;
  project?: ProjectInfo;
  /** Extra rules (plugins / tests). */
  extraRules?: Rule<never>[];
}

export function defaultRuleConfig(): Map<string, ResolvedRuleConfig> {
  return new Map(
    builtinRules.map((r) => [r.meta.id, { severity: r.meta.defaultSeverity, options: {} }]),
  );
}

/** Cheap pre-filter: can this JS/TS file possibly produce a diagnostic? */
function jsWorthParsing(text: string): boolean {
  return (
    text.includes("<") ||
    hasRtl(text) ||
    /\b(?:cn|clsx|cx|cva|tv|twMerge|classnames|classNames|twJoin)\s*\(|\btw[.`]/.test(text)
  );
}

export function lintText(opts: LintTextOptions): LintResult {
  const { text, filePath } = opts;
  const result: LintResult = {
    filePath,
    diagnostics: [],
    errorCount: 0,
    warningCount: 0,
    fixableCount: 0,
  };
  const language = detectLanguage(filePath);
  if (!language) return result;
  if (
    (language === "json" || language === "yaml" || language === "po") &&
    !hasRtl(text) &&
    !/\\u0[5-8][0-9a-fA-F]{2}/.test(text)
  )
    return result;
  if (language === "js" && !jsWorthParsing(text)) return result;

  const ruleConfig = opts.rules ?? defaultRuleConfig();
  const allRules = [...builtinRules, ...((opts.extraRules ?? []) as unknown as Rule[])];
  const project = opts.project ?? DEFAULT_PROJECT;
  const file: FileInfo = { path: filePath, language, text };
  const lines = new LineIndex(text);
  const raw: Diagnostic[] = [];

  const visitors: RuleVisitor[] = [];
  for (const rule of allRules) {
    const conf = ruleConfig.get(rule.meta.id);
    if (!conf || !rule.meta.languages.includes(language)) continue;
    const options = { ...rule.defaultOptions, ...conf.options };
    const visitor = rule.create({
      options,
      file,
      project,
      report(d) {
        const s = lines.position(d.range[0]);
        const e = lines.position(Math.max(d.range[0], d.range[1]));
        raw.push({
          ruleId: rule.meta.id,
          severity: conf.severity,
          message: d.message,
          line: s.line,
          column: s.column,
          endLine: e.line,
          endColumn: e.column,
          range: d.range,
          fix: d.fix,
          suggestions: d.suggestions,
          docsUrl: rule.meta.docsUrl,
        });
      },
    });
    if (visitor.file?.() === false) continue;
    visitors.push(visitor);
  }
  if (!visitors.length) return result;

  const emit: Emitter = {
    cssDeclaration: (n) => visitors.forEach((v) => v.cssDeclaration?.(n)),
    classList: (n) => visitors.forEach((v) => v.classList?.(n)),
    styleObject: (n) => visitors.forEach((v) => v.styleObject?.(n)),
    element: (n) => visitors.forEach((v) => v.element?.(n)),
    text: (n) => visitors.forEach((v) => v.text?.(n)),
  };

  const rtlLocale = isRtlLocalePath(filePath);
  try {
    switch (language) {
      case "css":
      case "scss":
        walkCss(parseCss(text, language), 0, false, emit.cssDeclaration);
        break;
      case "js": {
        const translationFile =
          rtlLocale &&
          /(^|[\\/])(locales?|i18n|lang|langs|translations?|messages|dictionaries)[\\/]|[\\/](ar|he|fa|ur)(?:[-_][A-Za-z]{2,4})?\.[mc]?[jt]s$/.test(
            filePath,
          );
        walkJs(text, filePath, emit, { translationFile, rtlLocale });
        break;
      }
      case "html":
        walkHtml(text, emit);
        break;
      case "json":
        walkJson(text, emit, { rtlLocale, arb: filePath.endsWith(".arb") });
        break;
      case "yaml":
        walkYaml(text, emit, { rtlLocale, arb: false });
        break;
      case "po":
        walkPo(text, emit, { rtlLocale, arb: false });
        break;
    }
  } catch (e) {
    result.parseError = e instanceof Error ? e.message.split("\n")[0] : String(e);
    return result;
  }

  const suppressions = parseSuppressions(text, new Set(allRules.map((r) => r.meta.id)));
  const seen = new Set<string>();
  for (const d of raw) {
    if (suppressions?.isSuppressed(d.line, d.ruleId)) continue;
    const key = `${d.ruleId}:${d.range[0]}:${d.range[1]}:${d.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.diagnostics.push(d);
  }
  result.diagnostics.sort((a, b) => a.range[0] - b.range[0] || a.ruleId.localeCompare(b.ruleId));
  for (const d of result.diagnostics) {
    if (d.severity === "error") result.errorCount++;
    else result.warningCount++;
    if (d.fix?.length) result.fixableCount++;
  }
  return result;
}

/** Apply non-overlapping fixes. Returns the new text and how many diagnostics were fixed. */
export function applyFixes(
  text: string,
  diagnostics: Diagnostic[],
): { output: string; applied: number } {
  const fixes = diagnostics
    .filter((d) => d.fix?.length)
    .map((d) => ({ edits: [...d.fix!].sort((a, b) => a.range[0] - b.range[0]) }))
    .sort((a, b) => a.edits[0]!.range[0] - b.edits[0]!.range[0]);
  const accepted: Fix[] = [];
  let lastEnd = -1;
  let applied = 0;
  for (const f of fixes) {
    const first = f.edits[0]!.range[0];
    if (first < lastEnd) continue;
    accepted.push(...f.edits);
    lastEnd = Math.max(...f.edits.map((e) => e.range[1]));
    // insertion fixes have zero width; keep the next one strictly after
    if (lastEnd === first) lastEnd = first + 0.5;
    applied++;
  }
  let output = text;
  for (const e of accepted.sort((a, b) => b.range[0] - a.range[0])) {
    output = output.slice(0, e.range[0]) + e.text + output.slice(e.range[1]);
  }
  return { output, applied };
}
