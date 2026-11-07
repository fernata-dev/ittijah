# Changelog

All notable changes to this project are documented here. Versions follow [SemVer](https://semver.org/).

## [0.1.0] — 2026-11-07

### Added
- `@ittijah/core`: rule engine with adapters for CSS/SCSS (postcss), JS/TS/JSX/TSX (Babel),
  HTML (parse5) and translation catalogs (JSON, ARB, YAML, gettext PO); project detection
  (Tailwind version, rtlcss/cssjanus, React Native); `ittijah.config.json` with JSON schema,
  overrides and ignores; `ittijah-disable-*` comments.
- Rules: `no-physical-properties` (autofix), `directional-icons`, `bidi-unsafe-string`,
  `missing-dir-attribute` (autofix).
- `ittijah` CLI: `.gitignore`-exact discovery, pretty / JSON / SARIF output, `--fix`, `--rule`,
  `--max-warnings`, `--init`, `--explain`, CI-friendly exit codes.
- `eslint-plugin-ittijah` with a flat `recommended` config.
- GitHub Action with SARIF upload to code scanning.
- Validation harness and public report (5 open-source projects, manual review of 60 findings).
- Website with landing page, docs and an in-browser bidi playground.

### Changed during validation
- `bidi-unsafe-string`: `leadingLtr` is opt-in; Hebrew/Arabic prefix hyphens (`ל-998`) and
  `#{id}` are no longer reported.
- `missing-dir-attribute`: skips invisible inputs, `spellCheck={false}` and LTR-content fields;
  error messages are not user content.
- `no-physical-properties`: skips selectors that name a physical side (`.popover.right`).
