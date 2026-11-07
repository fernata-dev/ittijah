#!/usr/bin/env node
/**
 * Performance check for the "5k files in under 10 s" requirement.
 * Generates a synthetic project of N realistic files (TSX, CSS, SCSS, HTML, JSON locales)
 * and times a full `ittijah` scan. Usage: node scripts/bench.mjs [files=5000]
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const N = Number(process.argv[2] ?? 5000);
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const { run } = await import(join(ROOT, "packages/cli/dist/index.js"));

const tsx = (i) => `import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
export function Card${i}({ item, comment, onClick }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border p-4", open && "bg-muted")}>
      <img src={item.image} alt="" className="h-10 w-10 rounded-full ml-2" />
      <div className="flex-1">
        <h3 className="font-semibold text-start">{item.title}</h3>
        <p className="text-sm text-muted-foreground">{item.subtitle}</p>
        <p>{comment.body}</p>
      </div>
      <button onClick={() => setOpen(!open)} aria-label="open">
        <ChevronRight className="h-4 w-4 rtl:rotate-180" />
      </button>
      <input type="text" dir="auto" placeholder="ابحث" />
    </div>
  );
}
`.repeat(3);
const css = (i) => `.c${i} { display: flex; margin-left: 8px; padding-inline: 4px; }
.c${i}__title { font-weight: 600; text-align: left; }
.c${i}__badge { position: absolute; top: 0; right: 0; }
@media (max-width: 600px) { .c${i} { margin: 0 auto; } }
`.repeat(10);
const json = (i) => JSON.stringify(Object.fromEntries(Array.from({ length: 60 }, (_, k) => [`key_${i}_${k}`, k % 7 === 0 ? "تابعنا على @ittijah" : `نص عربي رقم ${k} مع {name} و {count}`])), null, 2);
const html = (i) => `<!doctype html><html lang="ar" dir="rtl"><head><title>صفحة ${i}</title><style>.x{float:left}</style></head><body><main class="container"><p>مرحبا</p><input type="search"></main></body></html>`;

const dir = mkdtempSync(join(tmpdir(), "ittijah-bench-"));
writeFileSync(join(dir, "package.json"), JSON.stringify({ devDependencies: { tailwindcss: "^4.1.0" } }));
for (let i = 0; i < N; i++) {
  const sub = join(dir, "src", `m${i % 50}`);
  mkdirSync(sub, { recursive: true });
  const k = i % 10;
  if (k < 5) writeFileSync(join(sub, `Card${i}.tsx`), tsx(i));
  else if (k < 7) writeFileSync(join(sub, `s${i}.${k === 5 ? "css" : "scss"}`), css(i));
  else if (k < 9) writeFileSync(join(sub, `ar_${i}.json`), json(i));
  else writeFileSync(join(sub, `p${i}.html`), html(i));
}
const t0 = performance.now();
const result = run({ paths: ["."], cwd: dir });
const ms = performance.now() - t0;
const findings = result.results.reduce((n, r) => n + r.diagnostics.length, 0);
console.log(`${result.filesScanned} files, ${findings} findings in ${(ms / 1000).toFixed(2)} s (${(result.filesScanned / (ms / 1000)).toFixed(0)} files/s)`);
rmSync(dir, { recursive: true, force: true });
if (ms > 10_000) {
  console.error("✖ slower than the 10 s budget");
  process.exit(1);
}
