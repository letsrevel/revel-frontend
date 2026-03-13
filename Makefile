.PHONY: dev build preview format format-check lint lint-fix types i18n-check file-length check fix test test-coverage test-e2e generate-api bump-version bump-minor release

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

i18n-check:
	pnpm i18n:compile

file-length:
	@./scripts/check-file-length.sh

# ─────────────────────────────────────────────
# Combined checks — run before committing
# ─────────────────────────────────────────────

# Equivalent to backend's `make check`: format, lint, types, i18n, file-length
check: format-check lint types i18n-check file-length

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
