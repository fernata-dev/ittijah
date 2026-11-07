/**
 * Core type definitions for the Ittijah rule engine.
 *
 * Design: every supported language is parsed by an *adapter* that emits a small set of
 * normalized events (CSS declarations, class lists, style objects, elements, texts).
 * Rules subscribe to events, never to raw ASTs, so one rule covers CSS, SCSS, JSX, TSX,
 * HTML and translation files with a single implementation.
 */
import type { Declaration } from "postcss";

export type Range = [start: number, end: number];

export type Language = "css" | "scss" | "js" | "html" | "json" | "yaml" | "po";

export type SeverityLevel = "warn" | "error";
export type Severity = "off" | SeverityLevel;
export type RuleSetting = Severity | [Severity] | [Severity, Record<string, unknown>];

/** A text edit expressed in source offsets (UTF-16 code units, like JS strings). */
export interface Fix {
  range: Range;
  text: string;
}

export interface Suggestion {
  desc: string;
  fix: Fix[];
}

export interface Diagnostic {
  ruleId: string;
  severity: SeverityLevel;
  message: string;
  /** 1-based */
  line: number;
  /** 1-based, in UTF-16 code units */
  column: number;
  endLine: number;
  endColumn: number;
  range: Range;
  /** Safe automatic fix, applied by `--fix`. */
  fix?: Fix[];
  /** Human-reviewed fixes that are not applied automatically. */
  suggestions?: Suggestion[];
  docsUrl: string;
}

/** What Ittijah knows about the project a file belongs to (from package.json + settings). */
export interface ProjectInfo {
  tailwind: {
    enabled: boolean;
    /** Raw version range from package.json, e.g. "^3.4.1". */
    version?: string;
    /** Supports ms-/me-/ps-/pe-/start-/end-/text-start (>= 3.3). */
    logical: boolean;
    /** Supports float-start / clear-start (>= 3.4). */
    logicalFloat: boolean;
  };
  /** Package that flips CSS at build time (rtlcss & friends), or null. */
  buildTimeFlip: string | null;
  /** React Native swaps left/right automatically in RTL (doLeftAndRightSwapInRTL). */
  reactNative: boolean;
  /** Extra module specifiers whose exports are icon components. */
  iconSources: string[];
}

// ---------------------------------------------------------------------------------------
// Normalized nodes emitted by language adapters
// ---------------------------------------------------------------------------------------

export type AttrValue =
  | { kind: "static"; value: string; range: Range }
  | { kind: "dynamic"; text: string; range: Range; node?: unknown }
  | { kind: "boolean" };

export interface Attribute {
  name: string;
  value: AttrValue;
  range: Range;
}

export type ChildInfo =
  | { kind: "text"; value: string }
  | { kind: "expression"; text: string }
  | { kind: "element"; name: string };

export interface ElementNode {
  /** Tag or component name as written: "input", "ChevronRight", "Icons.ChevronRight". */
  name: string;
  /** Lowercase intrinsic HTML element (JSX `<div>` or any HTML tag). */
  intrinsic: boolean;
  attributes: Attribute[];
  /** `{...props}` present: any attribute might be set, so rules must not assume absence. */
  hasSpread: boolean;
  /** Range of the element name in the opening tag (used for reporting). */
  nameRange: Range;
  /** Offset right after the tag name, where a new attribute can be inserted. */
  insertAttrAt: number;
  /** Ancestors, nearest first. */
  ancestors: ElementNode[];
  source: "jsx" | "html";
  /** For JSX components: the module the name (or its namespace) was imported from. */
  importSource?: string;
  /** For JSX components: the original exported name (handles `import { X as Y }`). */
  importedName?: string;
  /** Source text of enclosing `a ? b : c` / `a && b` tests within the current expression. */
  conditionalTests: string[];
  children: ChildInfo[];
  getAttr(name: string): Attribute | undefined;
}

export interface ClassToken {
  value: string;
  range: Range;
  /** Tokens from the same string literal share a group (alternatives get different groups). */
  group?: number;
}

export interface ClassListNode {
  tokens: ClassToken[];
  /** False when part of the class list is computed at runtime (variables, calls, ...). */
  complete: boolean;
  element?: ElementNode;
  /** Source of the list: a class attribute, a class helper call (cn/clsx/cva/...), ... */
  origin: "attribute" | "helper";
}

export type StyleValue =
  { kind: "static"; value: string | number; range: Range; quoted: boolean } | { kind: "dynamic" };

export interface StyleProp {
  key: string;
  keyRange: Range;
  /** Whether the key is written as a string literal ("marginLeft") instead of an identifier. */
  keyQuoted: boolean;
  value: StyleValue;
}

export interface StyleObjectNode {
  props: StyleProp[];
  /** False when the object has spreads or computed keys. */
  complete: boolean;
  element?: ElementNode;
}

export interface CssDeclarationNode {
  decl: Declaration;
  /** Offset of the CSS source within the file (non-zero for <style> blocks / style attrs). */
  baseOffset: number;
  /** True for declarations coming from an HTML `style=""` attribute. */
  inline: boolean;
}

/**
 * A human-readable string (translation value, string literal, JSX text, HTML text) prepared
 * for bidi analysis. Placeholders and isolated chunks are collapsed to sentinel characters:
 *   U+E000 = placeholder with unknown content, U+E001 = numeric placeholder,
 *   U+E002 = isolated chunk (FSI…PDI, <bdi>…</bdi>, …).
 * `offsets[i]` maps each character of `text` to its source offset, `ends[i]` to the end.
 */
export interface TextNode {
  kind: "translation" | "js-string" | "jsx-text" | "html-text";
  text: string;
  offsets: number[];
  ends: number[];
  /** Raw form of each placeholder sentinel, keyed by index in `text`. */
  placeholders: Map<number, string>;
  range: Range;
  /** Translation key path, e.g. "auth.login.title". */
  key?: string;
  /** The file is known to hold an RTL locale (path like ar.json, he/, fa-IR.yml, …). */
  rtlLocale: boolean;
  /**
   * The string may be shown where direction is auto-detected from its first strong
   * character (translations: notifications, titles, e-mails…; elements with dir="auto").
   */
  firstStrongContext: boolean;
  /**
   * How an invisible bidi mark can be written at this location, for suggestions:
   * "escape" = \u200F (JSON/JS strings), "entity" = &rlm; (HTML/JSX text), "none" = unknown.
   */
  markEncoding: "escape" | "entity" | "none";
}

// ---------------------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------------------

export interface RuleMeta {
  id: string;
  description: string;
  /** One sentence describing the real-world rendering bug the rule prevents. */
  bug: string;
  docsUrl: string;
  defaultSeverity: SeverityLevel;
  fixable: boolean;
  /** Which languages this rule inspects. */
  languages: Language[];
}

export interface ReportDescriptor {
  message: string;
  range: Range;
  fix?: Fix[];
  suggestions?: Suggestion[];
}

export interface FileInfo {
  path: string;
  language: Language;
  text: string;
}

export interface RuleContext<O = Record<string, unknown>> {
  options: O;
  file: FileInfo;
  project: ProjectInfo;
  report(descriptor: ReportDescriptor): void;
}

export interface RuleVisitor {
  /** Called once per file, before any other event. Return false to skip the file. */
  file?(): boolean | void;
  cssDeclaration?(node: CssDeclarationNode): void;
  classList?(node: ClassListNode): void;
  styleObject?(node: StyleObjectNode): void;
  element?(node: ElementNode): void;
  text?(node: TextNode): void;
}

export interface Rule<O = Record<string, unknown>> {
  meta: RuleMeta;
  defaultOptions: O;
  create(context: RuleContext<O>): RuleVisitor;
}

// ---------------------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------------------

export type TriState = "auto" | boolean;

export interface IttijahSettings {
  tailwind?: TriState;
  buildTimeFlip?: TriState;
  reactNative?: TriState;
  iconSources?: string[];
}

export interface ConfigOverride {
  files: string[];
  rules?: Record<string, RuleSetting>;
}

export interface IttijahConfig {
  $schema?: string;
  rules?: Record<string, RuleSetting>;
  ignore?: string[];
  settings?: IttijahSettings;
  overrides?: ConfigOverride[];
}

export interface ResolvedRuleConfig {
  severity: SeverityLevel;
  options: Record<string, unknown>;
}

export interface LintResult {
  filePath: string;
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  fixableCount: number;
  /** Set when the file could not be parsed; diagnostics are then empty. */
  parseError?: string;
}
