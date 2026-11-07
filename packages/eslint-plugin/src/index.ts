/**
 * eslint-plugin-ittijah — a thin wrapper over @ittijah/core.
 *
 * Each ESLint rule runs the corresponding Ittijah rule on the file's source text (Ittijah parses
 * with Babel itself, so this works with any ESLint parser) and maps the diagnostics, fixes and
 * suggestions back to ESLint.
 */
import {
  lintText,
  resolveProjectInfo,
  rules as coreRules,
  VERSION,
  type IttijahSettings,
  type Rule as CoreRule,
} from "@ittijah/core";

/* Minimal structural ESLint types, so the plugin has no type dependency on a specific ESLint. */
interface SourceCode {
  text: string;
  getLocFromIndex(index: number): { line: number; column: number };
}
interface Fixer {
  replaceTextRange(range: [number, number], text: string): unknown;
}
interface RuleContext {
  filename?: string;
  physicalFilename?: string;
  sourceCode?: SourceCode;
  options: unknown[];
  settings?: { ittijah?: IttijahSettings };
  getFilename?(): string;
  getSourceCode?(): SourceCode;
  report(descriptor: {
    message: string;
    loc: { start: { line: number; column: number }; end: { line: number; column: number } };
    fix?: (fixer: Fixer) => unknown;
    suggest?: { desc: string; fix: (fixer: Fixer) => unknown }[];
  }): void;
}
export interface EslintRule {
  meta: {
    type: "problem" | "suggestion";
    docs: { description: string; url: string; recommended: boolean };
    fixable?: "code";
    hasSuggestions: boolean;
    schema: unknown[];
  };
  create(context: RuleContext): Record<string, () => void>;
}

const JS_RULES = coreRules.filter((r) => r.meta.languages.includes("js"));

function toEslintRule(rule: CoreRule): EslintRule {
  return {
    meta: {
      type:
        rule.meta.id === "no-physical-properties" || rule.meta.id === "bidi-unsafe-string"
          ? "problem"
          : "suggestion",
      docs: { description: rule.meta.description, url: rule.meta.docsUrl, recommended: true },
      ...(rule.meta.fixable ? { fixable: "code" as const } : {}),
      hasSuggestions: true,
      schema: [{ type: "object", additionalProperties: true }],
    },
    create(context) {
      const sourceCode = context.sourceCode ?? context.getSourceCode!();
      const filename =
        context.physicalFilename ?? context.filename ?? context.getFilename?.() ?? "file.tsx";
      return {
        "Program:exit"() {
          const project = resolveProjectInfo(filename, context.settings?.ittijah ?? {});
          const options = (context.options[0] as Record<string, unknown> | undefined) ?? {};
          const result = lintText({
            text: sourceCode.text,
            // Ittijah picks parsers by extension; unknown extensions (e.g. .vue via a processor) fall back to TSX.
            filePath: /\.[cm]?[jt]sx?$/.test(filename) ? filename : `${filename}.tsx`,
            project,
            rules: new Map([[rule.meta.id, { severity: "error", options }]]),
          });
          for (const d of result.diagnostics) {
            const loc = {
              start: sourceCode.getLocFromIndex(d.range[0]),
              end: sourceCode.getLocFromIndex(d.range[1]),
            };
            context.report({
              message: d.message,
              loc,
              fix: d.fix?.length
                ? (fixer) => d.fix!.map((f) => fixer.replaceTextRange(f.range, f.text))
                : undefined,
              suggest: d.suggestions?.map((s) => ({
                desc: s.desc,
                fix: (fixer: Fixer) => s.fix.map((f) => fixer.replaceTextRange(f.range, f.text)),
              })),
            });
          }
        },
      };
    },
  };
}

export const rules: Record<string, EslintRule> = Object.fromEntries(
  JS_RULES.map((r) => [r.meta.id, toEslintRule(r)]),
);

const recommendedRules = Object.fromEntries(
  JS_RULES.map((r) => [`ittijah/${r.meta.id}`, r.meta.defaultSeverity]),
);

const plugin = {
  meta: { name: "eslint-plugin-ittijah", version: VERSION },
  rules,
  configs: {} as Record<string, unknown>,
};

/** Flat config: `import ittijah from "eslint-plugin-ittijah"; export default [ittijah.configs.recommended];` */
plugin.configs.recommended = {
  name: "ittijah/recommended",
  plugins: { ittijah: plugin },
  rules: recommendedRules,
};
/** Legacy (.eslintrc) config: `extends: ["plugin:ittijah/legacy-recommended"]`. */
plugin.configs["legacy-recommended"] = { plugins: ["ittijah"], rules: recommendedRules };

export default plugin;
