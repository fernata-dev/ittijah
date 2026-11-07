import { describe, expect, it } from "vitest";
import { applyFixes, lintText } from "../src/engine.js";
import { DEFAULT_PROJECT } from "../src/project.js";
import type { ProjectInfo, Rule } from "../src/types.js";

export interface ValidCase {
  name?: string;
  code: string;
  filename: string;
  project?: Partial<ProjectInfo>;
  options?: Record<string, unknown>;
}

export interface InvalidCase extends ValidCase {
  /** Expected number of diagnostics, or substrings each diagnostic message must contain (in order). */
  errors: number | string[];
  /** Expected output after applying fixes (omit when no fix is expected). */
  output?: string;
  /** Expected text of the first suggestion's inserted text. */
  suggestion?: string;
}

export const TAILWIND: Partial<ProjectInfo> = {
  tailwind: { enabled: true, version: "^3.4.0", logical: true, logicalFloat: true },
};

function run(rule: Rule, c: ValidCase) {
  const project: ProjectInfo = {
    ...DEFAULT_PROJECT,
    ...c.project,
    tailwind: { ...DEFAULT_PROJECT.tailwind, ...c.project?.tailwind },
  };
  const result = lintText({
    text: c.code,
    filePath: c.filename,
    project,
    rules: new Map([[rule.meta.id, { severity: "error", options: c.options ?? {} }]]),
  });
  if (result.parseError) throw new Error(`parse error in fixture: ${result.parseError}`);
  return result;
}

export function testRule(rule: Rule, cases: { valid: ValidCase[]; invalid: InvalidCase[] }): void {
  describe(rule.meta.id, () => {
    describe("valid (no report)", () => {
      cases.valid.forEach((c, i) => {
        it(c.name ?? `#${i + 1} ${c.filename}: ${c.code.slice(0, 60).replace(/\s+/g, " ")}`, () => {
          const r = run(rule, c);
          expect(r.diagnostics.map((d) => d.message)).toEqual([]);
        });
      });
    });
    describe("invalid (reported)", () => {
      cases.invalid.forEach((c, i) => {
        it(c.name ?? `#${i + 1} ${c.filename}: ${c.code.slice(0, 60).replace(/\s+/g, " ")}`, () => {
          const r = run(rule, c);
          if (typeof c.errors === "number")
            expect(r.diagnostics.length, r.diagnostics.map((d) => d.message).join("\n")).toBe(
              c.errors,
            );
          else {
            expect(r.diagnostics.length, r.diagnostics.map((d) => d.message).join("\n")).toBe(
              c.errors.length,
            );
            c.errors.forEach((frag, k) => expect(r.diagnostics[k]!.message).toContain(frag));
          }
          for (const d of r.diagnostics) {
            expect(d.line).toBeGreaterThan(0);
            expect(d.range[1]).toBeGreaterThanOrEqual(d.range[0]);
          }
          if (c.output !== undefined)
            expect(applyFixes(c.code, r.diagnostics).output).toBe(c.output);
          else expect(r.diagnostics.filter((d) => d.fix?.length).length).toBe(0);
          if (c.suggestion !== undefined)
            expect(r.diagnostics[0]!.suggestions?.[0]?.fix[0]?.text).toBe(c.suggestion);
        });
      });
    });
  });
}
