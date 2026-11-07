import { Linter } from "eslint";
import { describe, expect, it } from "vitest";
import plugin from "../src/index.js";

const linter = new Linter({ configType: "flat" });
const config = [
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    settings: { ittijah: { tailwind: true } },
    ...(plugin.configs.recommended as object),
  },
];

describe("eslint-plugin-ittijah", () => {
  it("exposes the JS rules and a recommended config", () => {
    expect(Object.keys(plugin.rules).sort()).toEqual([
      "bidi-unsafe-string",
      "directional-icons",
      "missing-dir-attribute",
      "no-physical-properties",
    ]);
  });

  it("reports and fixes with correct locations", () => {
    const code = 'const A = () => <div className="ml-4" style={{ paddingRight: 2 }} />;\n';
    const messages = linter.verify(code, config, { filename: "src/a.jsx" });
    expect(messages.map((m) => [m.ruleId, m.line, m.column])).toEqual([
      ["ittijah/no-physical-properties", 1, 33],
      ["ittijah/no-physical-properties", 1, 48],
    ]);
    const fixed = linter.verifyAndFix(code, config, { filename: "src/a.jsx" });
    expect(fixed.output).toBe(
      'const A = () => <div className="ms-4" style={{ paddingInlineEnd: 2 }} />;\n',
    );
  });

  it("reports bidi problems with suggestions", () => {
    const messages = linter.verify("const A = () => <p>تابعنا على @ittijah</p>;", config, {
      filename: "src/b.jsx",
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]!.ruleId).toBe("ittijah/bidi-unsafe-string");
    expect(messages[0]!.suggestions?.[0]?.fix.text).toBe("&lrm;");
  });

  it("passes rule options through", () => {
    const messages = linter.verify(
      "const A = () => <textarea />;",
      [
        {
          ...config[0],
          rules: { "ittijah/missing-dir-attribute": ["warn", { checkInputs: false }] },
        },
      ],
      { filename: "src/c.jsx" },
    );
    expect(messages).toHaveLength(0);
  });
});
