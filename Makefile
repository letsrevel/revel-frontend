.PHONY: dev build check lint format test release bump-version bump-minor

# Development
dev:
	pnpm dev

build:
	pnpm build

check:
	pnpm check

lint:
	pnpm lint

format:
	pnpm format

test:
	pnpm test

# Version management
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
