export * from "./types.js";
export { lintText, applyFixes, defaultRuleConfig, type LintTextOptions } from "./engine.js";
export {
  loadConfig,
  findConfig,
  validateConfig,
  resolveRulesForFile,
  isIgnoredByConfig,
  ConfigError,
  CONFIG_FILE,
  SCHEMA_URL,
  toPosix,
  type LoadedConfig,
} from "./config.js";
export { resolveProjectInfo, clearProjectCache, DEFAULT_PROJECT, BUILD_TIME_FLIPPERS } from "./project.js";
export { detectLanguage, SUPPORTED_EXTENSIONS, isRtlLang, isRtlLocalePath } from "./languages/detect.js";
export { rules, rulesById } from "./rules/index.js";
export { analyzeText, bidiClass, type Finding, type Check } from "./bidi/analyze.js";
export { buildTextNodes, decodeEscapes, plain, hasRtl } from "./bidi/message.js";
export { LineIndex } from "./location.js";

export const VERSION = "0.1.0";
