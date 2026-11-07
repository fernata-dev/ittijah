import { relative } from "node:path";
import { pathToFileURL } from "node:url";
import { rules, VERSION } from "@ittijah/core";
import type { Formatter } from "./types.js";

/**
 * SARIF 2.1.0 for GitHub code scanning (github/codeql-action/upload-sarif).
 * Paths are relative to %SRCROOT% (the repository root = cwd in CI).
 */
export const sarif: Formatter = (results, ctx) => {
  const ruleIndex = new Map(rules.map((r, i) => [r.meta.id, i]));
  const log = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "ittijah",
            semanticVersion: VERSION,
            informationUri: "https://github.com/fernata-dev/ittijah",
            rules: rules.map((r) => ({
              id: r.meta.id,
              name: r.meta.id.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase()),
              shortDescription: { text: r.meta.description },
              fullDescription: { text: `${r.meta.description} ${r.meta.bug}` },
              helpUri: r.meta.docsUrl,
              help: {
                text: `${r.meta.bug}\nDocs: ${r.meta.docsUrl}`,
                markdown: `${r.meta.bug}\n\n[Rule documentation](${r.meta.docsUrl})`,
              },
              defaultConfiguration: {
                level: r.meta.defaultSeverity === "error" ? "error" : "warning",
              },
              properties: {
                tags: ["i18n", "rtl", "accessibility"],
                precision: "high",
                "problem.severity": r.meta.defaultSeverity === "error" ? "error" : "warning",
              },
            })),
          },
        },
        originalUriBaseIds: { "%SRCROOT%": { uri: pathToFileURL(ctx.cwd).href + "/" } },
        results: results.flatMap((r) =>
          r.diagnostics.map((d) => ({
            ruleId: d.ruleId,
            ruleIndex: ruleIndex.get(d.ruleId) ?? 0,
            level: d.severity === "error" ? "error" : "warning",
            message: { text: d.message },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: {
                    uri: relative(ctx.cwd, r.filePath).split("\\").join("/"),
                    uriBaseId: "%SRCROOT%",
                  },
                  region: {
                    startLine: d.line,
                    startColumn: d.column,
                    endLine: d.endLine,
                    endColumn: Math.max(d.endColumn, d.column + (d.endLine === d.line ? 1 : 0)),
                  },
                },
              },
            ],
            ...(d.fix?.length
              ? {
                  fixes: [
                    {
                      description: { text: "Ittijah autofix" },
                      artifactChanges: [
                        {
                          artifactLocation: {
                            uri: relative(ctx.cwd, r.filePath).split("\\").join("/"),
                            uriBaseId: "%SRCROOT%",
                          },
                          replacements: d.fix.map((f) => ({
                            deletedRegion: {
                              charOffset: f.range[0],
                              charLength: f.range[1] - f.range[0],
                            },
                            insertedContent: { text: f.text },
                          })),
                        },
                      ],
                    },
                  ],
                }
              : {}),
          })),
        ),
      },
    ],
  };
  return JSON.stringify(log, null, 2);
};
