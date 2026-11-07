#!/usr/bin/env node
/* global document */
/**
 * Ground-truth check: every bidi pattern Ittijah reports, and every fix it suggests, is measured
 * in a real browser (Playwright/Chromium) by comparing glyph x-positions. This verifies the
 * analyzer's claims ("@x renders as x@") against an actual implementation of UAX #9.
 *
 *   node scripts/verify-rendering.mjs      (needs `playwright` with Chromium available)
 */
import { createRequire } from "node:module";

// require() resolution also finds a globally installed Playwright.
const { chromium } = createRequire(import.meta.url)("playwright");

const LRM = "\u200E",
  LRI = "\u2066",
  PDI = "\u2069";
// [name, text, symbol, anchor, symbol should be LEFT of anchor?]
const CASES = [
  ["@handle (bug)", "تابعنا على @ittijah", "@", "i", false],
  ["@handle (LRM fix)", `تابعنا على ${LRM}@ittijah`, "@", "i", true],
  ["C++ (bug)", "أتقن C++ في أسبوع", "+", "C", true],
  ["C++ (LRM fix)", `أتقن C++${LRM} في أسبوع`, "+", "C", false],
  ["-5 (bug)", "درجة الحرارة -5 درجات", "-", "5", false],
  ["-5 (LRI fix)", `درجة الحرارة ${LRI}-5${PDI} درجات`, "-", "5", true],
  ["+20 phone (bug)", "اتصل بنا +20 100", "+", "2", false],
  ["+20 phone (LRI fix)", `اتصل بنا ${LRI}+20 100${PDI}`, "+", "2", true],
  ["Hebrew maqaf is fine (not reported)", "בין 1 ל-998", "-", "9", false],
  [
    "final period after placeholder value is fine (not reported)",
    "تم حذف report.pdf.",
    ".",
    "r",
    true,
  ],
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<div id="x" dir="rtl" style="font: 20px sans-serif"></div>');
let failed = 0;
for (const [name, text, sym, anchor, expectLeft] of CASES) {
  const left = await page.evaluate(
    ([text, sym, anchor]) => {
      const el = document.getElementById("x");
      el.textContent = text;
      const node = el.firstChild;
      const x = (i) => {
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + 1);
        return r.getBoundingClientRect().x;
      };
      return x(text.lastIndexOf(sym)) < x(text.indexOf(anchor));
    },
    [text, sym, anchor],
  );
  const ok = left === expectLeft;
  if (!ok) failed++;
  console.log(`${ok ? "✔" : "✖"} ${name}: "${sym}" is ${left ? "left" : "right"} of "${anchor}"`);
}
await browser.close();
process.exit(failed ? 1 : 0);
