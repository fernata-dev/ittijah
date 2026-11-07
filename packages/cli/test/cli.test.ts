import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearProjectCache } from "@ittijah/core";
import { main } from "../src/cli.js";

let dir: string;
let out: string[];
let err: string[];

function project(files: Record<string, string>, git = false) {
  dir = mkdtempSync(join(tmpdir(), "ittijah-cli-"));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  if (git) execFileSync("git", ["init", "-q"], { cwd: dir });
  return dir;
}

beforeEach(() => {
  clearProjectCache();
  out = [];
  err = [];
  vi.spyOn(process.stdout, "write").mockImplementation((s) => (out.push(String(s)), true));
  vi.spyOn(console, "log").mockImplementation((...a) => void out.push(a.join(" ")));
  vi.spyOn(console, "error").mockImplementation((...a) => void err.push(a.join(" ")));
});
afterEach(() => vi.restoreAllMocks());

const CSS = ".a { margin-left: 4px; }\n";
const AR = JSON.stringify({ a: "تابعنا على @ittijah" });

describe("ittijah CLI", () => {
  it("exits 0 when clean", async () => {
    project({ "a.css": ".a { margin-inline-start: 4px; }" });
    expect(await main(["."], dir)).toBe(0);
    expect(out.join("")).toContain("No RTL problems found");
  });

  it("exits 1 on errors and prints a code frame", async () => {
    project({ "a.css": CSS });
    expect(await main(["."], dir)).toBe(1);
    const text = out.join("");
    expect(text).toContain("margin-left");
    expect(text).toContain("^^^^^^^^^^^");
  });

  it("warnings exit 0 unless --max-warnings is exceeded", async () => {
    project({ "a.html": '<textarea name="bio"></textarea>' });
    expect(await main(["."], dir)).toBe(0);
    expect(await main([".", "--max-warnings", "0"], dir)).toBe(1);
  });

  it("--fix rewrites files", async () => {
    project({ "a.css": CSS });
    expect(await main([".", "--fix"], dir)).toBe(0);
    expect(readFileSync(join(dir, "a.css"), "utf8")).toBe(".a { margin-inline-start: 4px; }\n");
  });

  it("--rule restricts rules", async () => {
    project({ "a.css": CSS, "locales/ar.json": AR });
    expect(await main([".", "--rule", "bidi-unsafe-string", "--format", "json"], dir)).toBe(1);
    const report = JSON.parse(out.join(""));
    expect(report.results.flatMap((r: { diagnostics: { ruleId: string }[] }) => r.diagnostics.map((d) => d.ruleId))).toEqual(["bidi-unsafe-string"]);
  });

  it("json format", async () => {
    project({ "locales/ar.json": AR });
    await main([".", "-f", "json"], dir);
    const report = JSON.parse(out.join(""));
    expect(report.summary.errors).toBe(1);
    expect(report.results[0].filePath).toBe("locales/ar.json");
    expect(report.results[0].diagnostics[0]).toMatchObject({ line: 1, text: "@ittijah", ruleId: "bidi-unsafe-string" });
  });

  it("sarif format is valid SARIF 2.1.0 with relative URIs", async () => {
    project({ "src/a.css": CSS });
    await main([".", "--format", "sarif", "-o", "out.sarif"], dir);
    const sarif = JSON.parse(readFileSync(join(dir, "out.sarif"), "utf8"));
    expect(sarif.version).toBe("2.1.0");
    const run = sarif.runs[0];
    expect(run.tool.driver.rules.map((r: { id: string }) => r.id)).toContain("no-physical-properties");
    expect(run.results[0]).toMatchObject({
      ruleId: "no-physical-properties",
      level: "error",
      locations: [{ physicalLocation: { artifactLocation: { uri: "src/a.css", uriBaseId: "%SRCROOT%" }, region: { startLine: 1, startColumn: 6 } } }],
    });
    expect(run.results[0].fixes[0].artifactChanges[0].replacements[0].insertedContent.text).toBe("margin-inline-start");
  });

  it("respects .gitignore in git repositories", async () => {
    project({ ".gitignore": "generated/\n", "generated/a.css": CSS, "src/ok.css": ".a{}" }, true);
    expect(await main(["."], dir)).toBe(0);
    expect(await main([".", "--no-gitignore"], dir)).toBe(1);
  });

  it("respects .gitignore outside git too", async () => {
    project({ ".gitignore": "generated/\n", "generated/a.css": CSS });
    expect(await main(["."], dir)).toBe(0);
  });

  it("skips node_modules and minified files", async () => {
    project({ "node_modules/x/a.css": CSS, "dist/app.min.css": CSS });
    expect(await main(["."], dir)).toBe(0);
  });

  it("config: ignore + rule off", async () => {
    project({ "a.css": CSS, "legacy/b.css": CSS, "ittijah.config.json": JSON.stringify({ ignore: ["legacy/**"], rules: { "no-physical-properties": "warn" } }) });
    expect(await main(["."], dir)).toBe(0);
    expect(out.join("")).toContain("1 problem");
  });

  it("invalid config exits 2", async () => {
    project({ "ittijah.config.json": JSON.stringify({ rules: { nope: "error" } }) });
    expect(await main(["."], dir)).toBe(2);
    expect(err.join("")).toContain('unknown rule "nope"');
  });

  it("bad usage exits 2", async () => {
    project({});
    expect(await main(["--format", "xml"], dir)).toBe(2);
    expect(await main(["--rule", "nope"], dir)).toBe(2);
    expect(await main(["--bogus"], dir)).toBe(2);
    expect(await main(["missing-dir"], dir)).toBe(2);
  });

  it("--init writes a config with $schema", async () => {
    project({});
    expect(await main(["--init"], dir)).toBe(0);
    const cfg = JSON.parse(readFileSync(join(dir, "ittijah.config.json"), "utf8"));
    expect(cfg.$schema).toContain("ittijah.config.schema.json");
    expect(await main(["--init"], dir)).toBe(2);
  });

  it("notices build-time flipping", async () => {
    project({ "package.json": JSON.stringify({ devDependencies: { rtlcss: "^4.0.0" } }), "a.css": CSS });
    expect(await main(["."], dir)).toBe(0);
    expect(out.join("")).toContain('"rtlcss" flips your stylesheets');
  });

  it("--list-rules, --explain, --version, --help", async () => {
    project({});
    expect(await main(["--list-rules"], dir)).toBe(0);
    expect(await main(["--explain", "bidi-unsafe-string"], dir)).toBe(0);
    expect(out.join("")).toContain("The bug:");
    expect(await main(["--version"], dir)).toBe(0);
    expect(await main(["-h"], dir)).toBe(0);
  });
});
