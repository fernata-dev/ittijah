#!/usr/bin/env node
/**
 * Validation harness: clone popular open-source projects that ship Arabic/Hebrew support,
 * run Ittijah on them, and produce a report plus a deterministic sample for manual review.
 *
 *   node scripts/validate.mjs            # clone (cached in .validation-cache) + scan
 *   node scripts/validate.mjs --sample 30 --seed 7 --tag v2
 *
 * Requires a build first: pnpm build
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CACHE = join(ROOT, ".validation-cache");
const OUT = join(ROOT, "validation");

export const REPOS = [
  {
    name: "excalidraw",
    url: "https://github.com/excalidraw/excalidraw.git",
    why: "React/TS + SCSS, ships ar-SA and he-IL",
  },
  {
    name: "cal.com",
    url: "https://github.com/calcom/cal.com.git",
    why: "Next.js + Tailwind monorepo, ships ar and he",
    sparse: [
      "apps/web",
      "packages/ui",
      "packages/features",
      "packages/app-store/_components",
      "packages/lib",
    ],
  },
  {
    name: "jitsi-meet",
    url: "https://github.com/jitsi/jitsi-meet.git",
    why: "React + SCSS, ships main-ar.json and main-he.json",
  },
  {
    name: "element-web",
    url: "https://github.com/element-hq/element-web.git",
    why: "React + PostCSS, ships ar and he",
    sparse: ["apps/web/src", "apps/web/res/css", "src", "res/css"],
  },
  {
    name: "chatwoot",
    url: "https://github.com/chatwoot/chatwoot.git",
    why: "Tailwind + SCSS + JSON locales (Vue templates are out of scope)",
    sparse: ["app/javascript", "app/assets/stylesheets", "config/locales"],
  },
];

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const sampleSize = Number(opt("--sample", 30));
const seed = Number(opt("--seed", 20261106));
const tag = opt("--tag", "latest");

function clone(repo) {
  const dir = join(CACHE, repo.name);
  if (existsSync(join(dir, ".git"))) return dir;
  mkdirSync(CACHE, { recursive: true });
  const base = ["clone", "--depth", "1", "--quiet"];
  if (repo.sparse) {
    execFileSync("git", [...base, "--filter=blob:none", "--sparse", repo.url, dir], {
      stdio: "inherit",
    });
    execFileSync(
      "git",
      [
        "-C",
        dir,
        "sparse-checkout",
        "set",
        "--no-cone",
        ...repo.sparse.map((p) => `/${p}/`),
        "/package.json",
        "/**/package.json",
      ],
      { stdio: "inherit" },
    );
  } else {
    execFileSync("git", [...base, repo.url, dir], { stdio: "inherit" });
  }
  return dir;
}

/** Small deterministic PRNG (mulberry32) so the review sample is reproducible. */
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const { run } = await import(join(ROOT, "packages/cli/dist/index.js"));
const all = [];
const summary = [];
for (const repo of REPOS) {
  process.stderr.write(`\n▶ ${repo.name}: cloning…\n`);
  const dir = clone(repo);
  const sha = execFileSync("git", ["-C", dir, "rev-parse", "--short", "HEAD"], {
    encoding: "utf8",
  }).trim();
  process.stderr.write(`  scanning ${repo.name}@${sha}…\n`);
  const result = run({ paths: ["."], cwd: dir });
  const byRule = {};
  let count = 0;
  for (const r of result.results) {
    for (const d of r.diagnostics) {
      count++;
      byRule[d.ruleId] = (byRule[d.ruleId] ?? 0) + 1;
      const src = result.sources.get(r.filePath) ?? "";
      const lines = src.split("\n");
      const context = lines.slice(Math.max(0, d.line - 3), d.line + 2).map((l, i) => {
        const n = Math.max(1, d.line - 2) + i;
        return `${n === d.line ? ">" : " "} ${String(n).padStart(5)} | ${l.length > 220 ? l.slice(0, 220) + "…" : l}`;
      });
      all.push({
        repo: repo.name,
        sha,
        file: relative(dir, r.filePath),
        line: d.line,
        column: d.column,
        ruleId: d.ruleId,
        check: d.message.match(/^\[([\w-]+)\]/)?.[1] ?? null,
        message: d.message,
        text: src.slice(d.range[0], d.range[1]),
        context: context.join("\n"),
      });
    }
  }
  const parseErrors = result.results.filter((r) => r.parseError).length;
  summary.push({
    repo: repo.name,
    sha,
    why: repo.why,
    files: result.filesScanned,
    ms: Math.round(result.durationMs),
    findings: count,
    byRule,
    parseErrors,
    notices: result.notices,
  });
  process.stderr.write(
    `  ${result.filesScanned} files, ${count} findings, ${Math.round(result.durationMs)} ms\n`,
  );
}

mkdirSync(OUT, { recursive: true });
writeFileSync(
  join(OUT, `findings-${tag}.json`),
  JSON.stringify({ summary, findings: all }, null, 2),
);

// Stratified sample: round-robin over rules so every rule is reviewed, deterministic order.
const random = rng(seed);
const byRule = new Map();
for (const f of [...all].sort(() => random() - 0.5)) {
  if (!byRule.has(f.ruleId)) byRule.set(f.ruleId, []);
  byRule.get(f.ruleId).push(f);
}
const sample = [];
while (sample.length < sampleSize && [...byRule.values()].some((l) => l.length)) {
  for (const list of byRule.values())
    if (list.length && sample.length < sampleSize) sample.push(list.shift());
}

let md = `# Ittijah validation run\n\n| Project | Commit | Files | Time | Findings | By rule | Parse errors |\n|---|---|---:|---:|---:|---|---:|\n`;
for (const s of summary) {
  md += `| ${s.repo} | ${s.sha} | ${s.files} | ${s.ms} ms | ${s.findings} | ${Object.entries(
    s.byRule,
  )
    .map(([k, v]) => `${k}: ${v}`)
    .join("<br>")} | ${s.parseErrors} |\n`;
}
md += `\n## Sample for manual review (${sample.length})\n\n`;
sample.forEach((f, i) => {
  md += `### ${i + 1}. ${f.repo} — \`${f.file}:${f.line}\` — ${f.ruleId}${f.check ? ` [${f.check}]` : ""}\n\n${f.message}\n\n\`\`\`\n${f.context}\n\`\`\`\n\nVerdict: _TBD_\n\n`;
});
writeFileSync(join(OUT, `sample-${tag}.md`), md);
writeFileSync(join(OUT, `sample-${tag}.json`), JSON.stringify(sample, null, 2));
process.stderr.write(
  `\n✔ wrote validation/findings-${tag}.json, validation/sample-${tag}.md (${all.length} findings total)\n`,
);
