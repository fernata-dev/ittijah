import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import fg from "fast-glob";
import ignore from "ignore";
import { detectLanguage, SUPPORTED_EXTENSIONS } from "@ittijah/core";

/** Paths never worth scanning, even when tracked by git. */
const DEFAULT_IGNORES = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/out/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.svelte-kit/**",
  "**/.turbo/**",
  "**/.vercel/**",
  "**/.output/**",
  "**/coverage/**",
  "**/vendor/**",
  "**/bower_components/**",
  "**/storybook-static/**",
  "**/*.min.*",
  "**/*.bundle.*",
  "**/*.map",
  "**/package-lock.json",
  "**/pnpm-lock.yaml",
  "**/yarn.lock",
];

const defaultIgnore = ignore().add(DEFAULT_IGNORES.map((g) => g.replace(/^\*\*\//, "")));

export const MAX_FILE_BYTES = 1_500_000;

export interface DiscoveryOptions {
  gitignore: boolean;
}

function gitFiles(dir: string): string[] | null {
  try {
    const out = execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--deduplicate"],
      {
        cwd: dir,
        encoding: "utf8",
        maxBuffer: 512 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return out.split("\0").filter(Boolean);
  } catch {
    return null;
  }
}

function globFiles(dir: string, useGitignore: boolean): string[] {
  const files = fg.sync(`**/*.{${SUPPORTED_EXTENSIONS.join(",")}}`, {
    cwd: dir,
    dot: false,
    ignore: DEFAULT_IGNORES,
    followSymbolicLinks: false,
    suppressErrors: true,
  });
  const gi = join(dir, ".gitignore");
  if (!useGitignore || !existsSync(gi)) return files;
  const ig = ignore().add(readFileSync(gi, "utf8"));
  return files.filter((f) => !ig.ignores(f));
}

/** Resolve CLI path arguments to absolute file paths Ittijah can lint. */
export function discoverFiles(
  paths: string[],
  cwd: string,
  opts: DiscoveryOptions,
): { files: string[]; missing: string[] } {
  const out = new Set<string>();
  const missing: string[] = [];
  for (const p of paths) {
    const abs = resolve(cwd, p);
    if (!existsSync(abs)) {
      missing.push(p);
      continue;
    }
    const st = statSync(abs);
    if (st.isFile()) {
      if (detectLanguage(abs)) out.add(abs);
      continue;
    }
    const listed = (opts.gitignore ? gitFiles(abs) : null) ?? globFiles(abs, opts.gitignore);
    for (const rel of listed) {
      if (!detectLanguage(rel) || defaultIgnore.ignores(rel)) continue;
      out.add(join(abs, rel));
    }
  }
  return { files: [...out].sort(), missing };
}

export function displayPath(abs: string, cwd: string): string {
  const rel = relative(cwd, abs);
  return rel.startsWith("..") ? abs : rel;
}
