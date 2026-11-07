import pc from "picocolors";
import { VERSION, type Diagnostic, type LintResult } from "@ittijah/core";
import { displayPath } from "../files.js";
import type { Formatter, ReportContext } from "./types.js";

const width = () => Math.max(60, Math.min(process.stdout.columns || 100, 140));

function wrap(text: string, indent: number, max: number): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && line.length + 1 + w.length > max - indent) {
      lines.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines.join("\n" + " ".repeat(indent));
}

/** Render invisible bidi controls visibly so the terminal shows what the file contains. */
function visible(s: string): string {
  return s.replace(/[‎‏؜‪-‮⁦-⁩]/g, (c) => pc.magenta(`<U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}>`)).replace(/\t/g, " ");
}

function codeFrame(source: string, d: Diagnostic): string {
  const lines = source.split("\n");
  const lineText = (lines[d.line - 1] ?? "").replace(/\r$/, "");
  const gutter = String(d.line + 1).length;
  const out: string[] = [];
  const MAX = width() - gutter - 10;
  // keep long (minified) lines readable: window around the column
  let start = 0;
  if (lineText.length > MAX) start = Math.max(0, Math.min(d.column - 1 - Math.floor(MAX / 3), lineText.length - MAX));
  const slice = (t: string) => (start > 0 ? "…" : "") + t.slice(start, start + MAX) + (t.length > start + MAX ? "…" : "");
  if (d.line > 1 && lineText.length <= MAX) {
    const prev = (lines[d.line - 2] ?? "").replace(/\r$/, "");
    if (prev.trim()) out.push(pc.dim(`  ${String(d.line - 1).padStart(gutter)} │ ${slice(prev).replace(/\t/g, " ")}`));
  }
  out.push(`${pc.red(">")} ${pc.dim(String(d.line).padStart(gutter))} ${pc.dim("│")} ${visible(slice(lineText))}`);
  const caretStart = d.column - 1 - start + (start > 0 ? 1 : 0);
  const caretLen = d.endLine === d.line ? Math.max(1, d.endColumn - d.column) : Math.max(1, lineText.length - d.column + 1);
  out.push(`  ${" ".repeat(gutter)} ${pc.dim("│")} ${" ".repeat(Math.max(0, caretStart))}${pc.red("^".repeat(Math.min(caretLen, MAX - caretStart)))}`);
  return out.map((l) => "    " + l).join("\n");
}

export const pretty: Formatter = (results: LintResult[], ctx: ReportContext) => {
  const out: string[] = [];
  const w = width();
  out.push("");
  out.push(`  ${pc.bold(pc.cyan("ittijah"))} ${pc.dim("·")} ${pc.bold("اتجاه")}  ${pc.dim(`v${VERSION} — RTL & bidi linter`)}`);
  out.push("");
  for (const n of ctx.notices) out.push(`  ${pc.blue("ℹ")} ${wrap(n, 4, w)}`);
  if (ctx.notices.length) out.push("");

  let errors = 0;
  let warnings = 0;
  let fixable = 0;
  const byRule = new Map<string, number>();
  const parseErrors: LintResult[] = [];
  for (const r of results) {
    if (r.parseError) parseErrors.push(r);
    if (!r.diagnostics.length) continue;
    errors += r.errorCount;
    warnings += r.warningCount;
    fixable += r.fixableCount;
    out.push(`  ${pc.underline(pc.bold(displayPath(r.filePath, ctx.cwd)))}`);
    const source = ctx.sources.get(r.filePath) ?? "";
    for (const d of r.diagnostics) {
      byRule.set(d.ruleId, (byRule.get(d.ruleId) ?? 0) + 1);
      const sev = d.severity === "error" ? pc.red("✖ error") : pc.yellow("▲ warn ");
      const loc = pc.dim(`${d.line}:${d.column}`.padEnd(8));
      const tags = [pc.dim(d.ruleId), d.fix?.length ? pc.green("fixable") : ""].filter(Boolean).join(pc.dim(" · "));
      out.push(`  ${loc}${sev}  ${tags}`);
      out.push(`          ${wrap(d.message, 10, w)}`);
      if (source) out.push(codeFrame(source, d));
      if (ctx.showSuggestions && d.suggestions?.length) {
        for (const s of d.suggestions) out.push(`          ${pc.cyan("💡")} ${pc.cyan(s.desc)}`);
      }
      out.push("");
    }
  }

  const total = errors + warnings;
  const secs = (ctx.durationMs / 1000).toFixed(2);
  if (parseErrors.length) {
    out.push(`  ${pc.yellow("▲")} ${parseErrors.length} file(s) could not be parsed and were skipped:`);
    for (const r of parseErrors.slice(0, 5)) out.push(pc.dim(`      ${displayPath(r.filePath, ctx.cwd)} — ${r.parseError}`));
    if (parseErrors.length > 5) out.push(pc.dim(`      … and ${parseErrors.length - 5} more (use --format json to see all)`));
    out.push("");
  }
  if (ctx.fixedCount) out.push(`  ${pc.green("✔")} Fixed ${ctx.fixedCount} problem(s).`);
  if (total === 0) {
    out.push(`  ${pc.green("✔")} ${pc.bold("No RTL problems found")} ${pc.dim(`in ${ctx.filesScanned} files (${secs}s)`)}`);
  } else {
    const parts = [errors ? pc.red(`${errors} error${errors === 1 ? "" : "s"}`) : "", warnings ? pc.yellow(`${warnings} warning${warnings === 1 ? "" : "s"}`) : ""].filter(Boolean);
    out.push(`  ${errors ? pc.red("✖") : pc.yellow("▲")} ${pc.bold(`${total} problem${total === 1 ? "" : "s"}`)} (${parts.join(", ")}) ${pc.dim(`in ${ctx.filesScanned} files (${secs}s)`)}`);
    out.push(`    ${pc.dim([...byRule.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${n}`).join(" · "))}`);
    if (fixable) out.push(`    ${pc.green(`${fixable} fixable with`)} ${pc.bold("--fix")}`);
  }
  out.push("");
  return out.join("\n");
};
