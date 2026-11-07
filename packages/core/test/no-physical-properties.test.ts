import { noPhysicalProperties } from "../src/rules/no-physical-properties.js";
import type { Rule } from "../src/types.js";
import { TAILWIND, testRule } from "./rule-tester.js";

const rule = noPhysicalProperties as unknown as Rule;

testRule(rule, {
  valid: [
    // --- CSS ---
    { name: "logical properties", filename: "a.css", code: ".a { margin-inline-start: 8px; padding-inline-end: 4px; inset-inline-start: 0; }" },
    { name: "symmetric margin pair is direction-neutral", filename: "a.css", code: ".a { margin-left: auto; margin-right: auto; }" },
    { name: "symmetric padding pair", filename: "a.css", code: ".a { padding-left: 1rem; padding-right: 1rem; }" },
    { name: "left:50% centering", filename: "a.css", code: ".a { position: absolute; left: 50%; transform: translateX(-50%); }" },
    { name: "full-width overlay", filename: "a.css", code: ".a { position: absolute; left: 0; width: 100%; }" },
    { name: "[dir=rtl] scoped override", filename: "a.css", code: '[dir="rtl"] .a { margin-right: 8px; margin-left: 0; }' },
    { name: ":dir(rtl) scoped", filename: "a.css", code: ".a:dir(rtl) { padding-right: 4px; }" },
    { name: ".rtl class scoped", filename: "a.css", code: "html.rtl .a { float: right; }" },
    { name: "base rule has a [dir] override in the same file", filename: "a.css", code: '.a { margin-left: 8px; }\n[dir="rtl"] .a { margin-left: 0; margin-right: 8px; }' },
    { name: "SCSS nested [dir] override", filename: "a.scss", code: '.a { margin-left: 8px; [dir="rtl"] & { margin-left: 0; margin-right: 8px; } }' },
    { name: "rtlcss ignore directive", filename: "a.css", code: ".a { /*rtl:ignore*/ margin-left: 8px; }" },
    { name: "rtlcss begin/end ignore block", filename: "a.css", code: "/*rtl:begin:ignore*/\n.a { left: 4px; }\n/*rtl:end:ignore*/" },
    { name: "CSSJanus @noflip", filename: "a.css", code: "/* @noflip */ .a { float: left; }" },
    { name: "rtlcss value directive", filename: "a.css", code: ".a { margin-left: 8px /*rtl:12px*/; }" },
    { name: "text-align center / start", filename: "a.css", code: ".a { text-align: center; } .b { text-align: start; } .c { float: none; }" },
    { name: "generated RTL stylesheet", filename: "dist/app.rtl.css", code: ".a { margin-left: 8px; }" },
    { name: "build-time flipping (rtlcss) detected", filename: "a.css", code: ".a { margin-left: 8px; }", project: { buildTimeFlip: "rtlcss" } },
    { name: "@supports not fallback", filename: "a.css", code: "@supports not (margin-inline-start: 0) { .a { margin-left: 8px; } }" },
    { name: "selector names a physical placement (jitsi popover)", filename: "a.scss", code: ".popover { .arrow { &.right { left: 4px; } } }" },
    { name: "BEM modifier names the side", filename: "a.css", code: ".tooltip--left { right: 100%; } .label_right { float: right; } [data-side='right'] { margin-left: 4px; }" },
    { name: "custom properties named like physical ones", filename: "a.scss", code: ".a { --margin-left: 8px; $padding-left: 4px; }" },
    // --- Tailwind ---
    { name: "Tailwind not installed: classes are not Tailwind", filename: "a.tsx", code: 'const A = () => <div className="ml-4 text-left" />;' },
    { name: "Tailwind logical utilities", filename: "a.tsx", code: 'const A = () => <div className="ms-4 pe-2 text-start start-0 border-s rounded-e-lg" />;', project: TAILWIND },
    { name: "Tailwind symmetric pair", filename: "a.tsx", code: 'const A = () => <div className="ml-4 mr-4 pl-2 pr-2 left-0 right-0" />;', project: TAILWIND },
    { name: "Tailwind rtl: variants handle direction manually", filename: "a.tsx", code: 'const A = () => <div className="ml-4 rtl:ml-0 rtl:mr-4" />;', project: TAILWIND },
    { name: "Tailwind centering idiom", filename: "a.tsx", code: 'const A = () => <div className="absolute left-1/2 -translate-x-1/2" />;', project: TAILWIND },
    { name: "Tailwind look-alikes are ignored", filename: "a.tsx", code: 'const A = () => <div className="prose left-sidebar text-leftish mlx-2" />;', project: TAILWIND },
    // --- style objects ---
    { name: "logical style keys", filename: "a.tsx", code: "const A = () => <div style={{ marginInlineStart: 8, textAlign: 'start' }} />;" },
    { name: "React Native swaps left/right itself", filename: "a.tsx", code: "const A = () => <View style={{ marginLeft: 8 }} />;", project: { reactNative: true } },
    { name: "symmetric style keys", filename: "a.tsx", code: "const A = () => <div style={{ paddingLeft: 4, paddingRight: 4 }} />;" },
    // --- suppression ---
    { name: "ittijah-disable-next-line", filename: "a.css", code: ".a {\n  /* ittijah-disable-next-line no-physical-properties */\n  margin-left: 8px;\n}" },
    { name: "ittijah-disable-line in JSX", filename: "a.tsx", code: "const A = () => <div style={{ marginLeft: 8 }} />; // ittijah-disable-line" },
  ],
  invalid: [
    // --- CSS ---
    {
      filename: "a.css",
      code: ".a { margin-left: 8px; }",
      errors: ['"margin-left" is physical', 'Use "margin-inline-start"'].slice(0, 1),
      output: ".a { margin-inline-start: 8px; }",
    },
    { filename: "a.css", code: ".a { padding-right: 4px !important; }", errors: 1, output: ".a { padding-inline-end: 4px !important; }" },
    { filename: "a.css", code: ".a { position: absolute; right: 12px; }", errors: 1, output: ".a { position: absolute; inset-inline-end: 12px; }" },
    { filename: "a.css", code: ".a { text-align: left; }", errors: ['"text-align: left" is physical'], output: ".a { text-align: start; }" },
    { filename: "a.css", code: ".a { float: right; clear: left; }", errors: 2, output: ".a { float: inline-end; clear: inline-start; }" },
    { filename: "a.css", code: ".a { border-left: 1px solid red; border-right-color: blue; }", errors: 2, output: ".a { border-inline-start: 1px solid red; border-inline-end-color: blue; }" },
    { filename: "a.css", code: ".a { border-top-left-radius: 4px; }", errors: 1, output: ".a { border-start-start-radius: 4px; }" },
    { name: "asymmetric pair is reported", filename: "a.css", code: ".a { margin-left: 4px; margin-right: 8px; }", errors: 2, output: ".a { margin-inline-start: 4px; margin-inline-end: 8px; }" },
    { name: "padding-left: 0 does not reset the UA padding-inline-start in RTL", filename: "a.css", code: "ul { padding-left: 0; }", errors: 1, output: "ul { padding-inline-start: 0; }" },
    { name: "SCSS nesting", filename: "a.scss", code: ".card {\n  .icon { margin-right: $gap; }\n}", errors: 1, output: ".card {\n  .icon { margin-inline-end: $gap; }\n}" },
    { name: "side words inside longer identifiers do not count", filename: "a.css", code: ".bright .copyright { padding-left: 2px; }", errors: 1, output: ".bright .copyright { padding-inline-start: 2px; }" },
    { name: "uppercase property", filename: "a.css", code: ".a { MARGIN-LEFT: 2px; }", errors: 1, output: ".a { margin-inline-start: 2px; }" },
    { name: "unrelated [dir] rule elsewhere: reported but not auto-fixed", filename: "a.css", code: '.a { margin-left: 8px; }\n[dir="rtl"] .b { margin-right: 2px; }', errors: 1 },
    { name: "<style> block in HTML", filename: "a.html", code: "<style>\n.a { left: 3px; }\n</style>", errors: 1, output: "<style>\n.a { inset-inline-start: 3px; }\n</style>" },
    { name: "inline style attribute in HTML", filename: "a.html", code: '<p style="text-align: right">x</p>', errors: 1, output: '<p style="text-align: end">x</p>' },
    // --- Tailwind ---
    {
      name: "Tailwind margin/padding/text-align",
      filename: "a.tsx",
      code: 'const A = () => <div className="ml-4 pr-2 text-left" />;',
      project: TAILWIND,
      errors: 3,
      output: 'const A = () => <div className="ms-4 pe-2 text-start" />;',
    },
    {
      name: "Tailwind variants, negative and important are preserved",
      filename: "a.tsx",
      code: 'const A = () => <div className="md:hover:-ml-2 !pl-3 sm:right-0" />;',
      project: TAILWIND,
      errors: 3,
      output: 'const A = () => <div className="md:hover:-ms-2 !ps-3 sm:end-0" />;',
    },
    {
      name: "Tailwind inside cn() / clsx()",
      filename: "a.tsx",
      code: 'const A = ({ on }) => <div className={cn("border-l-2 rounded-r-lg", on && "float-left")} />;',
      project: TAILWIND,
      errors: 3,
      output: 'const A = ({ on }) => <div className={cn("border-s-2 rounded-e-lg", on && "float-start")} />;',
    },
    {
      name: "Tailwind in cva() variants (outside JSX)",
      filename: "button.ts",
      code: 'export const b = cva("inline-flex", { variants: { icon: { left: "mr-2", right: "ml-2" } } });',
      project: TAILWIND,
      errors: 2,
      output: 'export const b = cva("inline-flex", { variants: { icon: { left: "me-2", right: "ms-2" } } });',
    },
    {
      name: "Tailwind < 3.3: reported without a fix",
      filename: "a.jsx",
      code: 'const A = () => <div className="ml-4" />;',
      project: { tailwind: { enabled: true, version: "^3.2.0", logical: false, logicalFloat: false } },
      errors: ["needs Tailwind 3.3+"],
    },
    { name: "Tailwind in HTML class attribute", filename: "a.html", code: '<div class="pl-4 rounded-tl-md"></div>', project: TAILWIND, errors: 2, output: '<div class="ps-4 rounded-ss-md"></div>' },
    // --- style objects ---
    {
      name: "React style object keys and values",
      filename: "a.jsx",
      code: "const A = () => <div style={{ marginLeft: 8, textAlign: 'right', 'paddingRight': 2 }} />;",
      errors: 3,
      output: "const A = () => <div style={{ marginInlineStart: 8, textAlign: 'end', 'paddingInlineEnd': 2 }} />;",
    },
  ],
});
