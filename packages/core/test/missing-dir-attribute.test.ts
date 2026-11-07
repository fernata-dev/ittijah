import { missingDirAttribute } from "../src/rules/missing-dir-attribute.js";
import type { Rule } from "../src/types.js";
import { testRule } from "./rule-tester.js";

const rule = missingDirAttribute as unknown as Rule;

testRule(rule, {
  valid: [
    { name: "html with lang and dir", filename: "index.html", code: '<!doctype html><html lang="ar" dir="rtl"><body></body></html>' },
    { name: "LTR language without dir (defaults to ltr)", filename: "index.html", code: '<!doctype html><html lang="en"><body></body></html>' },
    { name: "dynamic lang and dir", filename: "app/layout.tsx", code: "export default ({ locale }) => <html lang={locale} dir={dir(locale)}><body /></html>;" },
    { name: "implicit html element (fragment)", filename: "partial.html", code: "<div>hi</div>" },
    { name: "input with dir=auto", filename: "a.tsx", code: 'const A = () => <input type="text" dir="auto" />;' },
    { name: "email input is always LTR", filename: "a.tsx", code: 'const A = () => <input type="email" />;' },
    { name: "numeric inputMode", filename: "a.tsx", code: 'const A = () => <input inputMode="numeric" />;' },
    { name: "phone field by name", filename: "a.tsx", code: 'const A = () => <input name="phone" />;' },
    { name: "spread props may carry dir", filename: "a.tsx", code: "const A = (p) => <textarea {...p} />;" },
    { name: "component inputs are not checked", filename: "a.tsx", code: "const A = () => <Input />;" },
    { name: "dynamic type", filename: "a.tsx", code: "const A = ({ t }) => <input type={t} />;" },
    { name: "UGC inside bdi", filename: "a.tsx", code: "const A = ({ comment }) => <bdi>{comment.body}</bdi>;" },
    { name: "UGC with dir=auto", filename: "a.tsx", code: 'const A = ({ comment }) => <p dir="auto">{comment.body}</p>;' },
    { name: "non-UGC expression", filename: "a.tsx", code: "const A = ({ product }) => <p>{product.description}</p>;" },
    { name: "UGC mixed with other text is not a container", filename: "a.tsx", code: "const A = ({ c }) => <p>By {c.author}: {c.body}</p>;" },
    { name: "contenteditable=false", filename: "a.html", code: '<div contenteditable="false">x</div>' },
    // regressions from the validation run
    { name: "invisible validation proxy input", filename: "a.tsx", code: "const A = () => <input tabIndex={-1} autoComplete=\"off\" style={{ opacity: 0, width: \"100%\" }} value={v} required />;" },
    { name: "spellCheck=false signals non-prose content", filename: "a.tsx", code: 'const A = () => <input className="drag-input" spellCheck="false" />;' },
    { name: "URL input identified by class/value", filename: "a.tsx", code: 'const A = () => <input className="link-input" value={linkUrl} />;' },
    { name: "recovery key input", filename: "a.tsx", code: 'const A = () => <input className="mx_RestoreKeyBackupDialog_recoveryKeyInput" value={this.state.recoveryKey} />;' },
    { name: "SMS token input", filename: "a.tsx", code: 'const A = () => <input type="text" className="msisdnEntry" value={this.state.token} onChange={this.onTokenChange} />;' },
    { name: "validation error is not user content", filename: "a.tsx", code: 'const A = () => <p className="text-error">{form.formState.errors.bio.message}</p>;' },
    { name: "error box is not user content", filename: "a.tsx", code: 'const A = () => <div className="chat-message__error">{message.content}</div>;' },
    { name: "disabled via options", filename: "a.tsx", code: "const A = () => <textarea />;", options: { checkInputs: false } },
  ],
  invalid: [
    { name: "html missing lang", filename: "index.html", code: "<!doctype html><html><body></body></html>", errors: ["has no lang attribute"] },
    { name: "RTL lang without dir: fixable", filename: "index.html", code: '<!doctype html>\n<html lang="ar">\n<body></body></html>', errors: ['lang="ar"> has no dir'], output: '<!doctype html>\n<html dir="rtl" lang="ar">\n<body></body></html>' },
    { name: "RTL lang with dir=ltr", filename: "index.html", code: '<html lang="he" dir="ltr"><body></body></html>', errors: ['but dir="ltr"'], output: '<html lang="he" dir="rtl"><body></body></html>' },
    { name: "dynamic lang without dir (Next.js layout)", filename: "app/layout.tsx", code: "export default ({ params }) => <html lang={params.locale}><body /></html>;", errors: ["sets lang dynamically"] },
    { name: "dynamic lang with hardcoded dir", filename: "app/layout.tsx", code: 'export default ({ locale }) => <html lang={locale} dir="ltr"><body /></html>;', errors: ['hardcodes dir="ltr"'] },
    { name: "next/document Html", filename: "pages/_document.tsx", code: 'import { Html } from "next/document";\nexport default () => <Html><body /></Html>;', errors: ["has no lang"] },
    { name: "text input", filename: "a.tsx", code: 'const A = () => <input type="text" placeholder="Search" />;', errors: ['<input type="text"> has no dir'], output: 'const A = () => <input dir="auto" type="text" placeholder="Search" />;' },
    { name: "input without type", filename: "a.jsx", code: "const A = () => <input value={v} />;", errors: 1, output: 'const A = () => <input dir="auto" value={v} />;' },
    { name: "search input", filename: "a.html", code: '<input type="search">', errors: 1, output: '<input dir="auto" type="search">' },
    { name: "textarea", filename: "a.tsx", code: "const A = () => <textarea rows={3} />;", errors: ["<textarea> has no dir"], output: 'const A = () => <textarea dir="auto" rows={3} />;' },
    { name: "contenteditable", filename: "a.html", code: "<div contenteditable>edit me</div>", errors: ["contenteditable"], output: '<div dir="auto" contenteditable>edit me</div>' },
    { name: "comment body", filename: "a.tsx", code: "const A = ({ comment }) => <p className=\"x\">{comment.body}</p>;", errors: ["comment.body"], output: 'const A = ({ comment }) => <p dir="auto" className="x">{comment.body}</p>;' },
    { name: "chat message with optional chaining", filename: "a.tsx", code: "const A = ({ m }) => <div>{message?.text}</div>;", errors: 1, output: 'const A = ({ m }) => <div dir="auto">{message?.text}</div>;' },
    { name: "user bio", filename: "a.tsx", code: "const A = ({ user }) => <span>{user.bio}</span>;", errors: 1, output: 'const A = ({ user }) => <span dir="auto">{user.bio}</span>;' },
    { name: "dangerouslySetInnerHTML with post content", filename: "a.tsx", code: "const A = ({ post }) => <article dangerouslySetInnerHTML={{ __html: post.content }} />;", errors: 1, output: 'const A = ({ post }) => <article dir="auto" dangerouslySetInnerHTML={{ __html: post.content }} />;' },
    { name: "templated HTML", filename: "a.html", code: "<p>{{ comment.body }}</p>", errors: 1, output: '<p dir="auto">{{ comment.body }}</p>' },
  ],
});
