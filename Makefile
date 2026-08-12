.PHONY: dev build preview format format-check lint lint-fix types types-canary i18n-check i18n-freshness i18n-hardcoded i18n-hardcoded-update i18n-untranslated file-length no-ssr-token audit-images audit-soft-404 audit licensecheck audit-deps check fix test test-coverage test-e2e generate-api bump-version bump-minor release e2e-setup e2e-run e2e e2e-teardown

# ─────────────────────────────────────────────
# Development
# ─────────────────────────────────────────────

dev:
	pnpm dev

build:
	pnpm build

preview:
	pnpm preview

# ─────────────────────────────────────────────
# Code Quality — individual checks
# ─────────────────────────────────────────────

format:
	pnpm prettier --write .

format-check:
	pnpm prettier --check .

lint:
	pnpm eslint . --max-warnings 0

lint-fix:
	pnpm eslint . --fix

types:
	pnpm svelte-kit sync && pnpm svelte-check --tsconfig ./tsconfig.json

# Prove the gate above can actually fail. `make types` passed vacuously for an
# unknown number of merges (#704) — svelte-check reported "0 errors" over a
# program containing no project files. Only a deliberately injected error
# detects that; the scanned-file count does not.
types-canary:
	@./scripts/check-type-gate-armed.sh

i18n-check:
	pnpm i18n:compile

# Assert the compiled Paraglide bundle (src/lib/paraglide/messages/*.js) covers
# every key in messages/*.json, BEFORE i18n-check recompiles it out from under
# us. A stale bundle here means messages/*.json changed and `pnpm
# paraglide:compile` wasn't re-run and committed — any page referencing the
# missing key hard-500s at runtime (#789). Also the first step of `pnpm build`
# so the same staleness fails a build, not just `make check`.
i18n-freshness:
	@node scripts/check-paraglide-freshness.mjs

# Guard against shipping untranslated user-facing copy: fails if a NEW hardcoded
# string (toast / aria-label / placeholder / title / alt / visible text) appears
# outside the catalog. SEO landing pages are excluded; legitimate non-prose lives
# in scripts/i18n-hardcoded-baseline.json or carries an `i18n-ignore` comment.
i18n-hardcoded:
	@node scripts/check-i18n-hardcoded.mjs

# Regenerate the baseline after intentionally accepting non-translatable literals.
# Guard against shipping the English string as a "translation": fails when a target
# locale's value is byte-identical to English and the pair is not recorded in
# scripts/i18n-identical-allowlist.json. No --update flag by design.
i18n-untranslated:
	@node scripts/check-i18n-untranslated.mjs

i18n-hardcoded-update:
	@node scripts/check-i18n-hardcoded.mjs --update

file-length:
	@./scripts/check-file-length.sh

no-ssr-token:
	@./scripts/check-no-ssr-token.sh

audit-images:
	pnpm audit:images

audit-soft-404:
	pnpm tsx scripts/audit-soft-404.ts

# ─────────────────────────────────────────────
# Dependency security — backend parity (deps.yml / nightly-audit.yml)
# ─────────────────────────────────────────────

# Fail on known CVEs in shipped (production) dependencies at high severity or above.
# Non-applicable advisories are documented in package.json -> pnpm.auditConfig.ignoreGhsas.
# Mirrors the backend's `make audit` (pip-audit --strict).
audit:
	pnpm audit --prod --audit-level=high

# Fail if a copyleft / source-available license enters the dependency tree.
# Mirrors the backend's `make licensecheck`.
licensecheck:
	node scripts/check-licenses.mjs

# Both dependency gates together (what the deps.yml workflow runs).
audit-deps: audit licensecheck

# ─────────────────────────────────────────────
# Combined checks — run before committing
# ─────────────────────────────────────────────

# Equivalent to backend's `make check`: format, lint, types, i18n, file-length
# i18n-check runs before the type checks: it compiles the Paraglide messages that
# svelte-check resolves `$$lib/paraglide/*` against, and the canary refuses to run
# without them (see scripts/check-type-gate-armed.sh).
check: format-check lint i18n-freshness i18n-check i18n-untranslated types types-canary i18n-hardcoded file-length no-ssr-token audit-images

# Auto-fix everything that can be auto-fixed
fix: format lint-fix

# ─────────────────────────────────────────────
# Testing
# ─────────────────────────────────────────────

test:
	@pnpm vitest run 2>&1 | tee .tests.output.full; \
	exit_code=$${PIPESTATUS[0]}; \
	if [ $$exit_code -eq 0 ]; then rm -f .tests.output.full .tests.output; \
	else sed -n '/^⎯.*FAILED/,$$p' .tests.output.full > .tests.output; rm -f .tests.output.full; \
	echo "\nTest failures saved to .tests.output"; fi; \
	exit $$exit_code

test-coverage:
	pnpm vitest run --coverage

test-e2e:
	pnpm playwright test

# ─────────────────────────────────────────────
# E2E — full-stack quality-of-life targets
# ─────────────────────────────────────────────

BACKEND_DIR := ../revel-backend

# Spin up + reseed the backend for an E2E run: docker + PgBouncer + a
# daemonized gunicorn (pid/log at $(BACKEND_DIR)/.e2e-gunicorn.*), preceded by
# the canonical reseed. Idempotent — any stale backend on :8000 is killed
# first. Out of scope: `stripe listen` (interactive auth; Stripe specs
# self-skip). Don't run from worktrees: one backend instance, one :8000.
e2e-setup:
	@test -d $(BACKEND_DIR) || { echo "❌ $(BACKEND_DIR) not found — expected the backend checkout next to this repo"; exit 1; }
	$(MAKE) -C $(BACKEND_DIR) e2e-seed
	$(MAKE) -C $(BACKEND_DIR) run-e2e-daemon

# Playwright suite with a mass-skip guard: journey specs self-skip when the
# backend probe fails, so a wedged backend yields exit 0 with hundreds of
# skips (false green). Warn loudly, don't fail — partial runs (--grep) skip
# legitimately. `make test-e2e` remains the raw, guard-free run.
e2e-run:
	@pnpm playwright test 2>&1 | tee .e2e.output; \
	exit_code=$${PIPESTATUS[0]}; \
	skipped=$$(grep -oE '[0-9]+ skipped' .e2e.output | tail -1 | grep -oE '[0-9]+' || true); \
	if [ -n "$$skipped" ] && [ "$$skipped" -gt 10 ]; then \
		echo ""; \
		echo "⚠️⚠️⚠️  $$skipped tests SKIPPED — possible mass-skip FALSE GREEN (exit code $$exit_code)."; \
		echo "Journey specs self-skip when the backend probe fails. Verify the backend"; \
		echo "is healthy (make e2e-setup) before trusting this result."; \
	fi; \
	exit $$exit_code

# The whole thing: backend up + reseeded, then the suite.
e2e: e2e-setup
	$(MAKE) e2e-run

# Stop the daemonized backend. The docker stack (postgres/redis/mailpit/
# pgbouncer) stays up — it's the shared dev environment.
e2e-teardown:
	$(MAKE) -C $(BACKEND_DIR) stop-e2e

# ─────────────────────────────────────────────
# API client
# ─────────────────────────────────────────────

generate-api:
	pnpm generate:api

# ─────────────────────────────────────────────
# Version management
# ─────────────────────────────────────────────

bump-version:
	@current=$$(node -p "require('./package.json').version"); \
	major=$$(echo $$current | cut -d. -f1); \
	minor=$$(echo $$current | cut -d. -f2); \
	patch=$$(echo $$current | cut -d. -f3); \
	new_patch=$$((patch + 1)); \
	new_version="$$major.$$minor.$$new_patch"; \
	node -e "const pkg = require('./package.json'); pkg.version = '$$new_version'; require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, '\t') + '\n')"; \
	echo "New version: $$new_version"

bump-minor:
	@current=$$(node -p "require('./package.json').version"); \
	major=$$(echo $$current | cut -d. -f1); \
	minor=$$(echo $$current | cut -d. -f2); \
	new_minor=$$((minor + 1)); \
	new_version="$$major.$$new_minor.0"; \
	node -e "const pkg = require('./package.json'); pkg.version = '$$new_version'; require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, '\t') + '\n')"; \
	echo "New version: $$new_version"

release:
	@VERSION=$$(node -p "require('./package.json').version"); \
	echo "Current version: $$VERSION"; \
	read -p "Do you want to create a release v$$VERSION? (y/n): " confirm && if [ "$$confirm" = "y" ]; then \
		gh release create "v$$VERSION" --generate-notes; \
	else \
		echo "Release aborted."; \
	fi
