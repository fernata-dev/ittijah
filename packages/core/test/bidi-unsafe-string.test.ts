import { bidiUnsafeString } from "../src/rules/bidi-unsafe-string.js";
import type { Rule } from "../src/types.js";
import { testRule } from "./rule-tester.js";

const rule = bidiUnsafeString as unknown as Rule;
const json = (o: Record<string, unknown>) => JSON.stringify(o, null, 2);

testRule(rule, {
  valid: [
    { name: "pure Arabic", filename: "locales/ar.json", code: json({ a: "مرحباً بك في اتجاه" }) },
    {
      name: "Latin word in the middle, no neutrals at the boundary",
      filename: "locales/ar.json",
      code: json({ a: "تم حفظ الملف report.pdf بنجاح" }),
    },
    {
      name: "terminating punctuation after a placeholder at the end resolves RTL correctly",
      filename: "locales/ar.json",
      code: json({ a: "تم حذف {file}." }),
    },
    {
      name: "leading numeric placeholder (numbers are weak, not strong)",
      filename: "locales/ar.json",
      code: json({ a: "{count} رسائل جديدة" }),
    },
    {
      name: "leading placeholder isolated with FSI…PDI",
      filename: "locales/ar.json",
      code: '{ "a": "\\u2068{name}\\u2069 علّق على منشورك" }',
    },
    {
      name: "leading RLM",
      filename: "locales/ar.json",
      code: '{ "a": "\\u200FiPhone متوفر الآن" }',
    },
    {
      name: "handle protected by LRM",
      filename: "locales/ar.json",
      code: '{ "a": "تابعنا على \\u200E@ittijah" }',
    },
    {
      name: "C++ protected by LRM",
      filename: "locales/ar.json",
      code: '{ "a": "تعلّم C++\\u200E اليوم" }',
    },
    {
      name: "phone number isolated with LRI…PDI",
      filename: "locales/ar.json",
      code: '{ "a": "اتصل بنا \\u2066+20 100 123 4567\\u2069" }',
    },
    {
      name: "short '+3' counter is not a phone number",
      filename: "locales/ar.json",
      code: json({ a: "+3 أخرى" }),
    },
    {
      name: "English catalog",
      filename: "locales/en.json",
      code: json({ a: "Follow @ittijah, learn C++, call +20 100 123 4567" }),
    },
    {
      name: "non-translation JS literal starting with Latin (container direction is known)",
      filename: "src/a.ts",
      code: 'const s = "iPhone متوفر الآن";',
    },
    {
      name: "ICU plural '#' is the number, not a hashtag",
      filename: "locales/ar.json",
      code: json({ a: "{count, plural, one {رسالة واحدة} other {# رسائل}}" }),
    },
    {
      name: "URL inside Arabic",
      filename: "locales/ar.json",
      code: json({ a: "زر https://example.com للمزيد" }),
    },
    { name: "numeric range", filename: "locales/ar.json", code: json({ a: "من 5-10 أيام عمل" }) },
    {
      name: "handle wrapped in <bdi>",
      filename: "locales/ar.json",
      code: json({ a: "تابعنا على <bdi>@ittijah</bdi>" }),
    },
    {
      name: "JSX handle wrapped in <bdi>",
      filename: "a.tsx",
      code: "const A = () => <p>تابعنا على <bdi>@ittijah</bdi></p>;",
    },
    {
      name: "Rails placeholder",
      filename: "config/locales/ar.yml",
      code: 'ar:\n  hello: "مرحبا %{name}"\n',
    },
    {
      name: "gettext placeholder",
      filename: "ar.po",
      code: 'msgid "Hello %s"\nmsgstr "مرحبا %s"\n',
    },
    {
      name: "markdown emphasis",
      filename: "locales/ar.json",
      code: json({ a: "هذا **مهم** جداً" }),
    },
    {
      name: "hyphen inside a word",
      filename: "locales/ar.json",
      code: json({ a: "واجهة ثنائية-اللغة" }),
    },
    {
      name: "ignoreKeys option",
      filename: "locales/ar.json",
      code: json({ legal: { a: "تابعنا على @ittijah" } }),
      options: { ignoreKeys: ["legal.*"] },
    },
    {
      name: "leading Latin is opt-in (off by default)",
      filename: "locales/ar.json",
      code: json({ a: "iPhone متوفر الآن" }),
    },
    // regressions from the validation run (docs/validation.md)
    {
      name: "Hebrew prefix + maqaf before a number is a hyphen, not a sign",
      filename: "locales/he.json",
      code: json({
        a: "הערך חייב להיות בין 1 ל-998",
        b: "{{first}} ו-{{second}} הצטרפו",
        c: "נערך ב-%(date)s",
      }),
    },
    {
      name: "'#' before a numeric id stays attached (ET + EN)",
      filename: "locales/he.json",
      code: json({ a: "שיחה #{id}", b: "מחק שיחה #{conversationId}", c: "الطلب #{order_id}" }),
    },
    {
      name: "LTR paragraph with an Arabic word",
      filename: "src/a.ts",
      code: 'const s = "Welcome to the city of القاهرة -5 degrees";',
    },
  ],
  invalid: [
    {
      name: "@handle after Arabic",
      filename: "locales/ar.json",
      code: json({ a: "تابعنا على @ittijah" }),
      errors: ['renders as "ittijah@"'],
      suggestion: "\\u200E",
    },
    {
      name: "C++ before Arabic",
      filename: "locales/ar.json",
      code: json({ a: "أتقن C++ في أسبوع" }),
      errors: ['"C++" renders as "++C"'],
    },
    {
      name: "negative number",
      filename: "locales/ar.json",
      code: json({ a: "درجة الحرارة -5 درجات" }),
      errors: ['"-5" renders as "5-"'],
    },
    {
      name: "international phone number",
      filename: "locales/ar.json",
      code: json({ a: "اتصل بنا على +20 100 123 4567" }),
      errors: ['renders as "4567 123 100 20+"'],
    },
    {
      name: "leading Latin brand",
      filename: "locales/ar.json",
      code: json({ a: "iPhone 15 متوفر الآن" }),
      errors: ['[leading-ltr] This Arabic/Hebrew string starts with Latin text "iPhone 15"'],
      suggestion: "\\u200F",
      options: { leadingLtr: true },
    },
    {
      name: "leading ICU placeholder",
      filename: "locales/ar.json",
      code: json({ a: "{name} علّق على منشورك" }),
      errors: ["starts with the placeholder {name}"],
      options: { leadingLtr: true },
    },
    {
      name: "leading i18next placeholder",
      filename: "public/locales/ar/common.json",
      code: json({ a: "{{user}} أرسل لك رسالة." }),
      errors: ["placeholder {{user}}"],
      options: { leadingLtr: true },
    },
    {
      name: "ARB value (metadata skipped)",
      filename: "lib/l10n/app_ar.arb",
      code: json({ hello: "{name} مرحباً", "@hello": { description: "{x} وصف @y" } }),
      errors: ["placeholder {name}"],
      options: { leadingLtr: true },
    },
    {
      name: "YAML hashtag",
      filename: "config/locales/ar.yml",
      code: 'ar:\n  tag: "تابع #ittijah"\n',
      errors: ['"#ittijah" renders as "ittijah#"'],
    },
    {
      name: "PO command-line flag",
      filename: "locale/ar/LC_MESSAGES/app.po",
      code: 'msgid "Run --fix to repair"\nmsgstr "شغّل --fix لإصلاح المشاكل"\n',
      errors: ['"--fix" renders as "fix--"'],
    },
    {
      name: "JS string literal: dotfile",
      filename: "src/a.ts",
      code: 'const msg = "استخدم .env لتخزين المفاتيح";',
      errors: ['".env" renders as "env."'],
    },
    {
      name: "JSX text handle",
      filename: "a.tsx",
      code: "const A = () => <p>تابعنا على @ittijah</p>;",
      errors: ["ittijah@"],
      suggestion: "&lrm;",
    },
    {
      name: "template literal handle placeholder",
      filename: "a.ts",
      code: "const s = `تابع @${handle} الآن`;",
      errors: ["holds Latin text"],
    },
    {
      name: "negative numeric placeholder",
      filename: "locales/ar.json",
      code: json({ a: "الرصيد -{amount} ريال" }),
      errors: ['"-{amount}" renders as "{amount}-"'],
    },
    {
      name: "HTML text C#",
      filename: "index.html",
      code: "<p>تعلّم لغة C# اليوم</p>",
      errors: ['"C#" renders as "#C"'],
    },
    {
      name: "inside an ICU plural branch",
      filename: "locales/ar.json",
      code: json({ a: "{count, plural, other {# مستخدم يتابعون @ittijah}}" }),
      errors: ["ittijah@"],
    },
    {
      name: "dir=auto element is a first-strong context",
      filename: "a.tsx",
      code: 'const A = () => <p dir="auto">Ittijah أداة رائعة.</p>;',
      errors: ["[leading-ltr]"],
      options: { leadingLtr: true },
    },
    {
      name: "escaped Arabic in JSON",
      filename: "locales/ar.json",
      code: '{ "a": "\\u062a\\u0627\\u0628\\u0639 @x" }',
      errors: ['"@x" renders as "x@"'],
    },
    {
      name: "two problems in one string",
      filename: "locales/ar.json",
      code: json({ a: "Ittijah يدعم C# و @handles" }),
      errors: ["[leading-ltr]", "[neutral-after-ltr]", "[neutral-before-ltr]"],
      options: { leadingLtr: true },
    },
    {
      name: "brand with trailing plus (excalidraw)",
      filename: "locales/ar-SA.json",
      code: json({ button: "تصدير إلى Excalidraw+" }),
      errors: ['"Excalidraw+" renders as "+Excalidraw"'],
    },
    {
      name: "slash command inside <code> (element-web)",
      filename: "i18n/strings/fa.json",
      code: json({ a: "می توانید از <code>/help</code> استفاده کنید" }),
      errors: ['"/help" renders as "help/"'],
    },
    {
      name: "E.164 example (chatwoot)",
      filename: "locale/ar/x.json",
      code: json({ a: "مثال: +20101243567." }),
      errors: ['"+20101243567" renders as "20101243567+"'],
    },
    {
      name: "Hebrew",
      filename: "locales/he.json",
      code: json({ a: "עקבו אחרינו ב-@ittijah או ב /docs" }),
      errors: ['"/docs" renders as "docs/"'],
    },
  ],
});
