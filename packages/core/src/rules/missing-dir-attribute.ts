import { isRtlLang } from "../languages/detect.js";
import type { ElementNode, Rule, RuleContext } from "../types.js";
import { docsUrl } from "./util.js";

export interface Options {
  /** <html> must declare lang, and dir when lang is RTL or dynamic. */
  checkHtml: boolean;
  /** <html> without lang is reported. */
  requireLang: boolean;
  /** Free-text inputs, textareas and contenteditable need dir="auto". */
  checkInputs: boolean;
  /** Elements rendering user-generated content (comment.body, message.text…) need dir="auto". */
  checkUserContent: boolean;
}

const TEXT_INPUT_TYPES = new Set(["text", "search"]);
/** Fields whose content is inherently LTR or numeric: dir="auto" adds nothing. */
const LTR_FIELD =
  /e-?mail|phone|\btel\b|mobile|msisdn|otp|\bpin\b|zip|postal|url|uri\b|link|href|website|domain|iban|card.?(?:number|num)|credit.?card|\bcc\b|cvv|cvc|password|passphrase|secret|token|recovery|api.?key|amount|price|qty|quantity|number|\bage\b|code|coupon|sku|slug|username|\bip\b|\bport\b|hex|colou?r|isbn|vin\b|\bx\b|\by\b|width|height|coord|latitude|longitude/i;
const LTR_INPUTMODE = /^(numeric|decimal|tel|email|url)$/;
const LTR_AUTOCOMPLETE = /email|tel|url|cc-|one-time-code|postal-code|username|new-password|current-password|bday|transaction-amount/;

const UGC_FIELDS = new Set(["body", "content", "text", "message", "msg", "bio", "caption", "comment", "review", "reply", "note", "quote", "tweet", "post", "biography", "about"]);
const UGC_OWNER = /comment|message|msg|post|reply|review|chat|tweet|thread|bio|note|feedback|\bdm\b|discussion|caption|status|story|answer|question|user|author|profile|member|customer|sender|reply/i;
const ALWAYS_UGC_FIELD = new Set(["bio", "comment", "review", "reply", "tweet", "biography"]);

/** Is this expression (source text) user-generated content? e.g. comment.body, message?.text */
export function isUserContentExpression(expr: string): boolean {
  const t = expr.trim().replace(/\s*\?\?\s*(""|''|``|null|undefined)$/, "").replace(/\?\./g, ".").replace(/!$/, "");
  if (/^(comment|message|msg|post|reply|review|chat)(Body|Text|Content|Message)$/.test(t)) return true;
  if (!/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(t)) return false;
  if (/error|exception|formState|validation|toast|alert|i18n|translation/i.test(t)) return false;
  const parts = t.split(".");
  const last = parts[parts.length - 1]!;
  if (!UGC_FIELDS.has(last)) return false;
  if (ALWAYS_UGC_FIELD.has(last)) return true;
  return parts.slice(0, -1).some((p) => UGC_OWNER.test(p));
}

const attrStatic = (el: ElementNode, name: string): string | undefined => {
  const a = el.getAttr(name);
  return a?.value.kind === "static" ? a.value.value : undefined;
};

export const missingDirAttribute: Rule<Options> = {
  meta: {
    id: "missing-dir-attribute",
    description: "Require dir on <html> (with lang), and dir=\"auto\" on inputs and containers that show user-generated text.",
    bug: "An English comment shown in an Arabic page inherits RTL: \"Thanks!\" is right-aligned and rendered as \"!Thanks\".",
    docsUrl: docsUrl("missing-dir-attribute"),
    defaultSeverity: "warn",
    fixable: true,
    languages: ["js", "html"],
  },
  defaultOptions: { checkHtml: true, requireLang: true, checkInputs: true, checkUserContent: true },

  create(ctx: RuleContext<Options>) {
    const { options } = ctx;
    const insertDir = (el: ElementNode, value: string) => [{ range: [el.insertAttrAt, el.insertAttrAt] as [number, number], text: ` dir="${value}"` }];

    function checkHtml(el: ElementNode) {
      const lang = el.getAttr("lang");
      const dir = el.getAttr("dir");
      if (el.hasSpread) return;
      if (!lang && options.requireLang) {
        ctx.report({
          message: `<${el.name}> has no lang attribute. Screen readers pick the wrong voice for Arabic/Hebrew, and browsers pick the wrong fonts and hyphenation. Add lang (and dir for RTL languages).`,
          range: el.nameRange,
        });
      }
      if (!lang) return;
      if (lang.value.kind === "static") {
        const rtl = isRtlLang(lang.value.value);
        if (!dir && rtl) {
          ctx.report({
            message: `<${el.name} lang="${lang.value.value}"> has no dir attribute, so the page is laid out left-to-right. Add dir="rtl".`,
            range: el.nameRange,
            fix: insertDir(el, "rtl"),
          });
        } else if (dir?.value.kind === "static") {
          const d = dir.value.value.toLowerCase();
          if (rtl && d === "ltr") {
            ctx.report({
              message: `<${el.name}> declares an RTL language (lang="${lang.value.value}") but dir="ltr". Use dir="rtl".`,
              range: dir.value.range,
              fix: [{ range: dir.value.range, text: "rtl" }],
            });
          } else if (!rtl && d === "rtl" && /^[a-z]{2,3}\b/i.test(lang.value.value)) {
            ctx.report({
              message: `<${el.name}> has dir="rtl" but lang="${lang.value.value}" is a left-to-right language. Screen readers and fonts follow lang: set the real language (e.g. lang="ar").`,
              range: lang.value.range,
            });
          }
        }
      } else if (lang.value.kind === "dynamic") {
        if (!dir) {
          ctx.report({
            message: `<${el.name}> sets lang dynamically (${lang.value.text}) but has no dir: for Arabic/Hebrew locales the page is still laid out left-to-right. Derive dir from the locale, e.g. dir={isRtl ? "rtl" : "ltr"}.`,
            range: el.nameRange,
          });
        } else if (dir.value.kind === "static" && /^(ltr|rtl)$/i.test(dir.value.value)) {
          ctx.report({
            message: `<${el.name}> sets lang dynamically (${lang.value.text}) but hardcodes dir="${dir.value.value}": locales of the other direction render mirrored. Derive dir from the locale.`,
            range: dir.value.range,
          });
        }
      }
    }

    function checkInput(el: ElementNode) {
      if (el.hasSpread || el.getAttr("dir")) return;
      const isTextarea = el.name === "textarea";
      const ce = el.getAttr("contenteditable") ?? el.getAttr("contentEditable");
      const isEditable = ce !== undefined && !(ce.value.kind === "static" && ce.value.value === "false") && ce.value.kind !== "dynamic";
      if (el.name === "input") {
        const type = el.getAttr("type");
        if (type && type.value.kind !== "static") return;
        const t = type?.value.kind === "static" ? type.value.value.toLowerCase() : "text";
        if (!TEXT_INPUT_TYPES.has(t)) return;
      } else if (!isTextarea && !isEditable) return;
      const inputMode = attrStatic(el, "inputMode") ?? attrStatic(el, "inputmode");
      if (inputMode && LTR_INPUTMODE.test(inputMode)) return;
      const ac = attrStatic(el, "autoComplete") ?? attrStatic(el, "autocomplete");
      if (ac && LTR_AUTOCOMPLETE.test(ac)) return;
      // Invisible helper inputs (form-validation proxies, hidden mirrors) are never typed into.
      if (el.getAttr("hidden") || attrStatic(el, "aria-hidden") === "true") return;
      const style = el.getAttr("style");
      const styleText = style?.value.kind === "dynamic" ? style.value.text : style?.value.kind === "static" ? style.value.value : "";
      if (/opacity\s*:\s*0(?![.\d])|display\s*:\s*["']?none|visibility\s*:\s*["']?hidden/.test(styleText)) return;
      // spellcheck=false signals non-prose content (codes, colors, numbers, identifiers).
      const spell = el.getAttr("spellCheck") ?? el.getAttr("spellcheck");
      if (spell && ((spell.value.kind === "static" && spell.value.value === "false") || (spell.value.kind === "dynamic" && /^false$/.test(spell.value.text.trim())))) return;
      // What the field holds, judged from its names, labels, class and bound value/handlers.
      const ident = ["name", "id", "placeholder", "aria-label", "data-testid", "className", "class", "value", "defaultValue", "onChange", "onInput", "ref"]
        .map((n) => {
          const a = el.getAttr(n);
          return a?.value.kind === "static" ? a.value.value : a?.value.kind === "dynamic" ? a.value.text : "";
        })
        .join(" ")
        .replace(/[_-]/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2");
      if (LTR_FIELD.test(ident)) return;
      // "githubHandle" / "twitter_handle" name a field; "handleSearchChange" is an event handler.
      if (/\b[Hh]andle\b(?! [A-Z])/.test(ident) || /(github|twitter|x|instagram|telegram|social)\s*(user|account|handle)/i.test(ident)) return;
      const what = isTextarea ? "<textarea>" : el.name === "input" ? `<input type="${attrStatic(el, "type") ?? "text"}">` : `contenteditable <${el.name}>`;
      ctx.report({
        message:
          `${what} has no dir attribute, so typed text always follows the page direction. Text in the other direction ` +
          `(English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: ` +
          `"Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.`,
        range: el.nameRange,
        fix: insertDir(el, "auto"),
      });
    }

    function checkUserContent(el: ElementNode) {
      if (!el.intrinsic || el.hasSpread || el.getAttr("dir") || el.name === "bdi" || el.name === "bdo") return;
      if (/^(input|textarea|html|head|title|script|style|option|svg|path)$/.test(el.name)) return;
      if (el.ancestors.some((a) => a.name === "bdi" || attrStatic(a, "dir") === "auto")) return;
      let expr: string | undefined;
      const html = el.getAttr("dangerouslySetInnerHTML");
      if (html?.value.kind === "dynamic") {
        const m = html.value.text.match(/^\{\s*__html\s*:\s*([\s\S]+?)\s*,?\s*\}$/);
        expr = m?.[1];
      } else {
        const meaningful = el.children.filter((c) => !(c.kind === "text" && !c.value.trim()));
        if (meaningful.length === 1 && meaningful[0]!.kind === "expression") expr = meaningful[0]!.text;
      }
      if (!expr || !isUserContentExpression(expr)) return;
      // Error/alert messages are app-generated, not user-generated.
      const cls = attrStatic(el, "className") ?? attrStatic(el, "class") ?? "";
      if (/error|alert|toast|warning|danger|invalid/i.test(cls)) return;
      ctx.report({
        message:
          `<${el.name}> renders user-generated content (${expr.trim()}) without dir="auto". A message written in the other ` +
          `direction inherits the page direction: it is aligned to the wrong edge and its punctuation jumps ("Thanks!" \u2192 "!Thanks"). ` +
          `Add dir="auto" (or wrap it in <bdi>).`,
        range: el.nameRange,
        fix: insertDir(el, "auto"),
      });
    }

    return {
      element(el) {
        const isHtml = (el.intrinsic && el.name === "html") || (el.name === "Html" && el.importSource === "next/document");
        if (isHtml) {
          if (options.checkHtml) checkHtml(el);
          return;
        }
        if (!el.intrinsic) return;
        if (options.checkInputs) checkInput(el);
        if (options.checkUserContent) checkUserContent(el);
      },
    };
  },
};
