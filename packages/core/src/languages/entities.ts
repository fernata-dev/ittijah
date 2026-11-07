import type { Decoded } from "../bidi/message.js";

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00A0", lrm: "\u200E", rlm: "\u200F",
  zwj: "\u200D", zwnj: "\u200C", hellip: "\u2026", mdash: "\u2014", ndash: "\u2013", copy: "\u00A9", reg: "\u00AE", trade: "\u2122",
  laquo: "\u00AB", raquo: "\u00BB", times: "\u00D7", minus: "\u2212", rarr: "\u2192", larr: "\u2190",
};

/** Decode HTML character references, mapping each output char to the whole reference. */
export function decodeEntities(raw: string, base: number): Decoded {
  let text = "";
  const offsets: number[] = [];
  const ends: number[] = [];
  const re = /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const copy = (from: number, to: number) => {
    for (let i = from; i < to; i++) {
      text += raw[i];
      offsets.push(base + i);
      ends.push(base + i + 1);
    }
  };
  while ((m = re.exec(raw))) {
    const body = m[1]!;
    let ch: string | undefined;
    if (body.startsWith("#x")) ch = String.fromCodePoint(parseInt(body.slice(2), 16));
    else if (body.startsWith("#")) ch = String.fromCodePoint(parseInt(body.slice(1), 10));
    else ch = NAMED[body.toLowerCase()];
    if (ch === undefined) continue;
    copy(last, m.index);
    for (let k = 0; k < ch.length; k++) {
      text += ch[k];
      offsets.push(base + m.index);
      ends.push(base + m.index + m[0].length);
    }
    last = m.index + m[0].length;
  }
  copy(last, raw.length);
  return { text, offsets, ends };
}
