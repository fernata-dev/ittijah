# bidi-unsafe-string

> Detect Arabic/Hebrew strings whose punctuation, handles, signed numbers or leading Latin text are
> reordered by the Unicode Bidirectional Algorithm (UAX #9).

| Severity | Fixable | Applies to |
|---|---|---|
| `error` | suggestions (insert the right invisible mark) | JSON, ARB, YAML, PO catalogs; JS/TS string and template literals; JSX and HTML text |

Ittijah does not "guess" here. Each check matches a pattern whose rendering is **deterministic**
in an RTL paragraph, whatever the font, browser or (where noted) placeholder value.

## Why text gets scrambled

The bidi algorithm gives every character a type. Arabic letters are **strong RTL**, Latin
letters are **strong LTR**, and digits are **weak**. Punctuation and symbols such as
`@ # + - / . !` are **neutral**: they take the direction of their surroundings. A neutral between an RTL and an LTR
character takes the **paragraph** direction (rules N1/N2). In an Arabic UI that is RTL, so the
symbol moves to the far side of the Latin word.

## Checks

### `neutral-before-ltr`: `@ittijah` renders as `ittijah@`

```json
{ "follow": "تابعنا على @ittijah" }      // BAD: shows "ittijah@"
{ "follow": "تابعنا على ‎@ittijah" } // GOOD: LRM before "@"
{ "follow": "تابعنا على <bdi>@ittijah</bdi>" }
```

The same applies to `#hashtag`, `/help`, `--fix`, `.env`, `~/path` and `$HOME`.

### `neutral-after-ltr`: `C++` renders as `++C`

```json
{ "course": "أتقن C++ في أسبوع" }        // BAD: shows "++C"
{ "course": "أتقن C++‎ في أسبوع" }  // GOOD
```

The same applies to `C#`, `Disney+`, `Excalidraw+` and `Brand®`.

### `signed-number`: `-5` renders as `5-`, `+20 100 123 4567` as `4567 123 100 20+`

A sign is only joined to a number when there are digits on both sides (W4). A leading `-`/`+`
becomes neutral and resolves to RTL, and the digit groups of a phone number are laid out
right-to-left.

```json
{ "temp": "درجة الحرارة -5 درجات" }               // BAD
{ "temp": "درجة الحرارة ⁦-5⁩ درجات" }   // GOOD: LRI … PDI
```

**Not reported:** Hebrew/Arabic prefix + hyphen (`ל-998`, `ו-{{x}}`), which resolves correctly,
ranges like `5-10`, and short counters like `+3`.

### `leading-ltr` (opt-in): string starts with Latin text or a placeholder

```json
{ "commented": "{name} علّق على منشورك." }
```

Inside a `dir="rtl"` page this renders fine. But wherever direction is detected from the **first
strong character** (OS/push notifications, `<title>`, e-mail subjects, `dir="auto"`, Android and
iOS default text direction), the whole string becomes LTR. The words come out in reverse order
and the final `.` lands at the start. Fix it with a leading `‏` (RLM) or `⁨{name}⁩`.

The check is **off by default**. In the validation it was the largest source of noise, because
most strings never reach such contexts. Turn it on for catalogs that feed notifications or e-mails:

```json
{ "overrides": [{ "files": ["locales/*/notifications.json"], "rules": { "bidi-unsafe-string": ["error", { "leadingLtr": true }] } }] }
```

## What is deliberately *not* reported

* Terminating punctuation after a placeholder at the end (`"تم حذف {file}."`): in an RTL paragraph
  the final `.` resolves RTL and sits where an Arabic reader expects it.
* Already-protected text: LRM/RLM/ALM, LRI/RLI/FSI…PDI, `<bdi>`, `<span dir>`.
* ICU `#` in plurals, numeric placeholders (`{count}`, `%d`, `{n, number}`, `#{id}`), markdown `**`.
* Strings with no RTL letters, and mostly-LTR sentences.

Placeholders understood: ICU (`{x}`, plural/select branches analyzed separately), i18next `{{x}}`
and `$t()`, printf / iOS `%s %1$@ %d`, Python `%(x)s`, Rails `%{x}`, `${x}`, and React-style tags `<0>…</0>`.

## Options

```json
{ "rules": { "bidi-unsafe-string": ["error", { "leadingLtr": false, "ignoreKeys": ["legal.*"], "checks": { "signed-number": false } }] } }
```

JSON has no comments, so use `ignoreKeys` or `overrides` there. Everywhere else,
`ittijah-disable-next-line` works.
