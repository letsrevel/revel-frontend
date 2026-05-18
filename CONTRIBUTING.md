# Contributing to Revel Frontend

Thanks for your interest in contributing. This guide is intentionally short — the bar to clear is straightforward.

## Prerequisites

- Node.js 20+
- pnpm 9+
- A running [revel-backend](https://github.com/letsrevel/revel-backend) (or access to a deployed one)

## Quickstart

```bash
git clone https://github.com/letsrevel/revel-frontend.git
cd revel-frontend
pnpm install
make dev
```

Detailed setup, deployment, and operational guides live in [`docs/runbooks/`](./docs/runbooks).

## Workflow

1. Branch from `main`: `feature/<short-name>` or `fix/<short-name>`.
2. Make changes. Keep commits focused; use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
3. Run the quality gate locally:
   ```bash
   make fix      # auto-fix formatting + lint
   make check    # quality gate: format, lint, types, i18n, file-length
   make test     # unit tests
   ```
4. Push and open a PR. CI runs the same checks; both must be green.

## What we expect from a PR

- **Svelte 5 Runes only.** No legacy `$:` syntax, no `export let`, no `createEventDispatcher`. Use `$state`, `$derived`, `$effect`, `$props`.
- **TypeScript strict.** No `any`. Use `unknown` when the type is genuinely unknown.
- **Accessibility is not optional.** WCAG 2.1 AA — semantic HTML, keyboard support, contrast, `alt` text, labelled controls.
- **Mobile-first.** Design for mobile, enhance with Tailwind breakpoints.
- **No manually written API code.** The TypeScript API client is regenerated from the backend OpenAPI spec via `make generate-api`.
- **File length limits.** Svelte ≤ 750 lines, TS/JS ≤ 500 lines. `make check` enforces this.

## Useful commands

| Command | What it does |
|---|---|
| `make dev` | Dev server on `0.0.0.0:5173` (mobile-accessible on LAN) |
| `make build` | Production build |
| `make fix` | Auto-fix formatting + lint |
| `make check` | Quality gate (format, lint, types, i18n, file-length) |
| `make test` / `make test-e2e` | Unit / end-to-end tests |
| `make generate-api` | Regenerate API client from backend OpenAPI spec |

## Reporting bugs / requesting features

Open a GitHub issue. For security issues, please email the maintainers privately rather than opening a public issue.
