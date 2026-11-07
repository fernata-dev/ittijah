# no-physical-properties

> Disallow physical `left`/`right` CSS properties, values and Tailwind utilities; use logical (`start`/`end`) equivalents.

| Severity | Fixable | Applies to |
|---|---|---|
| `error` | yes (`--fix`) | CSS, SCSS, `<style>` / `style=""` in HTML, Tailwind classes (JSX, HTML, `cn`/`clsx`/`cva`/`tv`), React `style={{…}}` |

## The real bug

```css
.sidebar { margin-left: 16px; }
```

In English the gap sits between the screen edge and the sidebar. When the page switches to
`dir="rtl"`, the sidebar moves to the right, but `margin-left` still adds the gap **on the left**.
The content touches the right edge, and the gap ends up between the sidebar and the content.
Logical properties follow the writing direction: `margin-inline-start` is left in LTR and right in RTL.

A subtler variant: `ul { padding-left: 0 }` does not remove the browser's default list indent in
RTL, because browsers set `padding-inline-start: 40px`, which is the **right** side in RTL.

## BAD

```css
.card { margin-left: 8px; padding-right: 4px; text-align: left; float: right; }
.badge { position: absolute; right: 8px; border-left: 1px solid; }
```

```tsx
<div className="ml-4 pr-2 text-left rounded-l-lg border-r" />
<h2 style={{ marginLeft: 12, textAlign: "left" }} />
```

## GOOD

```css
.card { margin-inline-start: 8px; padding-inline-end: 4px; text-align: start; float: inline-end; }
.badge { position: absolute; inset-inline-end: 8px; border-inline-start: 1px solid; }
```

```tsx
<div className="ms-4 pe-2 text-start rounded-s-lg border-e" />
<h2 style={{ marginInlineStart: 12, textAlign: "start" }} />
```

## Mapping

| Physical | Logical | Tailwind |
|---|---|---|
| `margin-left` / `-right` | `margin-inline-start` / `-end` | `ml-*` → `ms-*`, `mr-*` → `me-*` |
| `padding-left` / `-right` | `padding-inline-start` / `-end` | `pl-*` → `ps-*`, `pr-*` → `pe-*` |
| `left` / `right` | `inset-inline-start` / `-end` | `left-*` → `start-*`, `right-*` → `end-*` |
| `border-left*` / `border-right*` | `border-inline-start*` / `-end*` | `border-l*` → `border-s*` |
| `border-top-left-radius` … | `border-start-start-radius` … | `rounded-l` → `rounded-s`, `rounded-tl` → `rounded-ss` |
| `text-align: left/right` | `start` / `end` | `text-left` → `text-start` |
| `float` / `clear: left/right` | `inline-start` / `inline-end` | `float-left` → `float-start` (Tailwind ≥ 3.4) |

## What is deliberately *not* reported (zero false-positive policy)

* **Symmetric pairs**: `margin-left: auto; margin-right: auto`, `ml-4 mr-4`, `left-0 right-0`.
* **Centering idioms**: `left: 50%` with `translateX(-50%)`, `left-1/2 -translate-x-1/2`.
* **Full-width overlays**: `left: 0; width: 100%`.
* **Manual RTL handling**: rules under `[dir=rtl]`, `:dir()`, `.rtl`, `:lang()`, `@include rtl`;
  base rules that have a `[dir=rtl]` override in the same file; lists with any `rtl:`/`ltr:` utility.
* **Selectors that name a side**: `.popover.right { left: 4px }`, `.label_left`, `[data-side=right]`.
  These are deliberately physical placements.
* **RTLCSS / CSSJanus directives**: `/*rtl:ignore*/`, `/*rtl:begin:ignore*/…`, `/* @noflip */`, `/*rtl:12px*/`.
* **Build-time flipping**: when `rtlcss`, `postcss-rtlcss`, `cssjanus`… is a dependency, CSS and
  Tailwind are skipped, with a notice. Override this with `settings.buildTimeFlip`.
* **Generated RTL files**: `*.rtl.css`, `*-rtl.scss`.
* **React Native**, which swaps left and right itself.
* **Class names when Tailwind is not installed**. Bootstrap 4's `ml-3` is not Tailwind.

## Autofix safety

The fix renames the property or keyword. Rendering in LTR stays identical. It is withheld when:

* the stylesheet already contains `[dir]`-scoped rules (manual overrides could interact);
* the installed Tailwind is older than 3.3 (no `ms-*`), or older than 3.4 for `float-start`.

## Options

```json
{ "rules": { "no-physical-properties": ["error", { "tailwind": true, "styleObjects": true, "ignoreProperties": ["text-align"] }] } }
```
