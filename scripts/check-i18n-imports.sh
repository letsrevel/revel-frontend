#!/bin/bash

# Check for missing i18n imports in Svelte files
# This script finds files using m['...'] syntax without importing the m module

echo "🔍 Checking for missing i18n imports..."

errors=0

# Find all .svelte files using m['...'] syntax
for file in $(grep -r "m\['" src --include="*.svelte" -l 2>/dev/null); do
  # Check if the file imports m from paraglide
  if ! grep -q "import.*m.*from.*paraglide" "$file"; then
    echo "❌ Missing i18n import: $file"
    echo "   Add: import * as m from '\$lib/paraglide/messages.js';"
    errors=$((errors + 1))
  fi
done

# Also check for explicit m.translationKey() calls (with underscores/dots pattern)
for file in $(grep -rE "\bm\.[a-zA-Z_]+[a-zA-Z0-9_]*\(" src --include="*.svelte" -l 2>/dev/null); do
  # Skip files that already have the import
  if grep -q "import.*m.*from.*paraglide" "$file"; then
    continue
  fi

  # Check if it's actually using m as paraglide (translation keys typically have underscores)
  # But filter out common false positives like item.method, etc.
  if grep -qE "\bm\.[a-zA-Z]+_[a-zA-Z0-9_]+\(" "$file"; then
    echo "❌ Missing i18n import: $file"
    echo "   Add: import * as m from '\$lib/paraglide/messages.js';"
    errors=$((errors + 1))
  fi
done

if [ $errors -eq 0 ]; then
  echo "✅ All files have proper i18n imports!"
  exit 0
else
  echo ""
  echo "❌ Found $errors file(s) with missing i18n imports"
  exit 1
fi
