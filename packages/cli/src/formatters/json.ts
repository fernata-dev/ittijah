import { relative } from "node:path";
import { VERSION } from "@ittijah/core";
import type { Formatter } from "./types.js";

export const json: Formatter = (results, ctx) =>
  JSON.stringify(
    {
      tool: { name: "ittijah", version: VERSION },
      summary: {
        filesScanned: ctx.filesScanned,
        filesWithProblems: results.filter((r) => r.diagnostics.length).length,
        errors: results.reduce((n, r) => n + r.errorCount, 0),
        warnings: results.reduce((n, r) => n + r.warningCount, 0),
        fixable: results.reduce((n, r) => n + r.fixableCount, 0),
        fixed: ctx.fixedCount,
        durationMs: Math.round(ctx.durationMs),
        notices: ctx.notices,
      },
      results: results
        .filter((r) => r.diagnostics.length || r.parseError)
        .map((r) => ({
          filePath: relative(ctx.cwd, r.filePath).split("\\").join("/"),
          errorCount: r.errorCount,
          warningCount: r.warningCount,
          parseError: r.parseError,
          diagnostics: r.diagnostics.map((d) => ({
            ruleId: d.ruleId,
            severity: d.severity,
            message: d.message,
            line: d.line,
            column: d.column,
            endLine: d.endLine,
            endColumn: d.endColumn,
            text: ctx.sources.get(r.filePath)?.slice(d.range[0], d.range[1]),
            fixable: !!d.fix?.length,
            suggestions: d.suggestions?.map((s) => s.desc),
            docsUrl: d.docsUrl,
          })),
        })),
    },
    null,
    2,
  );
