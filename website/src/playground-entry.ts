// Browser bundle for the playground: the exact analyzer the CLI uses.
import { analyzeText } from "../../packages/core/src/bidi/analyze.js";
import { buildTextNodes, plain } from "../../packages/core/src/bidi/message.js";

export interface PlaygroundFinding {
  check: string;
  message: string;
  start: number;
  end: number;
}

export function analyze(
  input: string,
  leadingLtr: boolean,
): { findings: PlaygroundFinding[]; fixed: string } {
  const nodes = buildTextNodes(plain(input, 0), "message", {
    kind: "translation",
    range: [0, input.length],
    rtlLocale: false,
    firstStrongContext: true,
    markEncoding: "escape",
  });
  const findings: PlaygroundFinding[] = [];
  const inserts: { at: number; ch: string }[] = [];
  for (const node of nodes) {
    for (const f of analyzeText(
      node.text,
      { firstStrong: leadingLtr, rtlLocale: false },
      node.placeholders,
    )) {
      findings.push({
        check: f.check,
        message: f.message,
        start: node.offsets[f.start] ?? 0,
        end: node.ends[f.end - 1] ?? input.length,
      });
      if (f.mark) {
        const at = f.mark.after ? node.ends[f.mark.index] : node.offsets[f.mark.index];
        if (at !== undefined) inserts.push({ at, ch: f.mark.char });
      }
    }
  }
  let fixed = input;
  for (const i of inserts.sort((a, b) => b.at - a.at))
    fixed = fixed.slice(0, i.at) + i.ch + fixed.slice(i.at);
  return { findings, fixed };
}
