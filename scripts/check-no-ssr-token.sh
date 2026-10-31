#!/usr/bin/env bash
# Guard against re-introducing the SSR access-token leak.
#
# The access token must never reach the client through SvelteKit `data`
# (load-function return values are serialized into the page's HTML, so the
# bearer JWT would be visible in view-source / proxy logs). Client code reads
# the token from the in-memory `authStore` instead; server code uses
# `locals.user.accessToken` / `cookies.get('access_token')` directly and must
# not return it.
#
# This check fails if any pattern reappears:
#   1. Client components reading `data.accessToken` / `data.auth?.accessToken`.
#   2. A load function (+page.server.ts / +layout.server.ts) returning the
#      token in its data object.
#   3. Client components reading `data.user.accessToken` (also `?.` / `!.`).
#      `locals.user` carries the token, so a page that reads it from `data`
#      is relying on a load function that leaks it.
#   4. A load function returning the WHOLE `locals.user` (`user: locals.user`)
#      — it carries `accessToken`, so it serializes the token without ever
#      naming it, which pattern 2 cannot see. Return picked fields instead.
#
# See: revel-frontend#387, commit 859ec68.

set -e

FAILED=0

# 1. Client-side reads of the token from page data (.svelte / .ts / .svelte.ts).
#    Matches data.accessToken, data.auth?.accessToken and data.auth!.accessToken.
#    The generated API client is excluded — page-data reads never live there.
client_hits=$(grep -rnE "data\.(auth[?!]?\.)?accessToken" src \
	--include="*.svelte" --include="*.ts" --exclude-dir=generated || true)
if [ -n "$client_hits" ]; then
	echo "❌ Client components must read the token from authStore, not page data:"
	echo "$client_hits"
	FAILED=1
fi

# 2. Server load functions returning the token to the client.
#    Scoped to +page.server.ts / +layout.server.ts — those returns become the
#    page `data` that gets serialized. Other *.server.ts files (hooks.server.ts
#    setting `locals.user`, server utilities) are server-only and excluded.
#    Matches `accessToken: <expr>` and the `accessToken` object shorthand. The
#    legitimate server-only uses — `const accessToken = cookies.get(...)`,
#    `locals.user.accessToken`, `Authorization: Bearer ${accessToken}` — don't
#    match this anchored pattern.
server_hits=$(grep -rnE "^[[:space:]]*accessToken([,:][[:space:]]|$)" src \
	--include="+page.server.ts" --include="+layout.server.ts" || true)
if [ -n "$server_hits" ]; then
	echo "❌ Load functions must not return the access token (it ends up in SSR HTML):"
	echo "$server_hits"
	FAILED=1
fi

# 3. Client-side reads of `data.user.accessToken`.
user_hits=$(grep -rnE "data\.user[?!]?\.accessToken" src \
	--include="*.svelte" --include="*.ts" --exclude-dir=generated || true)
if [ -n "$user_hits" ]; then
	echo "❌ Client components must read the token from authStore, not data.user:"
	echo "$user_hits"
	FAILED=1
fi

# 4. Load functions returning the whole `locals.user` (token included).
whole_user_hits=$(grep -rnE ":[[:space:]]*locals\.user[[:space:]]*,?$" src \
	--include="+page.server.ts" --include="+layout.server.ts" || true)
if [ -n "$whole_user_hits" ]; then
	echo "❌ Load functions must not return all of locals.user (it carries the access token):"
	echo "$whole_user_hits"
	FAILED=1
fi

if [ "$FAILED" -eq 0 ]; then
	echo "✓ No SSR access-token leaks"
fi

exit $FAILED
