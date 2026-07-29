#!/usr/bin/env bash
# Assert that the type gate (`make types`) can actually fail.
#
# WHY THIS EXISTS
#
# `make types` passed vacuously for an unknown number of merges (#704). The
# cause was not a broken tsconfig or a wrong TypeScript version — it was a size
# limit inside the Svelte language service:
#
#   svelte-check → LSAndTSDocResolver → exceedsTotalSizeLimitForNonTsFiles()
#
# TypeScript caps a project at 20 MB of *non-TS* files
# (`maxProgramSizeForNonTsFiles`). `.svelte` files and the generated Paraglide
# `.js` message bundles both count. Once the total crossed 20 MB the language
# service silently switched to "reduced mode", `getScriptFileNames()` started
# returning an empty array, and svelte-check happily reported
# "0 errors" over a program that contained no project files at all.
#
# Nothing about that failure is visible in the output. It reports success. The
# scanned-FILES count is not a reliable signal either — it drifts for the same
# tree depending on how much got loaded before the limit was hit.
#
# The only decisive test is to introduce a known type error and confirm the
# gate reports it. That is what this script does.
#
# IT MUST RUN AGAINST THE REAL tsconfig.json. A small fixture project with its
# own config would never approach 20 MB, so it would pass green while the real
# gate was disarmed — exactly the failure this is meant to catch.
#
# See: revel-frontend#704

set -uo pipefail

TS_CANARY="src/lib/__type_gate_canary__.ts"
SVELTE_CANARY="src/routes/__TypeGateCanary__.svelte"
PARAGLIDE_OUTPUT="src/lib/paraglide/messages/_index.js"

# The generated Paraglide bundles are 16.6 of the project's 20.17 MB of non-TS
# files. Without them the project sits at ~4.5 MB — comfortably under the 20 MB
# limit — so reduced mode never triggers and this canary passes even with
# `disableSizeLimit` removed. That is a false ARMED: the check would be green
# while proving nothing. Refuse to run rather than report a result we can't
# stand behind.
if [ ! -f "$PARAGLIDE_OUTPUT" ]; then
	echo "❌ Cannot verify the type gate: generated i18n output is missing."
	echo
	echo "   Run 'pnpm paraglide:compile' first."
	echo
	echo "   $PARAGLIDE_OUTPUT and its siblings are most of the project's"
	echo "   non-TS bytes. Without them the project is too small to reach the"
	echo "   20 MB limit that disarmed the gate in #704, so this check would"
	echo "   pass regardless of whether the gate actually works."
	exit 1
fi

cleanup() {
	rm -f "$TS_CANARY" "$SVELTE_CANARY"
}
trap cleanup EXIT INT TERM

cleanup

# Two canaries in two different subtrees. Reduced mode drops the whole project
# at once, but a config change that silently narrows `include` might only drop
# one of src/lib or src/routes.
cat >"$TS_CANARY" <<'EOF'
// Temporary canary written by scripts/check-type-gate-armed.sh. If you are
// seeing this file in a diff, a type-gate run was interrupted — delete it.
export const typeGateCanary: number = 'not a number';
EOF

cat >"$SVELTE_CANARY" <<'EOF'
<script lang="ts">
	// Temporary canary written by scripts/check-type-gate-armed.sh. If you are
	// seeing this file in a diff, a type-gate run was interrupted — delete it.
	const typeGateCanary: number = 'not a number';
</script>

<p>{typeGateCanary}</p>
EOF

# `set -e` is deliberately off below (svelte-check exits non-zero by design here,
# since the canaries are errors), so sync failures have to be checked by hand —
# otherwise a broken sync would look like a disarmed gate.
if ! sync_output=$(pnpm svelte-kit sync 2>&1); then
	echo "❌ Cannot verify the type gate: 'svelte-kit sync' failed."
	echo "$sync_output"
	exit 1
fi

output=$(pnpm svelte-check --tsconfig ./tsconfig.json --output machine 2>&1)

FAILED=0
for canary in "$TS_CANARY" "$SVELTE_CANARY"; do
	if ! grep -q "ERROR \"$canary\"" <<<"$output"; then
		echo "❌ Type gate is DISARMED: no error reported for $canary"
		FAILED=1
	fi
done

if [ "$FAILED" -ne 0 ]; then
	cat <<'EOF'

A deliberate type error was not caught. `make types` is reporting success over
code it is not checking, and every .svelte and .ts file in the repo currently
has no type coverage.

Most likely cause: the project crossed TypeScript's 20 MB non-TS file limit
again and the language service dropped into reduced mode. Check that
tsconfig.json still sets:

    "disableSizeLimit": true

Other things worth checking:
  - tsconfig.json "include" still covers src/**/*.{ts,js,svelte}
  - a deprecated stub package under node_modules/@types/ emitting TS2688,
    which makes tsc skip semantic diagnostics entirely
  - svelte-check / typescript versions after an upgrade

See revel-frontend#704 for the full diagnosis.
EOF
	echo "--- svelte-check output (tail) ---"
	tail -5 <<<"$output"
	exit 1
fi

echo "✓ Type gate is armed (deliberate errors in .ts and .svelte both caught)"
