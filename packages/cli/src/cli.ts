import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import pc from "picocolors";
import { CONFIG_FILE, ConfigError, rules, SCHEMA_URL, VERSION } from "@ittijah/core";
import { json } from "./formatters/json.js";
import { pretty } from "./formatters/pretty.js";
import { sarif } from "./formatters/sarif.js";
import type { Formatter } from "./formatters/types.js";
import { run } from "./run.js";

export const EXIT = { OK: 0, PROBLEMS: 1, FATAL: 2 } as const;

const FORMATTERS: Record<string, Formatter> = { pretty, json, sarif };

const HELP = `
  ${pc.bold(pc.cyan("ittijah"))} · ${pc.bold("اتجاه")}  ${pc.dim("v" + VERSION)}
  Find RTL and bidirectional-text bugs in CSS, Tailwind, JSX/TSX, HTML and translation files.

  ${pc.bold("Usage")}
    $ ittijah [paths...] [options]

  ${pc.bold("Options")}
    --fix                    Apply safe automatic fixes
    -f, --format <name>      pretty (default) | json | sarif
    -o, --output <file>      Write the report to a file instead of stdout
    -r, --rule <id>          Only run this rule (repeatable or comma-separated)
    -c, --config <file>      Path to ittijah.config.json
    --max-warnings <n>       Exit with 1 when there are more than n warnings
    --quiet                  Report errors only
    --suggestions            Show manual suggestions (e.g. which invisible mark to insert)
    --no-gitignore           Also scan files ignored by .gitignore
    --init                   Create ittijah.config.json in the current directory
    --list-rules             List available rules
    --explain <rule>         Explain a rule and the bug it prevents
    -v, --version            Print the version
    -h, --help               Show this help

  ${pc.bold("Exit codes")}
    0  no errors (warnings allowed unless --max-warnings is exceeded)
    1  errors found, or too many warnings
    2  invalid usage or configuration

  ${pc.bold("Examples")}
    $ npx ittijah .
    $ npx ittijah src --fix
    $ npx ittijah . --format sarif -o ittijah.sarif
    $ npx ittijah locales --rule bidi-unsafe-string
`;

export async function main(argv: string[], cwd = process.cwd()): Promise<number> {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        fix: { type: "boolean" },
        format: { type: "string", short: "f" },
        output: { type: "string", short: "o" },
        rule: { type: "string", short: "r", multiple: true },
        config: { type: "string", short: "c" },
        "max-warnings": { type: "string" },
        quiet: { type: "boolean" },
        suggestions: { type: "boolean" },
        "no-gitignore": { type: "boolean" },
        "no-color": { type: "boolean" },
        color: { type: "boolean" },
        init: { type: "boolean" },
        "list-rules": { type: "boolean" },
        explain: { type: "string" },
        version: { type: "boolean", short: "v" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (e) {
    console.error(pc.red(`✖ ${(e as Error).message}`));
    console.error(pc.dim("  Run ittijah --help for usage."));
    return EXIT.FATAL;
  }
  const v = args.values;

  if (v.help) {
    console.log(HELP);
    return EXIT.OK;
  }
  if (v.version) {
    console.log(VERSION);
    return EXIT.OK;
  }
  if (v["list-rules"]) {
    console.log("");
    for (const r of rules) {
      console.log(
        `  ${pc.bold(r.meta.id.padEnd(24))} ${pc.dim(r.meta.defaultSeverity.padEnd(6))} ${r.meta.fixable ? pc.green("fixable") : pc.dim("       ")}  ${r.meta.description}`,
      );
    }
    console.log("");
    return EXIT.OK;
  }
  if (v.explain) {
    const r = rules.find((x) => x.meta.id === v.explain);
    if (!r) {
      console.error(
        pc.red(
          `✖ Unknown rule "${v.explain}". Known rules: ${rules.map((x) => x.meta.id).join(", ")}`,
        ),
      );
      return EXIT.FATAL;
    }
    console.log(
      `\n  ${pc.bold(r.meta.id)}  ${pc.dim(`(${r.meta.defaultSeverity}${r.meta.fixable ? ", fixable" : ""})`)}\n`,
    );
    console.log(`  ${r.meta.description}\n`);
    console.log(`  ${pc.bold("The bug:")} ${r.meta.bug}\n`);
    console.log(`  ${pc.bold("Applies to:")} ${r.meta.languages.join(", ")}`);
    console.log(`  ${pc.bold("Docs:")} ${pc.cyan(r.meta.docsUrl)}\n`);
    return EXIT.OK;
  }
  if (v.init) {
    const target = join(cwd, CONFIG_FILE);
    if (existsSync(target)) {
      console.error(pc.red(`✖ ${CONFIG_FILE} already exists.`));
      return EXIT.FATAL;
    }
    const config = {
      $schema: SCHEMA_URL,
      rules: Object.fromEntries(rules.map((r) => [r.meta.id, r.meta.defaultSeverity])),
      ignore: [],
      settings: { tailwind: "auto", buildTimeFlip: "auto", reactNative: "auto", iconSources: [] },
    };
    writeFileSync(target, JSON.stringify(config, null, 2) + "\n");
    console.log(`${pc.green("✔")} Created ${CONFIG_FILE}`);
    return EXIT.OK;
  }

  const format = v.format ?? "pretty";
  const formatter = FORMATTERS[format];
  if (!formatter) {
    console.error(
      pc.red(`✖ Unknown format "${format}". Use: ${Object.keys(FORMATTERS).join(", ")}.`),
    );
    return EXIT.FATAL;
  }
  const only = (v.rule ?? [])
    .flatMap((r) => r.split(","))
    .map((r) => r.trim().replace(/^ittijah\//, ""))
    .filter(Boolean);
  const unknown = only.filter((r) => !rules.some((x) => x.meta.id === r));
  if (unknown.length) {
    console.error(pc.red(`✖ Unknown rule(s): ${unknown.join(", ")}. Run ittijah --list-rules.`));
    return EXIT.FATAL;
  }
  let maxWarnings = Number.POSITIVE_INFINITY;
  if (v["max-warnings"] !== undefined) {
    maxWarnings = Number(v["max-warnings"]);
    if (!Number.isInteger(maxWarnings) || maxWarnings < 0) {
      console.error(pc.red("✖ --max-warnings expects a non-negative integer."));
      return EXIT.FATAL;
    }
  }

  let result;
  try {
    result = run({
      paths: args.positionals,
      cwd,
      fix: v.fix,
      rules: only,
      configPath: v.config,
      gitignore: !v["no-gitignore"],
    });
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error(pc.red(`✖ ${e.message}`));
      return EXIT.FATAL;
    }
    throw e;
  }
  if (result.missing.length && result.filesScanned === 0) {
    console.error(pc.red(`✖ No such file or directory: ${result.missing.join(", ")}`));
    return EXIT.FATAL;
  }

  let results = result.results;
  if (v.quiet) {
    results = results.map((r) => ({
      ...r,
      diagnostics: r.diagnostics.filter((d) => d.severity === "error"),
      warningCount: 0,
    }));
  }
  const report = formatter(results, {
    cwd,
    sources: result.sources,
    filesScanned: result.filesScanned,
    durationMs: result.durationMs,
    notices: result.notices,
    fixedCount: result.fixedCount,
    showSuggestions: !!v.suggestions,
  });
  if (v.output) {
    const target = resolve(cwd, v.output);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, report + "\n");
    if (format !== "pretty") {
      const errors = results.reduce((n, r) => n + r.errorCount, 0);
      const warnings = results.reduce((n, r) => n + r.warningCount, 0);
      console.error(
        `ittijah: ${errors} error(s), ${warnings} warning(s) in ${result.filesScanned} files → ${v.output}`,
      );
    }
  } else {
    process.stdout.write(report + "\n");
  }

  const errors = results.reduce((n, r) => n + r.errorCount, 0);
  const warnings = results.reduce((n, r) => n + r.warningCount, 0);
  if (errors > 0) return EXIT.PROBLEMS;
  if (warnings > maxWarnings) {
    console.error(pc.yellow(`▲ ${warnings} warnings exceed --max-warnings ${maxWarnings}.`));
    return EXIT.PROBLEMS;
  }
  return EXIT.OK;
}
