import type { Attribute, ClassListNode, ElementNode, Rule, RuleContext } from "../types.js";
import { docsUrl } from "./util.js";

/** Icon packages whose arrows/chevrons do NOT mirror automatically in RTL. */
export const DEFAULT_ICON_SOURCES = [
  "lucide-react",
  "lucide-preact",
  "lucide-solid",
  "lucide-react-native",
  "@heroicons/react",
  "react-icons",
  "@mui/icons-material",
  "@material-ui/icons",
  "@tabler/icons-react",
  "@tabler/icons-react-native",
  "@phosphor-icons/react",
  "phosphor-react",
  "react-feather",
  "@ant-design/icons",
  "@radix-ui/react-icons",
  "@fortawesome/react-fontawesome",
  "@iconify/react",
  "@iconify-icon/react",
  "@primer/octicons-react",
  "@chakra-ui/icons",
  "@carbon/icons-react",
  "@remixicon/react",
  "@hugeicons/react",
  "hugeicons-react",
  "react-bootstrap-icons",
  "iconoir-react",
  "@mynaui/icons-react",
  "@untitled-ui/icons-react",
  "@expo/vector-icons",
  "react-native-vector-icons",
  "@geist-ui/icons",
  "@vscode/codicons",
  "@atlaskit/icon",
  "@mantine/icons",
];

const LIB_PREFIX =
  /^(?:Fa6?|Fi|Md|Io5?|Bi|Hi2?|Ai|Bs|Ri|Tb|Lu|Pi|Gr|Im|Si|Vsc|Cg|Go|Gi|Wi|Di|Fc|Lia|Rx|Sl|Tfi|Ti|Ci)(?=[A-Z])/;
const VARIANT_SUFFIX =
  /(?:Icon|Outlined|Filled|Rounded|Sharp|TwoTone|TwoTones|Outline|Solid|Fill|Bold|Light|Thin|Duotone|Regular|Mini|Micro|Line|Linear|Broken|Bulk|Stroke|Svg|\d+)+$/;
const HORIZONTAL = /(Left|Right|Back|Forward|Next|Previous|Prev|Before|First|Last)/;
const VERTICAL = /(Up|Down|Top|Bottom|North|South)/;

/** Normalize an icon component name: FaArrowRight / IconChevronLeft / ArrowRightIcon → ArrowRight / ChevronLeft. */
export function normalizeIconName(name: string): string {
  let n = name.split(".").pop() ?? name;
  n = n
    .replace(/^Icon(?=[A-Z])/, "")
    .replace(LIB_PREFIX, "")
    .replace(/^fa(?=[A-Z])/, "");
  n = n.replace(VARIANT_SUFFIX, "");
  return n;
}

/** Does a (normalized) PascalCase icon name denote a horizontally directional arrow/chevron? */
export function isDirectionalIconName(name: string, extra: string[] = [], antd = false): boolean {
  if (extra.includes(name)) return true;
  const n = normalizeIconName(name);
  if (extra.includes(n)) return true;
  if (VERTICAL.test(n)) return false;
  if (/Left/.test(n) && /Right/.test(n)) return false;
  if (/^Move(Left|Right)$/.test(n)) return true;
  if (antd && /^(?:Double)?(?:Left|Right)(?:Circle|Square)?$/.test(n)) return true;
  if (!/(Arrow|Chevron|Caret|Angle|Navigate)/.test(n)) return false;
  return HORIZONTAL.test(n);
}

/** kebab/snake icon ids: "arrow-right", "mdi:chevron-left", "chevron_right". */
export function isDirectionalIconId(id: string): boolean {
  const s = id.toLowerCase();
  if (/(^|[-_:/])(up|down|top|bottom)([-_]|$)/.test(s)) return false;
  if (/left[-_]right|right[-_]left/.test(s)) return false;
  return /(^|[-_:/])(arrow|arrows|chevron|chevrons|caret|angle|angles|navigate|long-arrow)([-_a-z0-9]*?)[-_](left|right|back|forward|next|prev|previous|before)([-_]|$)/.test(
    s,
  );
}

const ICON_FONT_CLASS = /^(?:fa|bi|mdi|ri|bx|bxs|lni|ti|ph|la|las|lar|icon)-([a-z0-9-]+)$/;
const FLIP_TOKEN = /rtl|ltr|flip|mirror|\bdir\b|dir-|bidi|direction/i;
const FLIP_ATTR = /flip|mirror|rtl|^dir$|direction|rotat|transform/i;
const DIR_TEST = /rtl|ltr|\bdir\b|direction|isRTL|locale|lang|i18n/i;
const DIR_COMPONENT = /Rtl|RTL|Dir(?:ection)?(?:al)?|Mirror|Flip|Bidi/;

function staticClassTokens(attr: Attribute | undefined): string[] | null {
  if (!attr) return [];
  if (attr.value.kind === "static") return attr.value.value.split(/\s+/).filter(Boolean);
  if (attr.value.kind === "dynamic") {
    // cn("a b", "c") with only string literals is still static.
    const t = attr.value.text.trim();
    const m = t.match(/^(?:cn|clsx|cx|twMerge|twJoin|classNames|classnames)\(([\s\S]*)\)$/);
    if (m && /^(\s*("[^"]*"|'[^']*'|`[^`$]*`)\s*,?)*\s*$/.test(m[1]!)) {
      return [...m[1]!.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)]
        .flatMap((x) => (x[1] ?? x[2] ?? x[3] ?? "").split(/\s+/))
        .filter(Boolean);
    }
    if (/^["'`][^"'`$]*["'`]$/.test(t)) return t.slice(1, -1).split(/\s+/).filter(Boolean);
  }
  return null;
}

/** Does the element (or its close ancestors / enclosing conditionals) carry an RTL flip mechanism? */
function hasFlipMechanism(el: ElementNode): boolean {
  if (el.hasSpread) return true;
  if (el.attributes.some((a) => FLIP_ATTR.test(a.name))) return true;
  const tokens = staticClassTokens(el.getAttr("className") ?? el.getAttr("class"));
  if (tokens === null) return true; // computed className: can't know
  if (tokens.some((t) => FLIP_TOKEN.test(t))) return true;
  const style = el.getAttr("style");
  if (style) {
    const text =
      style.value.kind === "static"
        ? style.value.value
        : style.value.kind === "dynamic"
          ? style.value.text
          : "";
    if (/transform|scale|rotate|direction|rtl|dir/i.test(text)) return true;
    if (style.value.kind === "dynamic" && !text.trim().startsWith("{")) return true; // style={someVar}
  }
  if (el.conditionalTests.some((t) => DIR_TEST.test(t))) return true;
  for (const a of el.ancestors.slice(0, 2)) {
    if (DIR_COMPONENT.test(a.name)) return true;
    const at = staticClassTokens(a.getAttr("className") ?? a.getAttr("class"));
    if (at?.some((t) => FLIP_TOKEN.test(t))) return true;
    if (a.attributes.some((x) => /flip|mirror|rtl/i.test(x.name))) return true;
  }
  if (
    el.ancestors.some(
      (a) => DIR_COMPONENT.test(a.name) || a.conditionalTests.some((t) => DIR_TEST.test(t)),
    )
  )
    return true;
  return false;
}

export interface Options {
  /** Extra icon component names / ids to treat as directional. */
  icons: string[];
  /** Icon names to never report. */
  ignore: string[];
  /** Extra modules exporting icon components (also settable via settings.iconSources). */
  iconSources: string[];
}

export const directionalIcons: Rule<Options> = {
  meta: {
    id: "directional-icons",
    description:
      "Require a right-to-left flip for arrow and chevron icons that express direction (next, back, forward).",
    bug: 'A "Next \u2192" button keeps pointing right in Arabic, where reading \u2014 and therefore "next" \u2014 goes left, so users read the arrow as "back".',
    docsUrl: docsUrl("directional-icons"),
    defaultSeverity: "warn",
    fixable: false,
    languages: ["js", "html"],
  },
  defaultOptions: { icons: [], ignore: [], iconSources: [] },

  create(ctx: RuleContext<Options>) {
    const sources = [
      ...DEFAULT_ICON_SOURCES,
      ...ctx.project.iconSources,
      ...ctx.options.iconSources,
    ];
    const fromIconSource = (s: string | undefined) =>
      !!s &&
      sources.some(
        (src) =>
          s === src ||
          s.startsWith(src + "/") ||
          (src.endsWith("*") && s.startsWith(src.slice(0, -1))),
      );
    const ignored = new Set(ctx.options.ignore);
    const tw = ctx.project.tailwind.enabled;

    const howTo = tw
      ? `add "rtl:-scale-x-100" to its className, `
      : `mirror it under RTL ([dir="rtl"] .icon { transform: scaleX(-1) }), `;

    function suggestion(el: ElementNode) {
      const cls = el.getAttr("className");
      if (!tw || cls?.value.kind !== "static") return undefined;
      const end = cls.value.range[1];
      return [
        {
          desc: 'Add "rtl:-scale-x-100" to className',
          fix: [{ range: [end, end] as [number, number], text: " rtl:-scale-x-100" }],
        },
      ];
    }

    function reportIcon(el: ElementNode, label: string) {
      if (ignored.has(label)) return;
      ctx.report({
        message:
          `"${label}" points the same way in both directions. In RTL layouts "next/forward" points left and "back" points right, ` +
          `so this icon points backwards for Arabic/Hebrew readers. To fix it, ${howTo}or swap the icon based on the document direction.`,
        range: el.nameRange,
        suggestions: suggestion(el),
      });
    }

    return {
      element(el) {
        if (el.source !== "jsx" || el.intrinsic) return;
        const name = el.importedName ?? el.name;
        const known = fromIconSource(el.importSource);
        // FontAwesome: <FontAwesomeIcon icon={faArrowRight} />
        const iconAttr = el.getAttr("icon") ?? el.getAttr("name") ?? el.getAttr("iconName");
        if (known && iconAttr) {
          const v = iconAttr.value;
          const id = v.kind === "static" ? v.value : v.kind === "dynamic" ? v.text.trim() : "";
          const directional =
            v.kind === "static"
              ? isDirectionalIconId(id)
              : /^fa[A-Z]\w*$/.test(id) && isDirectionalIconName(id, ctx.options.icons);
          if (directional && !hasFlipMechanism(el)) reportIcon(el, id);
          return;
        }
        if (!known) return;
        const antd = el.importSource?.startsWith("@ant-design/icons") ?? false;
        if (!isDirectionalIconName(name, ctx.options.icons, antd)) return;
        if (ignored.has(name) || ignored.has(normalizeIconName(name))) return;
        if (hasFlipMechanism(el)) return;
        reportIcon(el, el.name);
      },

      classList(node: ClassListNode) {
        const el = node.element;
        if (!el || node.origin !== "attribute" || !el.intrinsic) return;
        if (!/^(i|span|em|svg|div)$/.test(el.name)) return;
        const tokens = node.tokens.map((t) => t.value);
        const hit = node.tokens.find((t) => {
          const m = t.value.match(ICON_FONT_CLASS);
          return m && isDirectionalIconId(m[1]!) && !m[1]!.startsWith("flip");
        });
        if (!hit) return;
        if (tokens.some((t) => FLIP_TOKEN.test(t))) return;
        if (!node.complete || hasFlipMechanism(el)) return;
        if (ignored.has(hit.value)) return;
        ctx.report({
          message:
            `Icon class "${hit.value}" points the same way in both directions. In RTL layouts "next/forward" points left and "back" points right, ` +
            `so this icon points backwards for Arabic/Hebrew readers. Add a flip class (e.g. "fa-flip-horizontal" under [dir="rtl"], or "rtl:-scale-x-100") or swap the icon based on direction.`,
          range: hit.range,
        });
      },
    };
  },
};
