import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse as parsePath } from "node:path";
import type { IttijahSettings, ProjectInfo } from "./types.js";

/**
 * Packages that rewrite CSS for RTL at build time. When present, physical properties in
 * stylesheets are flipped automatically, so reporting them would be a false positive.
 */
export const BUILD_TIME_FLIPPERS = [
  "rtlcss",
  "postcss-rtlcss",
  "postcss-rtl",
  "rtlcss-webpack-plugin",
  "webpack-rtl-plugin",
  "@rspack/plugin-rtlcss",
  "gulp-rtlcss",
  "grunt-rtlcss",
  "cssjanus",
  "postcss-cssjanus",
  "rtl-css-js",
];

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const pkgCache = new Map<string, PackageJson | null>();

function readPkg(dir: string): PackageJson | null {
  if (pkgCache.has(dir)) return pkgCache.get(dir)!;
  const file = join(dir, "package.json");
  let pkg: PackageJson | null = null;
  if (existsSync(file)) {
    try {
      pkg = JSON.parse(readFileSync(file, "utf8")) as PackageJson;
    } catch {
      pkg = null;
    }
  }
  pkgCache.set(dir, pkg);
  return pkg;
}

/** Union of dependencies of every package.json from `dir` up to the filesystem root. */
function collectDeps(dir: string): Map<string, string> {
  const deps = new Map<string, string>();
  let current = dir;
  const { root } = parsePath(dir);
  for (;;) {
    const pkg = readPkg(current);
    if (pkg) {
      for (const field of [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies]) {
        for (const [name, range] of Object.entries(field ?? {})) {
          if (!deps.has(name)) deps.set(name, range);
        }
      }
    }
    if (current === root) break;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return deps;
}

/** Lowest major.minor a semver range can resolve to, e.g. "^3.4.1" -> [3, 4]. */
export function minVersion(range: string | undefined): [number, number] | null {
  if (!range) return null;
  if (/^(workspace:|catalog:|latest|\*|x|next)/.test(range.trim())) return [99, 0];
  const m = range.match(/(\d+)(?:\.(\d+|x|\*))?/);
  if (!m) return null;
  const minor = m[2] && /^\d+$/.test(m[2]) ? Number(m[2]) : 0;
  return [Number(m[1]), minor];
}

function atLeast(v: [number, number] | null, major: number, minor: number): boolean {
  if (!v) return false;
  return v[0] > major || (v[0] === major && v[1] >= minor);
}

const infoCache = new Map<string, ProjectInfo>();

export function resolveProjectInfo(filePath: string, settings: IttijahSettings = {}): ProjectInfo {
  const dir = dirname(filePath);
  const cacheKey = dir + "\0" + JSON.stringify(settings);
  const cached = infoCache.get(cacheKey);
  if (cached) return cached;

  const deps = collectDeps(dir);
  const twRange = deps.get("tailwindcss") ?? deps.get("@tailwindcss/postcss") ?? deps.get("@tailwindcss/vite") ?? deps.get("@tailwindcss/cli");
  const twVersion = minVersion(twRange);
  const twDetected = twRange !== undefined;
  const tailwindEnabled = settings.tailwind === "auto" || settings.tailwind === undefined ? twDetected : settings.tailwind;
  // When forced on without a detectable version, assume a modern Tailwind.
  const effective = twVersion ?? (tailwindEnabled ? ([4, 0] as [number, number]) : null);

  const flipper = BUILD_TIME_FLIPPERS.find((name) => deps.has(name)) ?? null;
  const buildTimeFlip =
    settings.buildTimeFlip === false ? null : settings.buildTimeFlip === true ? flipper ?? "configured" : flipper;

  const rnDetected = deps.has("react-native") || deps.has("expo");
  const reactNative = settings.reactNative === "auto" || settings.reactNative === undefined ? rnDetected : settings.reactNative;

  const info: ProjectInfo = {
    tailwind: {
      enabled: tailwindEnabled,
      version: twRange,
      logical: atLeast(effective, 3, 3),
      logicalFloat: atLeast(effective, 3, 4),
    },
    buildTimeFlip,
    reactNative,
    iconSources: settings.iconSources ?? [],
  };
  infoCache.set(cacheKey, info);
  return info;
}

export const DEFAULT_PROJECT: ProjectInfo = {
  tailwind: { enabled: false, logical: false, logicalFloat: false },
  buildTimeFlip: null,
  reactNative: false,
  iconSources: [],
};

export function clearProjectCache(): void {
  pkgCache.clear();
  infoCache.clear();
}
