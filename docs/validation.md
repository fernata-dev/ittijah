# Validation report (v0.1)

> The spec required: before building more, scan 3–5 real Arabic/RTL projects, manually review
> 30 findings, report the false-positive rate honestly, and change the rules if it exceeds 20 %.
> This is that report. Reproduce it with `pnpm build && node scripts/validate.mjs --seed 424242 --tag v2`.

## Projects

| Project                                                           | Commit    | Why                                                          | Files scanned |  Time |
| ----------------------------------------------------------------- | --------- | ------------------------------------------------------------ | ------------: | ----: |
| [excalidraw](https://github.com/excalidraw/excalidraw)            | `701b901` | React/TS + SCSS, ships `ar-SA`, `he-IL`, sets `document.dir` |           898 | 2.1 s |
| [cal.com](https://github.com/calcom/cal.com) (sparse)             | `2eb48ec` | Next.js + Tailwind, ships `ar`/`he`, sets `dir`              |         2 601 | 2.2 s |
| [jitsi-meet](https://github.com/jitsi/jitsi-meet)                 | `ab58977` | React + SCSS, ships `main-ar`/`main-he`                      |         2 442 | 1.4 s |
| [element-web](https://github.com/element-hq/element-web) (sparse) | `f0211b9` | React + PostCSS, ships `ar`/`he`/`fa`                        |         2 711 | 2.7 s |
| [chatwoot](https://github.com/chatwoot/chatwoot) (sparse)         | `625d596` | Tailwind + SCSS + JSON locales                               |         4 098 | 0.9 s |

12 750 files in 9.4 s in total, single-threaded, with the `.gitignore` respected via `git ls-files`.

## Definitions

A finding is a **true positive (TP)** when the flagged code renders wrongly once the UI is
right-to-left, _and_ the suggested change is correct. It is a **false positive (FP)** when there is
no visible difference in RTL, the change would be wrong, or I could not verify that the string
reaches a context where it breaks. Unverifiable cases are counted **against** Ittijah.

There are two ways to count, and I report both:

- **"Intended RTL"**: the bug exists as soon as the project renders RTL.
- **"Live"**: the bug is visible to users _today_. **element-web never switches its layout to
  RTL**: nothing in `apps/web/src` sets `dir="rtl"`. So its layout and string findings are latent there.

## Run 1: false-positive rate 40 %, above the threshold

Sample: 30 findings, stratified across rules, seed `20261106` (`validation/sample-v1.md`).

| Cause                                                                                                                            |                FPs |
| -------------------------------------------------------------------------------------------------------------------------------- | -----------------: |
| `bidi-unsafe-string [leading-ltr]` on strings that are only rendered inside a `dir="rtl"` page (e.g. chatwoot `"WhatsApp چینل"`) |                  8 |
| `missing-dir-attribute` on an invisible validation-proxy `<input>` (`opacity: 0`, `tabIndex={-1}`)                               |                  1 |
| `missing-dir-attribute` treating `form.formState.errors.bio.message` as user content                                             |                  1 |
| `no-physical-properties` on map zoom controls (debatable: counted against)                                                       |                  1 |
| `leading-ltr` on jitsi `focusFail` (in-page notification)                                                                        |                  1 |
| **Total**                                                                                                                        | **12 / 30 = 40 %** |

I verified that element-web passes `textForEvent()` strings to OS notifications
(`Notifier.ts` → `displayNotification`), so sample #9 (`"%(senderName)s התחיל שיחה קולית."`) is a
genuine `leading-ltr` TP. For the other strings I could not prove a first-strong context, so they
count as FPs.

Reviewing the full finding lists, beyond the sample, surfaced more systematic FPs:

- **The Hebrew maqaf.** `ל-998`, `ו-{{second}}`, `ב-%(date)s` were reported as signed numbers. A
  hyphen between a Hebrew letter and a number has RTL on both sides and resolves correctly (UAX #9
  rule N1). Only a sign that stands alone (`" -5"`) is reordered.
- **`#{id}`**: when the id is numeric, `#` is an ET character and stays attached to the digits (W5).
- **Inputs that only ever hold LTR content**: hex colors, URLs, recovery keys, SMS tokens, social handles.

## Changes made because of run 1

1. `leading-ltr` is now **opt-in** (`"bidi-unsafe-string": ["error", { "leadingLtr": true }]`). It
   is only a bug in first-strong contexts (OS notifications, `<title>`, e-mail subjects,
   `dir="auto"`), and Ittijah cannot see where a translation key ends up. Enable it for catalogs
   that feed notifications or e-mails.
2. A sign must be preceded by whitespace or the start of the string (fixes the maqaf).
3. `id`, `…Id` and `…_id` placeholders are numeric.
4. `missing-dir-attribute` skips invisible inputs (`hidden`, `aria-hidden`, `opacity:0`,
   `display:none`), `spellCheck={false}` inputs, and fields whose name, class, placeholder or bound
   value/handler says the content is LTR or numeric (url, link, token, key, color, hex,
   msisdn, handle…). Handler names like `handleSearchChange` deliberately do **not** count, because
   an earlier draft lost real search inputs that way.
5. User-content detection ignores error, alert and validation expressions and classes.

All of these are covered by regression fixtures in `packages/core/test/`.

## Run 2: false-positive rate 6.7 % ("intended RTL") / 23.3 % ("live")

A **fresh** sample, seed `424242` (`validation/sample-v2.md`). Re-reviewing the run 1 sample
would only prove that I fixed what I had already seen.

|   # | Finding                                                                     | Verdict                        |
| --: | --------------------------------------------------------------------------- | ------------------------------ |
|   1 | cal.com `FormBuilder.tsx` `sm:ml-0` in an absolutely positioned drag handle | TP                             |
|   2 | excalidraw `ku-TR` `Excalidrow+…` → `+Excalidrow`                           | TP                             |
|   3 | excalidraw read-only `<textarea>` showing scene JSON without `dir`          | TP                             |
|   4 | cal.com `<ArrowLeftIcon />` back button, no flip                            | TP                             |
|   5 | element `left: 3px` grip centered in a resize handle                        | **FP** (no visible change)     |
|   6 | excalidraw `ar-SA` `Excalidraw+` → `+Excalidraw`                            | TP                             |
|   7 | jitsi welcome page room-name input                                          | TP                             |
|   8 | jitsi `.popover … &.right { left: 4px }`                                    | **FP** (placement is physical) |
|   9 | element `fa` `@bot:*` → `bot:*@`                                            | TP (latent in element)         |
|  10 | excalidraw example app `<textarea>`                                         | TP                             |
|  11 | cal.com editor toolbar `margin-right: 12px`                                 | TP                             |
|  12 | element `fa` `@bot:*` placeholder                                           | TP (latent)                    |
|  13 | element poll option `{answer.text}` without `dir="auto"`                    | TP (live, even in LTR)         |
|  14 | jitsi extension banner `float: right`                                       | TP                             |
|  15 | excalidraw `fa-IR` `Excalidraw+`                                            | TP                             |
|  16 | jitsi example `visitor.html` `<html>` without `lang`                        | TP (example file)              |
|  17 | element DevTools `float: left`                                              | TP (latent)                    |
|  18 | excalidraw `he-IL` `Excalidraw+`                                            | TP                             |
|  19 | cal.com `global-error.tsx` `<html>` without `lang`                          | TP                             |
|  20 | excalidraw `ElementLinkDialog` `left: var(--padding)`                       | TP                             |
|  21 | excalidraw `ar-SA` `Excalidraw+`                                            | TP                             |
|  22 | jitsi example conference-name input                                         | TP                             |
|  23 | element tab icon `margin-right: 0`                                          | TP (latent)                    |
|  24 | excalidraw `ku-TR` `Excalidraw+`                                            | TP                             |
|  25 | excalidraw export-dialog project-name input                                 | TP                             |
|  26 | jitsi shared video `text-align: left`                                       | TP                             |
|  27 | element `he` `@bot: *`                                                      | TP (latent)                    |
|  28 | excalidraw publish dialog author-name input                                 | TP                             |
|  29 | cal.com editor `li { padding-left; text-indent: -… }` hanging indent        | TP                             |
|  30 | chatwoot `fa` E.164 example `+98415555555` → `98415555555+`                 | TP                             |

- **Intended RTL:** 2 / 30 = **6.7 %** FP.
- **Live:** 2 + 5 latent element-web findings = 7 / 30 = **23.3 %**. All of the difference comes
  from one project that ships RTL _translations_ but never renders an RTL _layout_.

## Change made because of run 2

When a selector names a physical side (`.right`, `__left`, `--right`, `[data-side="right"]`), the
author is deliberately physical, usually for a placement computed by a positioning library.
`no-physical-properties` now skips those rules. This removed 24 findings (1 189 → 1 165),
including FP #8.

## Ground truth: the bidi claims, measured in a real browser

`scripts/verify-rendering.mjs` renders each pattern in Chromium and compares glyph x-positions.
It confirms that every reported pattern really is misplaced (`@x`, `C++`, `-5`, `+20 …`), that every
suggested mark fixes it, and that the two patterns Ittijah deliberately does **not** report
(Hebrew `ל-998`, a final `.` after an LTR value) really do render correctly. 10/10 pass.

## What this validation does _not_ show (limitations)

- **Recall is low for `directional-icons`: 1 finding in 5 projects.** To avoid false positives
  it only reports icons imported from known icon packages. cal.com uses its own
  `<Icon name="arrow-left">` wrapper, which is invisible to the rule unless you add it to
  `settings.iconSources`. That is a deliberate trade-off, not proof that the projects are clean.
- **`leading-ltr` is now off by default**, so real notification bugs (element-web) go unreported
  unless you opt in.
- **Vue, Svelte and Angular templates are not parsed.** chatwoot's `.vue` files were skipped.
- **element-web:** almost all of its 466 physical-property findings are "blocks RTL support", not
  live bugs. Run Ittijah on projects that actually render RTL.
- One reviewer (me), 60 sampled findings. Treat these percentages as indicative, not as a benchmark.

## Proposed next steps

1. A project-level notice when a repo ships RTL locales but nothing sets `dir="rtl"`.
2. Vue and Svelte template support (chatwoot alone has 424 `rtl:` usages in Vue files).
3. Opt-in recognition of `<Icon name="arrow-right">`-style wrappers.
