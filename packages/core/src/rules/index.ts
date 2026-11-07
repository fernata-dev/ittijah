import { bidiUnsafeString } from "./bidi-unsafe-string.js";
import { directionalIcons } from "./directional-icons.js";
import { missingDirAttribute } from "./missing-dir-attribute.js";
import { noPhysicalProperties } from "./no-physical-properties.js";
import type { Rule } from "../types.js";

export const rules: Rule[] = [
  noPhysicalProperties as unknown as Rule,
  directionalIcons as unknown as Rule,
  bidiUnsafeString as unknown as Rule,
  missingDirAttribute as unknown as Rule,
];

export const rulesById: Map<string, Rule> = new Map(rules.map((r) => [r.meta.id, r]));

export { bidiUnsafeString, directionalIcons, missingDirAttribute, noPhysicalProperties };
