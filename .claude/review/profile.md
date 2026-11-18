# Gauntlet profile: revel-frontend

## About this codebase
Revel's web frontend: a SvelteKit application (Svelte 5 runes, TypeScript strict, TanStack Query, shadcn-svelte, Tailwind, Paraglide i18n in six locales, Vitest and Playwright) for an event management and ticketing platform. It is a thin client over the Revel backend API: the TypeScript API client in `src/lib/api/` is generated from the backend's OpenAPI schema and is never hand-written. Public pages (events, organizations, series, discovery) render on the server for SEO; authenticated dashboards are hybrid SSR plus client; highly interactive features (QR scanning, real-time) opt out of SSR. Users act as attendees, organization members, staff or owners of multi-tenant organizations, some served on white-label custom domains and embeds; the UI covers checkout (including guest checkout and seat selection), memberships and subscriptions, organizer administration, invoicing views and account settings. The access token lives in memory only; the refresh token is an httpOnly cookie, and sensitive API calls go through `+page.server.ts` / `+server.ts` so the token never reaches client-visible data.

## Gate
1. `make fix`, then `make check` (Prettier, ESLint with zero warnings, i18n freshness and validation, `svelte-check` types plus the type-gate canary, hardcoded-string scan, file length, SSR-token leak guard, image audit). Never treat a green type run as proof the gate works; `make types-canary` is the proof.
2. Targeted unit tests: `pnpm vitest run <touched spec files>`; `make test` for the whole unit suite when the change is broad. Mock API calls; query components by role and label.
3. If routes, auth, tenant or checkout flows changed: E2E via `make e2e-setup`, `make e2e-run`, `make e2e-teardown` (the backend is started from `../revel-backend`). Do not run E2E from a worktree (one backend, one port 8000). Judge the skip count, not only the exit code: a wedged backend makes journey specs skip themselves and look green. `stripe listen` stays a manual step. Environment contract: `tests/e2e/README.md`.
4. If the backend API changed: `pnpm generate:api` (`make generate-api`); never hand-write API types or client code. Commit the regenerated client with the change that needs it.
5. If the theme or colours changed: `python3 scripts/audit-brand-themes.py` must report 0 failures.
6. If dependencies changed: `make audit-deps` (pnpm audit at high severity and the license check).

## Docs locations
- CHANGELOG: `CHANGELOG.md`, section `[Unreleased]`.
- Docs: `docs/` (`docs/runbooks/` for deployment, i18n, error handling, image upload, PWA and SEO indexing; `docs/tenant-mode.md`, `docs/embeds.md`, `docs/seo/`), `CONTRIBUTING.md`, `tests/e2e/README.md`.
- Decisions: recorded in PR descriptions and the docs above; there is no ADR directory.
- Other: `.claude/agents/README.md` if agents changed.

## House rules reviewers should check
See `CLAUDE.md`. The ones that most often slip:
- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`); never legacy `$:` or bare `let` reactivity. TypeScript strict, no `any`, explicit types on function parameters and returns; Zod for external data.
- WCAG 2.1 AA: semantic HTML, keyboard access, visible focus, contrast (4.5:1 text, 3:1 UI), alt text, accessible names; mobile-first styles.
- Access token in memory only, never in localStorage or in load-function return data; sensitive calls from `+page.server.ts`; public pages use SSR; `ssr = false` only for interactive features.
- Dates only through `src/lib/utils/date.ts` helpers (no `toLocaleDateString` and friends elsewhere); never a numeric month in human-facing output.
- Theme tokens, never raw hexes or raw Tailwind palette hues; shared primitives (`PageHeader`, `StatusBadge`, `EmptyState`, `ToneTile`) over hand-rolled equivalents; `RevelWordmark.svelte` is the only way to render the wordmark.
- User-facing strings go through Paraglide in all six locales; file length caps (Svelte 750, TS/JS 500 lines; per-file overrides live in `scripts/check-file-length.sh`).
- Frontend-specific escape patterns worth checking on the sibling paths: stale in-flight requests and hydration into a new session, effect loops, TanStack Query cache invalidation after mutations, `throwOnError: false` treated as success, cross-organization writes after a slug change.

## Security triggers
No `/vuln-scan` hunters here yet; run the built-in `/security-review` and the security lane when a diff touches:
- Paths: `src/hooks.server.ts`, `src/lib/server/**`, `**/+page.server.ts`, `**/+layout.server.ts`, `**/+server.ts` (especially with auth, session, redirect or cookie logic), `src/routes/api/**`, `src/routes/auth/**`, `src/routes/impersonate/**`, `src/routes/embed/**`, `src/routes/oembed/**`, `src/lib/stores/auth*`, `src/lib/embed/**`, request logging and redaction code.
- Keywords: `auth`, `token`, `session`, `redirect`, `cookie`, `csp`, `tenant`, `embed`, `checkout`, `payment`, `stripe`, `{@html`, `innerHTML`, `postMessage`, `localStorage`.
- Dependencies, CI and packaging: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.github/workflows/**`, `Dockerfile`, `scripts/check-no-ssr-token.sh`.
- Anything that pairs with the reverse proxy in `../infra/Caddyfile` (headers, SSR streaming, host routing for tenants).

## Sibling repos
Read-only context (do not review or edit from here):
- `../revel-backend`: the API contract. Controllers in `src/events/controllers/`, schemas in `src/events/schema/`, services in `src/events/service/`, and the generated OpenAPI spec at `.artifacts/openapi.json` are the source of truth for endpoint behaviour and permissions; read them instead of guessing API semantics.
- `../infra`: `Caddyfile` and compose files.

## External reviewer and merge policy
- External reviewer: CodeRabbit (free tier, about 2 reviews per rate-limit window; after the window, comment `@coderabbitai full review`).
- Skip external review for: internal or tooling-only PRs.
- Merge: never merge and never enable auto-merge without explicit approval for that specific PR. Squash only. The repo requires signed commits, and GitHub's own rebase or `update-branch` produces unsigned commits, so when a PR is behind `main`, rebase locally and force-push; never merge `main` into the branch.

## Agent memory
Code-level suppressions and the findings ledger live outside git in the main checkout: `.claude/agent-memory/<agent>/MEMORY.md` (gitignored; worktrees do not have it, so pass the absolute path of the main checkout's copy to agents). Agents never write it; the orchestrating skill does, only with verifier-confirmed facts after maintainer approval.

## Debt metrics
Deterministic, run from the repo root with `git ls-files`/`git grep` so untracked and generated files never count.
- Svelte files over 650 lines and TS/JS files over 430 lines (caps are 750 and 500; generated API, paraglide, data and test files excluded):
  `git ls-files 'src/*.svelte' | grep -v -e src/lib/api/ -e src/lib/paraglide/ | xargs wc -l | awk '$2!="total" && $1>650'`
  `git ls-files 'src/*.ts' 'src/*.js' | grep -v -e src/lib/api/ -e src/lib/paraglide/ -e src/lib/data/ -e '\.test\.ts$' -e '\.spec\.ts$' -e '\.d\.ts$' | xargs wc -l | awk '$2!="total" && $1>430'`
- Files with a raised per-file cap: `grep -n 'max_for' -A40 scripts/check-file-length.sh`.
- `any` escapes and suppressions in non-test source:
  `git grep -n -E ':\s*any\b|as any\b|@ts-ignore|@ts-expect-error|eslint-disable' -- 'src/*.ts' 'src/*.svelte' ':!src/lib/api/**' ':!src/lib/paraglide/**' ':!*.test.ts' | wc -l`
- Legacy reactivity (should be zero): `git grep -n -E '^\s*\$:' -- 'src/*.svelte'`
- Hardcoded UI strings baseline: `node scripts/check-i18n-hardcoded.mjs` against `scripts/i18n-hardcoded-baseline.json` (the baseline should only shrink).
- Raw palette hues outside the exemptions: `git grep -n -E '(bg|text|border|ring|from|to)-(red|blue|green|emerald|indigo|amber|yellow|orange|pink|rose|violet|sky|cyan|teal|lime|fuchsia|purple|slate|gray|zinc|neutral|stone)-[0-9]{2,3}' -- 'src/*.svelte' 'src/*.ts' | wc -l`
- Unit test weight: `git ls-files 'src/*.test.ts' | xargs wc -l | sort -rn | head`.
