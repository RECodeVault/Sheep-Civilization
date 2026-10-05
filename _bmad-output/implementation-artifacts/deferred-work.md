# Deferred Work

Real issues found in reviews that are not actionable in the story where they were found. Pick them up in the named story.

## Deferred from: code review of 1-1-scaffold-the-project-from-the-phaser-template (2026-10-05)

- **Typing for `scripts/`:**
  - `tsconfig.json` sets `"types": ["vite/client"]` only, so Node globals (`process`, `fs`) in `scripts/*.ts` won't typecheck without `@types/node`.
  - `allowImportingTsExtensions` is not set. Node type-stripping needs explicit `.ts` import specifiers, which tsc will reject.
  - Resolve this in Story 1.2, when `scripts/build-assets.ts` becomes real.
- **Duplicated font files:** fonts exist in both `assets/fonts/` (source) and `public/assets/fonts/` (runtime) with nothing keeping them in sync. The Story 1.2 `npm run assets` pipeline should copy them.
- **`isAbomination` lint rule versus saving:**
  - The rule in `eslint.config.js` applies to `src/save/**`, but Story 1.9's save validation and migrations must read and write that field.
  - Add `src/save/**` to that block's `ignores` in Story 1.9.
