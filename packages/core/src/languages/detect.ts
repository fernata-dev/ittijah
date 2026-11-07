import type { Language } from "../types.js";

const BY_EXTENSION: Record<string, Language> = {
  css: "css",
  pcss: "css",
  postcss: "css",
  scss: "scss",
  js: "js",
  jsx: "js",
  mjs: "js",
  cjs: "js",
  ts: "js",
  tsx: "js",
  mts: "js",
  cts: "js",
  html: "html",
  htm: "html",
  json: "json",
  arb: "json",
  yml: "yaml",
  yaml: "yaml",
  po: "po",
};

export const SUPPORTED_EXTENSIONS = Object.keys(BY_EXTENSION);

export function detectLanguage(filePath: string): Language | null {
  const base = filePath.split(/[\\/]/).pop() ?? filePath;
  if (/\.d\.[mc]?ts$/.test(base)) return null; // type declarations hold no UI
  if (/\.min\.(js|css)$/.test(base)) return null; // minified bundles
  if (/^(package-lock|composer|tsconfig|jsconfig)\.json$|^pnpm-lock\.yaml$/.test(base)) return null;
  const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : "";
  return BY_EXTENSION[ext] ?? null;
}

/** BCP-47 primary subtags of languages written right-to-left. */
export const RTL_LANGS = new Set([
  "ar",
  "arc",
  "ckb",
  "dv",
  "fa",
  "he",
  "iw",
  "ks",
  "ku-arab",
  "pa-arab",
  "ps",
  "sd",
  "ug",
  "ur",
  "yi",
  "syr",
  "nqo",
  "az-arab",
  "prs",
  "bal",
  "glk",
  "mzn",
  "lrc",
]);

export function isRtlLang(tag: string): boolean {
  const t = tag.trim().toLowerCase().replace(/_/g, "-");
  if (/-arab\b|-hebr\b|-thaa\b|-syrc\b|-nkoo\b|-adlm\b|-rohg\b/.test(t)) return true;
  return RTL_LANGS.has(t.split("-")[0] ?? "");
}

/** Does the path look like the RTL locale of a translation catalog? (ar.json, locales/he/, fa_IR.po…) */
export function isRtlLocalePath(filePath: string): boolean {
  const parts = filePath.toLowerCase().split(/[\\/]/);
  const base = parts.pop() ?? "";
  const stem = base.replace(/\.(json|arb|ya?ml|po)$/, "");
  const candidates = [stem, ...stem.split(/[.]/), ...parts.slice(-3)];
  // app_ar.arb, messages.ar.json, strings-he.json, app_fa_IR.arb
  const segs = stem.split(/[._-]/);
  candidates.push(segs[segs.length - 1]!);
  if (segs.length >= 2) candidates.push(`${segs[segs.length - 2]}-${segs[segs.length - 1]}`);
  return candidates.some((c) => /^[a-z]{2,3}([-_][a-z0-9]{2,4})?$/.test(c) && isRtlLang(c));
}
