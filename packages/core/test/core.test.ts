import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeText, bidiClass } from "../src/bidi/analyze.js";
import {
  buildTextNodes,
  decodeEscapes,
  ISOLATED,
  isNumericName,
  PH_NUMERIC,
  PH_UNKNOWN,
} from "../src/bidi/message.js";
import {
  loadConfig,
  resolveRulesForFile,
  validateConfig,
  isIgnoredByConfig,
  ConfigError,
} from "../src/config.js";
import { parseSuppressions } from "../src/directives.js";
import { applyFixes, lintText } from "../src/engine.js";
import { detectLanguage, isRtlLang, isRtlLocalePath } from "../src/languages/detect.js";
import { LineIndex } from "../src/location.js";
import { clearProjectCache, minVersion, resolveProjectInfo } from "../src/project.js";
import schema from "../schema/ittijah.config.schema.json" with { type: "json" };
import { rules } from "../src/rules/index.js";

const base = {
  kind: "translation" as const,
  range: [0, 0] as [number, number],
  rtlLocale: true,
  firstStrongContext: true,
  markEncoding: "escape" as const,
};

describe("bidi classes", () => {
  it("classifies strong, weak and neutral characters", () => {
    expect(bidiClass("ع")).toBe("R");
    expect(bidiClass("ש")).toBe("R");
    expect(bidiClass("A")).toBe("L");
    expect(bidiClass("5")).toBe("EN");
    expect(bidiClass("٥")).toBe("AN");
    expect(bidiClass("۵")).toBe("EN");
    expect(bidiClass("@")).toBe("ON");
    expect(bidiClass(" ")).toBe("WS");
    expect(bidiClass("‎")).toBe("LRM");
    expect(bidiClass("‏")).toBe("RLM");
  });
});

describe("decodeEscapes", () => {
  it("maps decoded characters back to source offsets", () => {
    const d = decodeEscapes("a\\u0628b\\n", 10);
    expect(d.text).toBe("aبb\n");
    expect(d.offsets).toEqual([10, 11, 17, 18]);
    expect(d.ends).toEqual([11, 17, 18, 20]);
  });
  it("handles \\u{…} and \\x", () => {
    expect(decodeEscapes("\\u{1F600}\\x41", 0).text).toBe("\u{1F600}A");
  });
});

describe("placeholder tokenization", () => {
  const one = (s: string) => buildTextNodes(decodeEscapes(s, 0), "message", base);
  it("collapses ICU, i18next, printf, Rails and Python placeholders", () => {
    expect(one("{name} {count} {{user}} %s %d %{x} %(who)s")[0]!.text).toBe(
      `${PH_UNKNOWN} ${PH_NUMERIC} ${PH_UNKNOWN} ${PH_UNKNOWN} ${PH_NUMERIC} ${PH_UNKNOWN} ${PH_UNKNOWN}`,
    );
  });
  it("splits ICU plural branches and treats # as a number", () => {
    const nodes = one("{n, plural, one {واحد} other {# رسائل}}");
    expect(nodes.map((n) => n.text)).toEqual([PH_NUMERIC, "واحد", `${PH_NUMERIC} رسائل`]);
  });
  it("collapses isolates and <bdi>, drops inline tags", () => {
    expect(one("أ ⁨x⁩ <bdi>@a</bdi> <b>ب</b>")[0]!.text).toBe(`أ ${ISOLATED} ${ISOLATED} ب`);
  });
  it("keeps %% as a literal", () => {
    expect(one("50%% خصم")[0]!.text).toBe("50%% خصم");
  });
  it("recognizes numeric names", () => {
    for (const n of ["count", "totalCount", "page", "conversationId", "order_id", "id"])
      expect(isNumericName(n)).toBe(true);
    for (const n of ["name", "user", "file", "brand"]) expect(isNumericName(n)).toBe(false);
  });
});

describe("analyzeText", () => {
  const run = (t: string, firstStrong = false) =>
    analyzeText(t, { firstStrong, rtlLocale: false }).map((f) => f.check);
  it("ignores LTR paragraphs", () => expect(run("Follow @x and C++ at -5 جدا")).toEqual([]));
  it("finds each check", () => {
    expect(run("تابع @x")).toEqual(["neutral-before-ltr"]);
    expect(run("لغة C++ رائعة")).toEqual(["neutral-after-ltr"]);
    expect(run("الحرارة -5 درجات")).toEqual(["signed-number"]);
    expect(run("iPhone متوفر الآن", true)).toEqual(["leading-ltr"]);
  });
  it("respects per-check switches", () => {
    expect(
      analyzeText("تابع @x", {
        firstStrong: false,
        rtlLocale: false,
        checks: { "neutral-before-ltr": false },
      }),
    ).toEqual([]);
  });
});

describe("suppression comments", () => {
  const known = new Set(rules.map((r) => r.meta.id));
  it("next-line, line, blocks and rule lists", () => {
    const s = parseSuppressions(
      "// ittijah-disable-next-line\nA\nB // ittijah-disable-line bidi-unsafe-string -- why\n/* ittijah-disable */\nC\n/* ittijah-enable */\nD",
      known,
    )!;
    expect(s.isSuppressed(2, "no-physical-properties")).toBe(true);
    expect(s.isSuppressed(3, "bidi-unsafe-string")).toBe(true);
    expect(s.isSuppressed(3, "no-physical-properties")).toBe(false);
    expect(s.isSuppressed(5, "directional-icons")).toBe(true);
    expect(s.isSuppressed(7, "directional-icons")).toBe(false);
  });
});

describe("applyFixes", () => {
  it("skips overlapping fixes and applies from the end", () => {
    const d = (a: number, b: number, text: string) => ({
      ruleId: "x",
      severity: "error" as const,
      message: "",
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
      range: [a, b] as [number, number],
      docsUrl: "",
      fix: [{ range: [a, b] as [number, number], text }],
    });
    expect(applyFixes("abcdef", [d(0, 2, "XY"), d(1, 3, "!!"), d(4, 6, "Z")])).toEqual({
      output: "XYcdZ",
      applied: 2,
    });
  });
});

describe("languages", () => {
  it("detects languages and skips generated files", () => {
    expect(detectLanguage("a/b.tsx")).toBe("js");
    expect(detectLanguage("x.d.ts")).toBeNull();
    expect(detectLanguage("app.min.css")).toBeNull();
    expect(detectLanguage("app_ar.arb")).toBe("json");
    expect(detectLanguage("x.png")).toBeNull();
  });
  it("knows RTL languages and locale paths", () => {
    expect(isRtlLang("ar-EG")).toBe(true);
    expect(isRtlLang("ckb")).toBe(true);
    expect(isRtlLang("en")).toBe(false);
    expect(isRtlLocalePath("public/locales/ar/common.json")).toBe(true);
    expect(isRtlLocalePath("lib/l10n/app_he.arb")).toBe(true);
    expect(isRtlLocalePath("locales/fa-IR.json")).toBe(true);
    expect(isRtlLocalePath("lib/l10n/app_fa_IR.arb")).toBe(true);
    expect(isRtlLocalePath("locales/en.json")).toBe(false);
    expect(isRtlLocalePath("src/components/header.json")).toBe(false);
  });
  it("reports parse errors instead of throwing", () => {
    const r = lintText({ text: '{ "a": "عربي @x" ', filePath: "ar.json" });
    expect(r.diagnostics.length + (r.parseError ? 1 : 0)).toBeGreaterThan(0);
  });
  it("LineIndex", () => {
    const li = new LineIndex("ab\ncd\n");
    expect(li.position(4)).toEqual({ line: 2, column: 2 });
  });
});

describe("project detection", () => {
  it("reads tailwind version, rtlcss and react-native from package.json up the tree", () => {
    clearProjectCache();
    const dir = mkdtempSync(join(tmpdir(), "ittijah-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ devDependencies: { tailwindcss: "~3.3.2", rtlcss: "^4" } }),
    );
    mkdirSync(join(dir, "app"));
    writeFileSync(
      join(dir, "app", "package.json"),
      JSON.stringify({ dependencies: { "react-native": "0.76.0" } }),
    );
    const info = resolveProjectInfo(join(dir, "app", "x.tsx"));
    expect(info.tailwind).toMatchObject({ enabled: true, logical: true, logicalFloat: false });
    expect(info.buildTimeFlip).toBe("rtlcss");
    expect(info.reactNative).toBe(true);
    expect(
      resolveProjectInfo(join(dir, "app", "y.tsx"), { buildTimeFlip: false, tailwind: false })
        .buildTimeFlip,
    ).toBeNull();
  });
  it("minVersion", () => {
    expect(minVersion("^3.4.1")).toEqual([3, 4]);
    expect(minVersion(">=4")).toEqual([4, 0]);
    expect(minVersion("workspace:*")).toEqual([99, 0]);
  });
});

describe("config", () => {
  it("validates", () => {
    expect(validateConfig({ rules: { "no-physical-properties": "warn" } })).toEqual([]);
    expect(validateConfig({ rules: { nope: "warn" } })[0]).toContain("unknown rule");
    expect(validateConfig({ rules: { "directional-icons": "loud" } })[0]).toContain("severity");
    expect(validateConfig({ settings: { tailwind: "maybe" } })[0]).toContain("tailwind");
    expect(validateConfig({ wat: 1 })[0]).toContain("unknown property");
  });
  it("schema and validator know the same rules", () => {
    expect(
      Object.keys(
        (schema as { definitions: { rules: { properties: object } } }).definitions.rules.properties,
      ).sort(),
    ).toEqual(rules.map((r) => r.meta.id).sort());
  });
  it("loads, applies overrides, ignore and --rule", () => {
    const dir = mkdtempSync(join(tmpdir(), "ittijah-cfg-"));
    writeFileSync(
      join(dir, "ittijah.config.json"),
      JSON.stringify({
        rules: { "directional-icons": "off", "bidi-unsafe-string": ["warn", { leadingLtr: true }] },
        ignore: ["legacy/**"],
        overrides: [{ files: ["emails/**"], rules: { "no-physical-properties": "off" } }],
      }),
    );
    const loaded = loadConfig(dir);
    const r = resolveRulesForFile(loaded, join(dir, "src/a.tsx"));
    expect(r.has("directional-icons")).toBe(false);
    expect(r.get("bidi-unsafe-string")).toEqual({
      severity: "warn",
      options: { leadingLtr: true },
    });
    expect(
      resolveRulesForFile(loaded, join(dir, "emails/x.html")).has("no-physical-properties"),
    ).toBe(false);
    expect([
      ...resolveRulesForFile(loaded, join(dir, "a.css"), ["directional-icons"]).keys(),
    ]).toEqual(["directional-icons"]);
    expect(isIgnoredByConfig(loaded, join(dir, "legacy/a.css"))).toBe(true);
    writeFileSync(join(dir, "bad.json"), "{ nope");
    expect(() => loadConfig(dir, "bad.json")).toThrow(ConfigError);
  });
});
