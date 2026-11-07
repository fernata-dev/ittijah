# Design decisions and where I disagreed with the original spec

The spec asked: _"if any requirement is flawed or redundant, tell me before implementing it."_
These are the points where the implementation deliberately differs, and why.

## 1. "Flag strings where terminating punctuation sits at a direction boundary" would cry wolf

In an RTL paragraph, `"تم حذف {file}."` renders **correctly**. The final `.` sits between an LTR
value and the end of an RTL paragraph, so it resolves to RTL (UAX #9 N1/N2) and lands exactly
where an Arabic reader expects the sentence to end. A rule that flags every punctuation mark at a
direction boundary would mostly report correct strings. Ittijah instead flags the four patterns
whose mis-rendering is deterministic: neutrals glued **before** a Latin word (`@user`), neutrals
glued **after** one (`C++`), standalone signs (`-5`, `+20 100…`), and (opt-in) strings whose
first strong character is LTR.

## 2. "Every unisolated `{placeholder}` is a bug" is true in theory and useless in practice

A placeholder's value is unknown. Requiring FSI/PDI around every placeholder in every Arabic string
would flag nearly the whole catalog. Ittijah treats a placeholder as "probably Latin" only where
that is the normal case (`@{handle}`), and treats numeric placeholders (`{count}`, `%d`, `{id}`,
ICU `number`/`plural`) as numbers.

## 3. "Strings starting with Latin text" depends on rendering context

`"WhatsApp چینل"` is fine inside a `dir="rtl"` page and broken in a push notification. Static
analysis cannot see where a translation key ends up, so this check is **opt-in**. Validation
proved it: it made up 9 of the 12 false positives in run 1.

## 4. Physical properties are not always bugs

The same is true when CSS is flipped at build time (rtlcss, cssjanus), for symmetric pairs, for
centering idioms, for `[dir=rtl]` overrides, for placements a positioning library computes in
physical coordinates (`.popover.right`), and in React Native. All of these are detected and skipped.
"Flag `float`" was narrowed to `float: left|right`.

## 5. Tailwind detection is required, not optional

`ml-3` is also Bootstrap 4 syntax, and there the "fix" `ms-3` does not exist. Class names are only
analyzed when Tailwind is a dependency. Autofixes check the Tailwind version (logical utilities
need ≥ 3.3, `float-start` needs ≥ 3.4). Both facts were verified in Tailwind's source, not from memory.

## 6. `directional-icons`: recall was traded for precision

"Configurable icon-name list" alone would produce false positives for local components that
already flip themselves. Only icons imported from known icon packages (or `settings.iconSources`)
are checked. The cost, measured: 1 finding across 5 large projects.

## 7. "Zero false positives" cannot be literally zero

There is no way to prove zero false positives. What Ittijah can do is publish the rate. The
[validation report](./validation.md) gives two numbers (6.7 % "intended RTL", 23.3 % "live") and
explains the difference: one of the five projects never renders RTL at all.

## 8. Stage gates vs. "build it all"

The spec asked to stop after each stage. A later instruction asked to build everything. The
compromise was a commit per stage and a hard stop at the validation gate: run 1 was 40 % FP,
so the rules were changed and re-validated on a **fresh** sample before continuing.

## 9. Things intentionally left out of v0.1

Asymmetric shorthands (`margin: 0 8px 0 4px`), `translateX`, `background-position: left`,
CSS-in-JS template literals, and Vue/Svelte/Angular templates. Each one is either noisy or needs
its own parser, and none was in the v0.1 rule list.
