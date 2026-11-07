import type {
  ClassListNode,
  CssDeclarationNode,
  ElementNode,
  StyleObjectNode,
  TextNode,
} from "../types.js";

/** Sink for normalized events produced by language adapters. */
export interface Emitter {
  cssDeclaration(node: CssDeclarationNode): void;
  classList(node: ClassListNode): void;
  styleObject(node: StyleObjectNode): void;
  element(node: ElementNode): void;
  text(node: TextNode): void;
}
