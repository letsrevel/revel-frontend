import type { LayoutServerLoad } from './$types';
import { getLocale } from '$lib/i18n';
import { EMBED_CACHE_CONTROL } from '$lib/embed/constants';
import { parseEmbedTheme, sanitizeUtmContent } from '$lib/embed/params';

/**
 * Embeds render fully server-side and ship no client bundle.
 *
 * `csr = false` is the whole "layout reset" the issue asks for: with no client
 * runtime, none of the root layout's machinery (TanStack Query, ModeWatcher,
 * the auth-refresh bootstrap, the `/version` call, the banners) can reach a
 * third-party page — and the iframe downloads a handful of KB instead of the
 * app bundle. The only script an embed loads is `/embed-frame-v1.js`, a static
 * ~1 KB file that reports its height to the host page.
 */
export const csr = false;
export const ssr = true;

export const load: LayoutServerLoad = async ({ url, setHeaders }) => {
	setHeaders({
		'cache-control': EMBED_CACHE_CONTROL,
		// The document's language is resolved from `?lang=` when present and from
		// Accept-Language otherwise, so a shared cache must key on it.
		vary: 'Accept-Language'
	});

	return {
		theme: parseEmbedTheme(url.searchParams.get('theme')),
		// Resolved by `i18nHandle` (URL param first, then Accept-Language — never
		// a cookie for embeds; see src/lib/i18n.ts).
		lang: getLocale(),
		// Host-page hostname, stamped on the iframe URL by the loader script and
		// echoed back onto every outbound link as `utm_content`.
		utmContent: sanitizeUtmContent(url.searchParams.get('utm_content')),
		// Set by /oembed on the iframe it hands to consumers. An oEmbed consumer's
		// page cannot be named (no hostname to read), so the attribution moves to
		// `utm_medium=oembed` instead of `utm_content`.
		viaOembed: url.searchParams.get('src') === 'oembed'
	};
};
