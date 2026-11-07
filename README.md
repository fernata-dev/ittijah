<div align="center">

# ittijah · اتجاه

**Find RTL and bidirectional-text bugs before your Arabic and Hebrew users do.**

One engine for CSS, SCSS, Tailwind, JSX/TSX, HTML and translation files (JSON · ARB · YAML · PO).

[Website & docs](https://fernata-dev.github.io/ittijah/) · [العربية](./README.ar.md) · [Rules](#rules) · [Validation report](./docs/validation.md)

</div>

```bash
npx ittijah .
```

```text
  locales/ar.json
  2:25    ✖ error  bidi-unsafe-string
          [neutral-before-ltr] "@ittijah" renders as "ittijah@". "@" is a neutral character sitting
          between RTL text and a Latin word, so the bidi algorithm gives it the paragraph's RTL
          direction and moves it to the far side of the word. Insert U+200E LEFT-TO-RIGHT MARK …
    > 2 │   "follow": "تابعنا على @ittijah",
        │                         ^^^^^^^^

  src/ProductCard.tsx
  5:49    ✖ error  no-physical-properties · fixable
          "pl-6" is a physical utility: it does not flip in RTL. Use "ps-6".

  ✖ 26 problems (19 errors, 7 warnings) in 5 files (0.05s)
    17 fixable with --fix
```

## Why

Arabic and Hebrew apps break in quiet ways. A `margin-left` keeps its gap on the wrong side. A
"Next →" arrow points backwards. `@handle` turns into `handle@`, and `-5` into `5-`. A comment typed
in English shows as `!Thanks`. Existing tools such as stylelint logical-property plugins only cover
CSS. Ittijah parses your whole front end once and runs one set of rules over all of it.

**Zero false positives comes first.** When Ittijah is unsure, it stays quiet. Every rule was
tested on real projects (excalidraw, cal.com, jitsi-meet, element-web, chatwoot), and the
false-positive rate is published: see the [validation report](./docs/validation.md).

## Rules

| Rule                                                               | What it catches                                                                                                   | Default | Fix |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------- | --- |
| [`no-physical-properties`](./docs/rules/no-physical-properties.md) | `margin-left`, `text-align: left`, `float: right`, `ml-4`, `rounded-l`, `style={{ marginLeft }}` …                | error   | ✅  |
| [`directional-icons`](./docs/rules/directional-icons.md)           | `<ChevronRight />`, `fa-arrow-right` without an RTL flip                                                          | warn    | 💡  |
| [`bidi-unsafe-string`](./docs/rules/bidi-unsafe-string.md)         | `@user` → `user@`, `C++` → `++C`, `-5` → `5-`, scrambled phone numbers, strings starting with Latin text (opt-in) | error   | 💡  |
| [`missing-dir-attribute`](./docs/rules/missing-dir-attribute.md)   | `<html lang="ar">` without `dir`, text inputs and user content without `dir="auto"`                               | warn    | ✅  |

Each rule page explains the rendering bug it prevents, with BAD and GOOD examples.

## Usage

```bash
npx ittijah .                          # scan (respects .gitignore)
npx ittijah src --fix                  # apply safe fixes
npx ittijah . --format json            # machine-readable output
npx ittijah . --format sarif -o r.sarif  # GitHub code scanning
npx ittijah locales --rule bidi-unsafe-string
npx ittijah --explain bidi-unsafe-string
npx ittijah --init                     # create ittijah.config.json
```

| Exit code | Meaning                                                          |
| --------- | ---------------------------------------------------------------- |
| `0`       | no errors (warnings allowed unless `--max-warnings` is exceeded) |
| `1`       | errors found, or more warnings than `--max-warnings`             |
| `2`       | invalid usage or configuration                                   |

## Configuration: `ittijah.config.json`

```json
{
  "$schema": "https://unpkg.com/@ittijah/core/schema/ittijah.config.schema.json",
  "rules": {
    "no-physical-properties": "error",
    "directional-icons": ["warn", { "iconSources": ["@/components/icons"] }],
    "bidi-unsafe-string": ["error", { "ignoreKeys": ["legal.*"] }],
    "missing-dir-attribute": "warn"
  },
  "ignore": ["legacy/**"],
  "settings": { "tailwind": "auto", "buildTimeFlip": "auto", "reactNative": "auto" },
  "overrides": [
    {
      "files": ["locales/*/notifications.json"],
      "rules": { "bidi-unsafe-string": ["error", { "leadingLtr": true }] }
    }
  ]
}
```

Inline suppression works in every language:

```tsx
{
  /* ittijah-disable-next-line no-physical-properties -- the chart axis is physical */
}
<div className="ml-4" />;
```

`ittijah-disable-line`, plus `ittijah-disable` / `ittijah-enable` blocks, are also supported. In
CSS use `/* … */`, in HTML `<!-- … -->`, and in YAML or PO `# …`.

Ittijah reads your `package.json` files. It knows your Tailwind version (logical utilities need
3.3+), skips stylesheets when **rtlcss / cssjanus** flips them at build time, and leaves **React
Native** alone because it swaps left and right itself.

## GitHub Action

```yaml
# .github/workflows/rtl.yml
on: [pull_request]
permissions: { contents: read, security-events: write }
jobs:
  ittijah:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: fernata-dev/ittijah@v0
        with:
          path: .
```

Findings show up inline on the PR via code scanning (SARIF).

## ESLint plugin

```js
// eslint.config.js
import ittijah from "eslint-plugin-ittijah";
export default [ittijah.configs.recommended];
```

The JS/TS/JSX rules run inside ESLint, with fixes and suggestions. They work with any parser.

## Packages

| Package                                             |                                                          |
| --------------------------------------------------- | -------------------------------------------------------- |
| [`ittijah`](./packages/cli)                         | CLI                                                      |
| [`@ittijah/core`](./packages/core)                  | rule engine, programmatic API (`lintText`, `applyFixes`) |
| [`eslint-plugin-ittijah`](./packages/eslint-plugin) | ESLint wrapper                                           |

## Performance

About 1,350 files/s single-threaded: 5,000 realistic files in **3.7 s** (`pnpm bench`). Files are
listed with `git ls-files`, so `.gitignore` semantics are exact.

## Limitations (honest)

- Vue, Svelte and Angular templates are not parsed yet. Their `.css`/`.json` files are.
- CSS-in-JS template literals (styled-components, emotion) are not checked.
- `directional-icons` only knows icons from known packages, so recall is deliberately low.
- Ittijah cannot see how strings are rendered at runtime. See [design decisions](./docs/design-decisions.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and the [rule-authoring guide](./docs/authoring-rules.md).
False-positive reports are the most valuable issues you can open.

MIT © Ittijah contributors
