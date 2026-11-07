# directional-icons

> Require an RTL flip for arrow and chevron icons that express direction (next, back, forward).

| Severity | Fixable | Applies to |
|---|---|---|
| `warn` | suggestion only | JSX/TSX (icon packages), HTML/JSX icon-font classes |

## The real bug

```tsx
<a href="/checkout">Continue <ChevronRight /></a>
```

In Arabic, reading and therefore "forward" go **leftwards**. The chevron keeps pointing right, so
Arabic and Hebrew readers see a "back" arrow on the "continue" button. Material Design, Apple's
HIG and Fluent all mirror directional icons in RTL. Icon libraries do not do it for you.

## BAD

```tsx
import { ChevronRight, ArrowLeft } from "lucide-react";

<ChevronRight className="h-4 w-4" />
<ArrowLeft />
<FontAwesomeIcon icon={faArrowRight} />
```

```html
<i class="fa-solid fa-arrow-right"></i>
```

## GOOD

```tsx
<ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
{isRtl ? <ChevronLeft /> : <ChevronRight />}
<FontAwesomeIcon icon={faArrowRight} flip="horizontal" />   {/* only inside an RTL branch */}
<span className="rtl:[&>svg]:-scale-x-100"><ArrowLeft /></span>
```

```css
[dir="rtl"] .icon-directional { transform: scaleX(-1); }
```

## What counts as "directional"

Arrow / Chevron / Caret / Angle / Navigate icons pointing Left / Right / Back / Forward / Next /
Previous / First / Last. Vertical arrows (`ChevronDown`), diagonal "external link" arrows
(`ArrowUpRight`) and two-way arrows (`ArrowLeftRight`) are not mirrored and not reported.

## Zero false-positive policy

* Only icons **imported from known icon packages** are checked: lucide, heroicons, react-icons,
  MUI, Tabler, Phosphor, Feather, Ant Design, Radix, Font Awesome, Iconify, Octicons, Carbon,
  Remix, Hugeicons, Fluent… A local `ChevronRight` might already be direction-aware. Add your own
  wrappers with `settings.iconSources`.
* Not reported when there is a sign of a flip: any `rtl`/`ltr`/`flip`/`mirror`/`dir` class or prop,
  a `transform` style, a computed `className`, spread props, a ternary whose test mentions
  `rtl`/`dir`/`locale`, or a parent with a flip class or a `Directional*`/`Rtl*` wrapper.

**Known limitation:** recall is intentionally low. See the [validation report](../validation.md).

## Options

```json
{ "rules": { "directional-icons": ["warn", { "icons": ["MyNextIcon"], "ignore": ["ChevronRight"], "iconSources": ["@/components/icons"] }] } }
```
