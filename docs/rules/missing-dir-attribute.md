# missing-dir-attribute

> Require `dir` on `<html>` (with `lang`), and `dir="auto"` on inputs and containers that show user-generated text.

| Severity | Fixable | Applies to |
|---|---|---|
| `warn` | yes, when the value is certain | HTML, JSX/TSX (incl. Next.js `<Html>`) |

## The real bugs

1. **`<html lang="ar">` without `dir`.** The language is Arabic but the layout is LTR: everything
   is left-aligned and mirrored the wrong way.
2. **Dynamic `lang` without `dir`** (Next.js `app/layout.tsx`: `<html lang={locale}>`). Every
   Arabic or Hebrew locale renders LTR.
3. **A text field without `dir="auto"`.** It inherits the page direction. An English message typed in
   an Arabic UI is right-aligned and `Hello!` shows as `!Hello`; Arabic typed in an English UI
   is left-aligned and its `؟` jumps to the start.
4. **User content without `dir="auto"`.** `<p>{comment.body}</p>` shows a Hebrew comment in an English
   page (or the reverse) with misplaced punctuation.

## BAD

```html
<html lang="ar">
<textarea name="message"></textarea>
<input type="search">
```

```tsx
<html lang={locale}>
<p>{comment.body}</p>
```

## GOOD

```html
<html lang="ar" dir="rtl">
<textarea name="message" dir="auto"></textarea>
```

```tsx
<html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"}>
<p dir="auto">{comment.body}</p>
<bdi>{user.name}</bdi>
```

## Zero false-positive policy

* `<html lang="en">` without `dir` is fine, because the default is `ltr`.
* Inputs that only hold LTR or numeric content are skipped: `email`, `url`, `tel`, `number`,
  `password`; `inputMode`/`autoComplete` hints; `spellCheck={false}`; names, classes, placeholders or
  bound values mentioning url, link, token, key, color, hex, code, phone, handle…
* Invisible inputs (`hidden`, `aria-hidden`, `opacity: 0`) and spread props are skipped.
* User content is only detected for clear expressions (`comment.body`, `message.text`, `post.content`,
  `user.bio`, `answer.text`), never for error, alert or validation messages.

## Autofix

Insert `dir="rtl"` (static RTL `lang`) or `dir="auto"`. With `dir="auto"`, an empty field falls
back to its parent's direction in current browsers.

## Options

```json
{ "rules": { "missing-dir-attribute": ["warn", { "checkHtml": true, "requireLang": true, "checkInputs": true, "checkUserContent": true }] } }
```
