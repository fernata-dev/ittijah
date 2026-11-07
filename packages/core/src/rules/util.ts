export const DOCS_BASE = "https://fernata-dev.github.io/ittijah/rules/";

export function docsUrl(id: string): string {
  return `${DOCS_BASE}${id}.html`;
}
