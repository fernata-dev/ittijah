import postcss, { type Root } from "postcss";
import scss from "postcss-scss";
import type { CssDeclarationNode } from "../types.js";

export function parseCss(text: string, syntax: "css" | "scss"): Root {
  if (syntax === "scss") return scss.parse(text) as Root;
  try {
    return postcss.parse(text);
  } catch {
    // postcss-scss is more forgiving (// comments, nesting edge cases)
    return scss.parse(text) as Root;
  }
}

export function walkCss(
  root: Root,
  baseOffset: number,
  inline: boolean,
  emit: (node: CssDeclarationNode) => void,
): void {
  root.walkDecls((decl) => {
    if (decl.source?.start?.offset === undefined) return;
    emit({ decl, baseOffset, inline });
  });
}
