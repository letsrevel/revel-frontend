#!/usr/bin/env bash
# Check that no source file exceeds the maximum line count.
# Usage: ./scripts/check-file-length.sh [svelte_max] [ts_max]
# Defaults: 750 (Svelte), 500 (TypeScript/JS)
#
# Excluded:
#   - src/lib/api/generated/   (auto-generated API client)
#   - src/lib/paraglide/       (auto-generated i18n)
#   - src/lib/data/            (static data files)
#   - *.test.ts, *.spec.ts     (test files)
#   - *.d.ts                   (type declarations)

set -e

SVELTE_MAX=${1:-750}
TS_MAX=${2:-500}
FAILED=0

# Check Svelte files
while IFS= read -r -d '' file; do
    lines=$(wc -l < "$file")
    if [ "$lines" -gt "$SVELTE_MAX" ]; then
        echo "❌ $file has $lines lines (max: $SVELTE_MAX)"
        FAILED=1
    fi
done < <(find src -name "*.svelte" \
    -not -path "*/api/generated/*" \
    -not -path "*/paraglide/*" \
    -print0)

# Check TypeScript/JavaScript files
while IFS= read -r -d '' file; do
    lines=$(wc -l < "$file")
    if [ "$lines" -gt "$TS_MAX" ]; then
        echo "❌ $file has $lines lines (max: $TS_MAX)"
        FAILED=1
    fi
done < <(find src \( -name "*.ts" -o -name "*.js" \) \
    -not -name "*.test.ts" \
    -not -name "*.spec.ts" \
    -not -name "*.test.js" \
    -not -name "*.spec.js" \
    -not -name "*.d.ts" \
    -not -path "*/api/generated/*" \
    -not -path "*/paraglide/*" \
    -not -path "*/data/*" \
    -print0)

if [ "$FAILED" -eq 0 ]; then
    echo "✅ All files are within line limits (Svelte: $SVELTE_MAX, TS/JS: $TS_MAX)."
fi

exit $FAILED
