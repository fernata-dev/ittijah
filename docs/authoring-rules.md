# Writing an Ittijah rule

Rules never see raw ASTs. Language **adapters** parse each file and emit a few normalized
**events**, and rules subscribe to the events they care about. That is how one rule covers CSS,
JSX, HTML and translation files at once.

| Event            | Emitted for                                                                          | Node                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `cssDeclaration` | CSS/SCSS files, `<style>` blocks, `style=""` attributes                              | `{ decl: postcss.Declaration, baseOffset, inline }`                                                       |
| `classList`      | `className`/`class` attributes, `cn`/`clsx`/`cva`/`tv`/`twMerge` calls, `` tw`…` ``  | `{ tokens: [{ value, range, group }], complete, element?, origin }`                                       |
| `styleObject`    | JSX `style={{ … }}`                                                                  | `{ props: [{ key, keyRange, value }], complete, element? }`                                               |
| `element`        | every JSX and HTML element                                                           | `ElementNode` (name, attributes, `hasSpread`, ancestors, import source, enclosing conditionals, children) |
| `text`           | translation values, string/template literals, JSX & HTML text containing RTL letters | `TextNode` (text with placeholder sentinels + offset maps)                                                |

## Skeleton

```ts
import type { Rule } from "../types.js";
import { docsUrl } from "./util.js";

interface Options {
  strict: boolean;
}

export const myRule: Rule<Options> = {
  meta: {
    id: "my-rule",
    description: "One sentence: what is disallowed.",
    bug: "One sentence: what the user actually sees go wrong.",
    docsUrl: docsUrl("my-rule"),
    defaultSeverity: "warn",
    fixable: false,
    languages: ["js", "html"],
  },
  defaultOptions: { strict: false },
  create(ctx) {
    return {
      element(el) {
        if (el.hasSpread) return; // unknown props: stay silent
        if (el.name === "marquee" && !el.getAttr("dir")) {
          ctx.report({
            message: "…explain the rendering bug and the fix…",
            range: el.nameRange,
            fix: [{ range: [el.insertAttrAt, el.insertAttrAt], text: ' dir="auto"' }],
          });
        }
      },
    };
  },
};
```

Then:

1. Register it in `packages/core/src/rules/index.ts`.
2. Add its options to `packages/core/schema/ittijah.config.schema.json` (a test checks they stay in sync).
3. Write `packages/core/test/my-rule.test.ts` with `testRule()`: ≥ 10 valid and ≥ 10 invalid cases.
   `output` asserts the autofix; omitting it asserts there is none.
4. Write `docs/rules/my-rule.md`: the real bug, BAD/GOOD, what is deliberately not reported, options.
5. Run `node scripts/validate.mjs --tag my-rule` and review a sample by hand.

## Ranges & fixes

All ranges are UTF-16 offsets into the file. For `text` events, map an index in `node.text` to
the source with `node.offsets[i]` / `node.ends[i]`; escapes and entities are already accounted for.
Fixes must be safe for LTR rendering. Anything that needs judgement goes in `suggestions`.

## Suppressions

The engine handles `ittijah-disable-*` comments for every rule. Rules don't need to do anything.
