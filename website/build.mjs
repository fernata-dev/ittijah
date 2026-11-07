#!/usr/bin/env node
/**
 * Builds the static website into website/dist:
 *  - copies index.html + assets
 *  - bundles the playground (the real analyzer from packages/core) with esbuild
 *  - renders Markdown docs (README, rules, validation, …) into a docs layout
 */
import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SITE, "..");
const DIST = join(SITE, "dist");
const REPO = "https://github.com/fernata-dev/ittijah";

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, "assets"), { recursive: true });
cpSync(join(SITE, "index.html"), join(DIST, "index.html"));
cpSync(join(SITE, "assets"), join(DIST, "assets"), { recursive: true });

await build({
  entryPoints: [join(SITE, "src/playground-entry.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "IttijahPlayground",
  target: "es2020",
  outfile: join(DIST, "assets/playground.js"),
  logLevel: "warning",
});

// source markdown (repo-relative) -> output page (dist-relative)
const PAGES = [
  { src: "README.md", out: "docs/getting-started.html", title: "Getting started", group: "Guide" },
  { src: "README.ar.md", out: "docs/arabic.html", title: "بالعربي", group: "Guide", rtl: true },
  {
    src: "docs/design-decisions.md",
    out: "docs/design-decisions.html",
    title: "Design decisions",
    group: "Guide",
  },
  {
    src: "docs/validation.md",
    out: "docs/validation.html",
    title: "Validation report",
    group: "Guide",
  },
  {
    src: "docs/rules/no-physical-properties.md",
    out: "rules/no-physical-properties.html",
    title: "no-physical-properties",
    group: "Rules",
  },
  {
    src: "docs/rules/directional-icons.md",
    out: "rules/directional-icons.html",
    title: "directional-icons",
    group: "Rules",
  },
  {
    src: "docs/rules/bidi-unsafe-string.md",
    out: "rules/bidi-unsafe-string.html",
    title: "bidi-unsafe-string",
    group: "Rules",
  },
  {
    src: "docs/rules/missing-dir-attribute.md",
    out: "rules/missing-dir-attribute.html",
    title: "missing-dir-attribute",
    group: "Rules",
  },
  {
    src: "docs/authoring-rules.md",
    out: "docs/authoring-rules.html",
    title: "Writing a rule",
    group: "Contributing",
  },
  {
    src: "CONTRIBUTING.md",
    out: "docs/contributing.html",
    title: "Contributing",
    group: "Contributing",
  },
  { src: "CHANGELOG.md", out: "docs/changelog.html", title: "Changelog", group: "Contributing" },
];
const bySrc = new Map(PAGES.map((p) => [p.src, p]));

function rewriteLinks(html, page) {
  const fromDir = posix.dirname(page.out);
  return html.replace(/href="([^"#:]+?)(#[^"]*)?"/g, (m, target, hash = "") => {
    const resolved = posix
      .normalize(posix.join(posix.dirname(page.src), target))
      .replace(/\/$/, "");
    const hit = bySrc.get(resolved);
    if (hit) return `href="${posix.relative(fromDir, hit.out) || posix.basename(hit.out)}${hash}"`;
    return `href="${REPO}/blob/main/${resolved}${hash}"`;
  });
}

function layout(page, body) {
  const rel = (p) => posix.relative(posix.dirname(page.out), p) || ".";
  const groups = [...new Set(PAGES.map((p) => p.group))];
  const nav = groups
    .map(
      (g) =>
        `<h4>${g}</h4>` +
        PAGES.filter((p) => p.group === g)
          .map(
            (p) => `<a href="${rel(p.out)}"${p === page ? ' class="active"' : ""}>${p.title}</a>`,
          )
          .join(""),
    )
    .join("");
  return `<!doctype html>
<html lang="${page.rtl ? "ar" : "en"}" dir="${page.rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${page.title} · Ittijah</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Inter:wght@400;600;700;800&display=swap" />
<link rel="stylesheet" href="${rel("assets/site.css")}" />
</head>
<body>
<header class="nav"><div class="wrap">
<a class="logo" href="${rel("index.html")}"><span class="logo-mark">ا</span> ittijah <span class="ar">اتجاه</span></a>
<nav class="nav-links"><a href="${rel("index.html")}#playground">Playground</a><a href="${rel("docs/getting-started.html")}">Docs</a><a class="btn" href="${REPO}">GitHub</a></nav>
</div></header>
<div class="wrap docs">
<nav aria-label="Documentation">${nav}</nav>
<article class="prose">
<!-- ittijah-disable -->
${body}
<!-- ittijah-enable -->
<p style="margin-block-start:48px"><a href="${REPO}/edit/main/${page.src}">Edit this page on GitHub</a></p>
</article>
</div>
</body>
</html>
`;
}

for (const page of PAGES) {
  let md = readFileSync(join(ROOT, page.src), "utf8");
  // the README's centered hero is redundant inside the docs layout
  md = md.replace(/^<div align="center">[\s\S]*?<\/div>\n/, `# ${page.title}\n`);
  const html = rewriteLinks(marked.parse(md, { gfm: true }), page);
  const target = join(DIST, page.out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, layout(page, html));
}

console.log(`✔ website built → ${relative(ROOT, DIST)} (${PAGES.length} doc pages + landing)`);
