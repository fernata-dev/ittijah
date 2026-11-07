# Contributing to Ittijah

Thanks for helping make the web work properly right-to-left. ❤️

## Setup

```bash
pnpm install
pnpm build        # tsc -b for all packages
pnpm test         # vitest
pnpm lint && pnpm format:check
node packages/cli/bin/ittijah.js examples/demo   # try it
```

Requires Node 20+ and pnpm 10.

## The bar for changes

1. **Zero false-positive tolerance.** If a check cannot be sure, it must stay silent. Every new
   pattern needs negative fixtures that prove it does not fire on correct code.
2. **Every rule documents a real rendering bug**: what the user sees, why (cite the UAX #9 rule or
   CSS spec), BAD/GOOD examples. See `docs/rules/`.
3. **Fixtures:** at least 10 valid and 10 invalid cases per rule (`packages/core/test/<rule>.test.ts`).
4. **Autofixes must not change LTR rendering.** If that cannot be guaranteed, use a suggestion.
5. **Validation:** changes to a rule's matching logic must be re-run against real projects:
   `node scripts/validate.mjs --tag mychange` (see `docs/validation.md`).

## Reporting a false positive

This is the most valuable issue you can open. Use the _False positive_ template and include the
smallest snippet that reproduces it, plus what actually renders in the browser.

## Project layout

```
packages/core           rule engine: adapters (css, js, html, translations) → events → rules
packages/cli            the `ittijah` command (discovery, formatters, --fix)
packages/eslint-plugin  ESLint wrapper over core rules
docs/rules              one page per rule
scripts/validate.mjs    real-world validation harness
website/                landing page + docs site (static, built by website/build.mjs)
```

See [docs/authoring-rules.md](docs/authoring-rules.md) for writing a rule.

## Commits & releases

Conventional-ish commit messages (`feat:`, `fix:`, `docs:`). Releases are cut by pushing a `vX.Y.Z`
tag. The release workflow checks package versions, runs the tests, and publishes all packages to npm
with provenance. Update `CHANGELOG.md` in the same PR.
