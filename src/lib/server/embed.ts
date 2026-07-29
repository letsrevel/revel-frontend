/**
 * Server-side plumbing for the `/embed` surface.
 *
 * Three things have to happen outside the route tree, because they concern the
 * document shell rather than the page:
 *
 *  1. `frame-ancestors` — the build-time CSP in `svelte.config.js` pins
 *     `frame-ancestors 'none'` for the whole app. Embeds exist to be framed, so
 *     the header is rewritten per response for `/embed/*` only.
 *  2. Theme — embeds must not use `localStorage` (it is partitioned per host
 *     page inside a third-party iframe, so it is both empty and meaningless
 *     there). `?theme=light|dark` is therefore applied to `<html>` server-side.
 *  3. Cookies — the i18n hook writes locale cookies on every request; embeds
 *     skip them so the response stays shared-cacheable and so `?lang=` never
 *     depends on cookie storage a browser may partition or block.
 */

import { parseEmbedTheme } from '$lib/embed/params';
import { isEmbedPath, type EmbedTheme } from '$lib/embed/constants';

/** Placeholder in `src/app.html` replaced with per-request `<html>` attributes. */
export const ROOT_ATTRIBUTES_PLACEHOLDER = '%revel.rootAttributes%';

/**
 * Extra attributes for the `<html>` element of an embed document.
 *
 * `data-theme-locked` tells the anti-FOUC script in `src/app.html` to stand
 * down: it normally resolves the theme from `localStorage`, which inside an
 * iframe would fight the explicit `?theme=` the organizer asked for.
 *
 * `auto` deliberately returns no attributes — the anti-FOUC script's own
 * default ("system") already means `prefers-color-scheme`, which is exactly
 * what `auto` should do, and leaving it in charge keeps the behaviour in one
 * place.
 */
export function embedRootAttributes(theme: EmbedTheme): string {
	if (theme === 'dark') {
		return 'class="dark" style="color-scheme: dark" data-theme-locked="dark"';
	}
	if (theme === 'light') {
		return 'style="color-scheme: light" data-theme-locked="light"';
	}
	return '';
}

/** `<html>` attributes for a request, given its pathname and query string. */
export function rootAttributesFor(url: URL): string {
	if (!isEmbedPath(url.pathname)) return '';
	return embedRootAttributes(parseEmbedTheme(url.searchParams.get('theme')));
}
