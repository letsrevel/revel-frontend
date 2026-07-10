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
#
# Per-file cap overrides: see max_for() below. An override raises the cap for
# one file (with rationale) instead of un-gating it entirely (#557).

set -e

SVELTE_MAX=${1:-750}
TS_MAX=${2:-500}
FAILED=0

# Per-file cap overrides — the only sanctioned way for a file to exceed the
# default cap. Each entry needs a rationale; the override IS the ceiling
# (no hardcoded current line counts).
#   auth.svelte.ts → 620: token race guards + single-flight refresh thread all
#   state through one class; split rejected twice as invariant-threatening
#   (#544 Task 12/13 analyses, #557). Raised 550→620 for the bootstrap gate +
#   interrupted-rotation retry (#596) — both must share the store's settle
#   points (setAccessToken/logout), so they belong to the same class.
max_for() {
    case "$1" in
        src/lib/stores/auth.svelte.ts) echo 620 ;;
        *) echo "$2" ;;
    esac
}

# Check Svelte files
while IFS= read -r -d '' file; do
    lines=$(wc -l < "$file")
    max=$(max_for "$file" "$SVELTE_MAX")
    if [ "$lines" -gt "$max" ]; then
        echo "❌ $file has $lines lines (max: $max)"
        FAILED=1
    fi
done < <(find src -name "*.svelte" \
    -not -path "*/api/generated/*" \
    -not -path "*/paraglide/*" \
    -print0)

# Check TypeScript/JavaScript files
while IFS= read -r -d '' file; do
    lines=$(wc -l < "$file")
    max=$(max_for "$file" "$TS_MAX")
    if [ "$lines" -gt "$max" ]; then
        echo "❌ $file has $lines lines (max: $max)"
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
