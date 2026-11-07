import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import picomatch from "picomatch";
import { rules } from "./rules/index.js";
import type { IttijahConfig, ResolvedRuleConfig, RuleSetting, Severity } from "./types.js";

export const CONFIG_FILE = "ittijah.config.json";
export const SCHEMA_URL = "https://unpkg.com/@ittijah/core/schema/ittijah.config.schema.json";

export class ConfigError extends Error {
  constructor(
    message: string,
    readonly file?: string,
  ) {
    super(file ? `${file}: ${message}` : message);
    this.name = "ConfigError";
  }
}

export interface LoadedConfig {
  config: IttijahConfig;
  /** Absolute path of the config file, if one was found. */
  path?: string;
  /** Directory relative to which globs are resolved. */
  root: string;
}

/** Find ittijah.config.json from `cwd` upwards (stops at a .git directory). */
export function findConfig(cwd: string): string | undefined {
  let dir = resolve(cwd);
  for (;;) {
    const candidate = join(dir, CONFIG_FILE);
    if (existsSync(candidate)) return candidate;
    if (existsSync(join(dir, ".git"))) return undefined;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export function loadConfig(cwd: string, explicitPath?: string): LoadedConfig {
  const path = explicitPath ? resolve(cwd, explicitPath) : findConfig(cwd);
  if (!path) return { config: {}, root: resolve(cwd) };
  if (!existsSync(path)) throw new ConfigError("config file not found", path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new ConfigError(`invalid JSON (${(e as Error).message})`, path);
  }
  const errors = validateConfig(parsed);
  if (errors.length)
    throw new ConfigError(`invalid configuration:\n  - ${errors.join("\n  - ")}`, path);
  return { config: parsed as IttijahConfig, path, root: dirname(path) };
}

const SEVERITIES = new Set(["off", "warn", "error"]);
const TRI = (v: unknown) => v === "auto" || typeof v === "boolean";

function validateRules(value: unknown, where: string, errors: string[]): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    errors.push(`${where} must be an object`);
    return;
  }
  const known = new Set(rules.map((r) => r.meta.id));
  for (const [id, setting] of Object.entries(value)) {
    const bare = id.replace(/^ittijah\//, "");
    if (!known.has(bare)) {
      errors.push(`${where}: unknown rule "${id}" (known: ${[...known].join(", ")})`);
      continue;
    }
    const sev = Array.isArray(setting) ? setting[0] : setting;
    if (!SEVERITIES.has(sev as string))
      errors.push(`${where}.${id}: severity must be "off", "warn" or "error"`);
    if (
      Array.isArray(setting) &&
      setting.length > 1 &&
      (typeof setting[1] !== "object" || setting[1] === null || Array.isArray(setting[1]))
    )
      errors.push(`${where}.${id}: options must be an object`);
  }
}

/** Lightweight validation mirroring schema/ittijah.config.schema.json (no runtime deps). */
export function validateConfig(value: unknown): string[] {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return ["configuration must be a JSON object"];
  const c = value as Record<string, unknown>;
  const allowed = new Set(["$schema", "rules", "ignore", "settings", "overrides"]);
  for (const k of Object.keys(c)) if (!allowed.has(k)) errors.push(`unknown property "${k}"`);
  if (c.rules !== undefined) validateRules(c.rules, "rules", errors);
  if (
    c.ignore !== undefined &&
    (!Array.isArray(c.ignore) || c.ignore.some((g) => typeof g !== "string"))
  )
    errors.push(`"ignore" must be an array of glob strings`);
  if (c.settings !== undefined) {
    const s = c.settings as Record<string, unknown>;
    if (typeof s !== "object" || s === null) errors.push(`"settings" must be an object`);
    else {
      for (const k of Object.keys(s)) {
        if (["tailwind", "buildTimeFlip", "reactNative"].includes(k)) {
          if (!TRI(s[k])) errors.push(`settings.${k} must be "auto", true or false`);
        } else if (k === "iconSources") {
          if (!Array.isArray(s[k]) || (s[k] as unknown[]).some((x) => typeof x !== "string"))
            errors.push(`settings.iconSources must be an array of strings`);
        } else errors.push(`unknown setting "${k}"`);
      }
    }
  }
  if (c.overrides !== undefined) {
    if (!Array.isArray(c.overrides)) errors.push(`"overrides" must be an array`);
    else
      c.overrides.forEach((o: unknown, i: number) => {
        const ov = o as Record<string, unknown>;
        if (!Array.isArray(ov?.files) || ov.files.some((f) => typeof f !== "string"))
          errors.push(`overrides[${i}].files must be an array of globs`);
        if (ov?.rules !== undefined) validateRules(ov.rules, `overrides[${i}].rules`, errors);
      });
  }
  return errors;
}

function normalizeSetting(setting: RuleSetting): {
  severity: Severity;
  options?: Record<string, unknown>;
} {
  if (Array.isArray(setting))
    return { severity: setting[0], options: setting[1] as Record<string, unknown> | undefined };
  return { severity: setting };
}

const matcherCache = new Map<string, (p: string) => boolean>();
function matcher(globs: string[]): (p: string) => boolean {
  const key = globs.join("\0");
  let m = matcherCache.get(key);
  if (!m) {
    m = picomatch(globs, { dot: true, matchBase: !globs.some((g) => g.includes("/")) });
    matcherCache.set(key, m);
  }
  return m;
}

export function toPosix(p: string): string {
  return p.split(sep).join("/");
}

/**
 * Effective rules for one file.
 * @param only restrict to these rule ids (CLI `--rule`); they are enabled even if "off".
 */
export function resolveRulesForFile(
  loaded: LoadedConfig,
  absPath: string,
  only?: string[],
): Map<string, ResolvedRuleConfig> {
  const rel = toPosix(relative(loaded.root, absPath));
  const map = new Map<string, ResolvedRuleConfig & { off?: boolean }>();
  for (const r of rules) map.set(r.meta.id, { severity: r.meta.defaultSeverity, options: {} });
  const applySettings = (settings: Record<string, RuleSetting> | undefined) => {
    for (const [id, setting] of Object.entries(settings ?? {})) {
      const bare = id.replace(/^ittijah\//, "");
      const prev = map.get(bare);
      if (!prev) continue;
      const { severity, options } = normalizeSetting(setting);
      if (severity === "off")
        map.set(bare, { ...prev, off: true, options: { ...prev.options, ...options } });
      else map.set(bare, { severity, options: { ...prev.options, ...options } });
    }
  };
  applySettings(loaded.config.rules);
  for (const o of loaded.config.overrides ?? []) if (matcher(o.files)(rel)) applySettings(o.rules);
  const out = new Map<string, ResolvedRuleConfig>();
  for (const [id, conf] of map) {
    if (only?.length) {
      if (only.includes(id))
        out.set(id, {
          severity: conf.off
            ? rules.find((r) => r.meta.id === id)!.meta.defaultSeverity
            : conf.severity,
          options: conf.options,
        });
    } else if (!conf.off) out.set(id, { severity: conf.severity, options: conf.options });
  }
  return out;
}

export function isIgnoredByConfig(loaded: LoadedConfig, absPath: string): boolean {
  const globs = loaded.config.ignore;
  if (!globs?.length) return false;
  return matcher(globs)(toPosix(relative(loaded.root, absPath)));
}
