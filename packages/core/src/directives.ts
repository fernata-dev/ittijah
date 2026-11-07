/**
 * Inline suppression comments. Works in every language because it is a plain-text scan:
 *
 *   // ittijah-disable-next-line
 *   /* ittijah-disable-next-line no-physical-properties *\/
 *   <!-- ittijah-disable-line bidi-unsafe-string -- reason -->
 *   # ittijah-disable-next-line            (YAML / PO)
 *   ittijah-disable / ittijah-enable       (block, until enable or end of file)
 *
 * When rule ids are listed only those rules are suppressed; otherwise all rules are.
 */
const DIRECTIVE =
  /ittijah-(disable-next-line|disable-line|disable|enable)\b([^\n]*)/g;

export interface Suppressions {
  isSuppressed(line: number, ruleId: string): boolean;
}

type RuleSet = Set<string> | "all";

function parseRuleList(rest: string, knownRules: Set<string>): RuleSet {
  const body = rest.split(/\*\/|-->|\s--\s|\s--$/)[0] ?? "";
  const ids = body
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => knownRules.has(s) || knownRules.has(s.replace(/^ittijah\//, "")))
    .map((s) => s.replace(/^ittijah\//, ""));
  return ids.length ? new Set(ids) : "all";
}

export function parseSuppressions(text: string, knownRules: Set<string>): Suppressions | null {
  if (!text.includes("ittijah-")) return null;
  const perLine = new Map<number, RuleSet[]>();
  const blocks: { from: number; to: number; rules: RuleSet }[] = [];
  const open: { from: number; rules: RuleSet }[] = [];

  let line = 1;
  let lastIndex = 0;
  DIRECTIVE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DIRECTIVE.exec(text))) {
    for (let i = lastIndex; i < m.index; i++) if (text.charCodeAt(i) === 10) line++;
    lastIndex = m.index;
    const kind = m[1]!;
    const rules = parseRuleList(m[2] ?? "", knownRules);
    const add = (l: number) => {
      const list = perLine.get(l) ?? [];
      list.push(rules);
      perLine.set(l, list);
    };
    if (kind === "disable-next-line") add(line + 1);
    else if (kind === "disable-line") add(line);
    else if (kind === "disable") open.push({ from: line, rules });
    else if (kind === "enable") {
      const o = open.pop();
      if (o) blocks.push({ from: o.from, to: line, rules: o.rules });
    }
  }
  for (const o of open) blocks.push({ from: o.from, to: Number.POSITIVE_INFINITY, rules: o.rules });

  const matches = (set: RuleSet, ruleId: string) => set === "all" || set.has(ruleId);
  return {
    isSuppressed(l, ruleId) {
      const list = perLine.get(l);
      if (list?.some((s) => matches(s, ruleId))) return true;
      return blocks.some((b) => l >= b.from && l <= b.to && matches(b.rules, ruleId));
    },
  };
}
