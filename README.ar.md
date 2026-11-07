<div dir="rtl">

# اتجاه · ittijah

**اكتشف أخطاء الاتجاه (RTL) والنص ثنائي الاتجاه قبل ما يكتشفها مستخدموك العرب.**

محرّك واحد يفحص CSS وSCSS وTailwind وJSX/TSX وHTML وملفات الترجمة (JSON · ARB · YAML · PO).

[الموقع والتوثيق](https://fernata-dev.github.io/ittijah/) · [English](./README.md) · [تقرير التحقق](./docs/validation.md)

</div>

```bash
npx ittijah .
```

<div dir="rtl">

## ليه؟

تطبيقات العربي والعبري بتبوظ بهدوء:

- `margin-left` بيفضل يحط المسافة في الجهة الغلط.
- سهم «التالي ←» بيشاور لورا.
- ‏`@handle` بيتعرض ‎`handle@`‎، و‏`-5` بيبقى ‎`5-`‎، ورقم التليفون بيتلخبط.
- تعليق مكتوب بالإنجليزي بيظهر ‎`!Thanks`‎.

الأدوات الموجودة (زي plugins الخاصة بـ stylelint) بتغطي CSS بس. «اتجاه» بيحلل الواجهة كلها مرة واحدة وبيطبّق نفس القواعد على كل حاجة.

**الأولوية إن مفيش إنذار كاذب.** لو الأداة مش متأكدة، بتسكت. كل قاعدة اتجرّبت على مشاريع حقيقية (excalidraw وcal.com وjitsi-meet وelement-web وchatwoot)، ونسبة الإنذارات الكاذبة منشورة بأمانة في [تقرير التحقق](./docs/validation.md).

## القواعد

| القاعدة | بتمسك إيه | الافتراضي | إصلاح تلقائي |
|---|---|---|---|
| `no-physical-properties` | ‏`margin-left` و‏`text-align: left` و‏`ml-4` و‏`rounded-l` و‏`style={{ marginLeft }}` | error | ✅ |
| `directional-icons` | ‏`<ChevronRight />` و‏`fa-arrow-right` من غير قلب في RTL | warn | 💡 |
| `bidi-unsafe-string` | ‏`@user` ← ‎`user@`‎، و‏`C++` ← ‎`++C`‎، و‏`-5` ← ‎`5-`‎، وأرقام التليفون | error | 💡 |
| `missing-dir-attribute` | ‏`<html lang="ar">` من غير `dir`، وحقول إدخال ومحتوى مستخدمين من غير `dir="auto"` | warn | ✅ |

كل قاعدة ليها صفحة بتشرح الخطأ الحقيقي اللي بيحصل في العرض، بأمثلة صح وغلط.

## الاستخدام

</div>

```bash
npx ittijah .                 # فحص (بيحترم .gitignore)
npx ittijah src --fix         # إصلاح آمن تلقائي
npx ittijah . --format sarif -o r.sarif   # لـ GitHub code scanning
npx ittijah --explain bidi-unsafe-string  # اشرح القاعدة
npx ittijah --init            # إنشاء ittijah.config.json
```

<div dir="rtl">

أكواد الخروج: `0` يعني مفيش أخطاء، و`1` يعني فيه أخطاء (أو تحذيرات أكتر من `--max-warnings`)، و`2` يعني استخدام أو إعدادات غلط.

## ملاحظات مهمة عن الدقة

- «اتجاه» بيقرا `package.json`، فبيعرف نسخة Tailwind (الـ utilities المنطقية محتاجة 3.3 أو أحدث).
- لو بتستخدم **rtlcss** أو **cssjanus** لقلب الـ CSS وقت البناء، الأداة بتتجاهل ملفات الأنماط وبتنبّهك.
- مع **React Native** مبيبلّغش عن `marginLeft`، لأن RN بيقلبها لوحده.
- فحص «النص اللي بيبدأ بحروف لاتينية» (`leadingLtr`) مقفول افتراضياً. الخطأ ده بيظهر بس في الإشعارات و`<title>` وعناوين الإيميل، والتحقق على المشاريع الحقيقية أثبت إن معظم النصوص مش بتوصل للأماكن دي. شغّله لملفات الترجمة اللي بتروح للإشعارات.

## الإيقاف في سطر معين

</div>

```tsx
{/* ittijah-disable-next-line no-physical-properties -- محور الرسم البياني فيزيائي عمداً */}
<div className="ml-4" />
```

<div dir="rtl">

## GitHub Action وESLint

</div>

```yaml
- uses: fernata-dev/ittijah@v0
```

```js
import ittijah from "eslint-plugin-ittijah";
export default [ittijah.configs.recommended];
```

<div dir="rtl">

## السرعة

حوالي 1,350 ملف في الثانية على thread واحد: 5,000 ملف في **3.7 ثانية**.

## حدود الأداة (بصراحة)

- قوالب Vue وSvelte وAngular لسه مش مدعومة.
- الـ CSS-in-JS (styled-components) مش بيتفحص.
- قاعدة الأيقونات بتعرف بس أيقونات المكتبات المعروفة، فاكتشافها قليل عن قصد.

## المساهمة

اقرا [CONTRIBUTING.md](./CONTRIBUTING.md). أهم حاجة ممكن تساهم بيها هي بلاغ عن إنذار كاذب.

الرخصة MIT.

</div>
