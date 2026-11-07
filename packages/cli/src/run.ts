import { readFileSync, writeFileSync } from "node:fs";
import {
  applyFixes,
  isIgnoredByConfig,
  lintText,
  loadConfig,
  resolveProjectInfo,
  resolveRulesForFile,
  type LintResult,
  type LoadedConfig,
} from "@ittijah/core";
import { discoverFiles, displayPath, MAX_FILE_BYTES } from "./files.js";

export interface RunOptions {
  paths: string[];
  cwd: string;
  fix?: boolean;
  rules?: string[];
  configPath?: string;
  gitignore?: boolean;
}

export interface RunResult {
  results: LintResult[];
  sources: Map<string, string>;
  filesScanned: number;
  fixedCount: number;
  notices: string[];
  missing: string[];
  config: LoadedConfig;
  durationMs: number;
}

/** Programmatic API: lint (and optionally fix) files on disk. */
export function run(opts: RunOptions): RunResult {
  const started = performance.now();
  const config = loadConfig(opts.cwd, opts.configPath);
  const { files, missing } = discoverFiles(opts.paths.length ? opts.paths : ["."], opts.cwd, { gitignore: opts.gitignore !== false });
  const results: LintResult[] = [];
  const sources = new Map<string, string>();
  const notices = new Set<string>();
  let fixedCount = 0;
  let scanned = 0;

  for (const file of files) {
    if (isIgnoredByConfig(config, file)) continue;
    let text: string;
    try {
      const buf = readFileSync(file);
      if (buf.length > MAX_FILE_BYTES) continue;
      text = buf.toString("utf8");
    } catch {
      continue; // deleted / unreadable
    }
    scanned++;
    const project = resolveProjectInfo(file, config.config.settings);
    if (project.buildTimeFlip) {
      notices.add(
        `"${project.buildTimeFlip}" flips your stylesheets at build time, so physical properties in CSS files and Tailwind classes are not reported. ` +
          `Set "settings": { "buildTimeFlip": false } in ittijah.config.json if it does not process all of your CSS.`,
      );
    }
    const rules = resolveRulesForFile(config, file, opts.rules);
    let result = lintText({ text, filePath: file, rules, project });
    if (opts.fix && result.fixableCount > 0) {
      let current = text;
      for (let pass = 0; pass < 5 && result.fixableCount > 0; pass++) {
        const { output, applied } = applyFixes(current, result.diagnostics);
        if (!applied || output === current) break;
        fixedCount += applied;
        current = output;
        result = lintText({ text: current, filePath: file, rules, project });
      }
      if (current !== text) writeFileSync(file, current);
      text = current;
    }
    if (result.diagnostics.length || result.parseError) {
      results.push(result);
      sources.set(file, text);
    }
  }
  for (const m of missing) notices.add(`Path not found: ${displayPath(m, opts.cwd)}`);
  return { results, sources, filesScanned: scanned, fixedCount, notices: [...notices], missing, config, durationMs: performance.now() - started };
}
