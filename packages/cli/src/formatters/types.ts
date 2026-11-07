import type { LintResult } from "@ittijah/core";

export interface ReportContext {
  cwd: string;
  /** File contents by absolute path, for code frames. */
  sources: Map<string, string>;
  filesScanned: number;
  durationMs: number;
  notices: string[];
  fixedCount: number;
  showSuggestions: boolean;
}

export type Formatter = (results: LintResult[], ctx: ReportContext) => string;
