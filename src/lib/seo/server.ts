import { LANGS, type Lang } from './constants';
import { currentRequestLocale } from '$lib/server/request-locale';

/**
 * Language for SEO meta. Inside a request this is the request's UI locale (the
 * one i18nHandle resolved: ?lang, cookie, Accept-Language), so the title, meta
 * and og:locale always match the page and <html lang>. Outside a request
 * (unit tests) it falls back to the request's Accept-Language, defaulting to 'en'.
 *
 * For routes under hard-coded /de or /it prefixes (landing pages), pass the
 * lang explicitly to buildSeo instead of using this helper.
 */
export function resolveLang(request: Request): Lang {
	const requestLocale = currentRequestLocale();
	if (requestLocale) return requestLocale;

	const header = request.headers.get('accept-language');
	if (!header) return 'en';

	const candidates = header
		.split(',')
		.map((part) => {
			const [tag, q] = part.trim().split(';q=');
			return { tag: tag.toLowerCase(), q: q ? parseFloat(q) : 1.0 };
		})
		.sort((a, b) => b.q - a.q);

	for (const c of candidates) {
		const base = c.tag.split('-')[0];
		if ((LANGS as readonly string[]).includes(base)) return base as Lang;
	}
	return 'en';
}
