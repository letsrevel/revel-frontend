import { LANGS, type Lang } from './constants';

/**
 * Best-effort language detection for SEO meta. Reads the request's Accept-Language
 * and returns the highest-priority supported language, defaulting to 'en'.
 *
 * For routes under hard-coded /de or /it prefixes (landing pages), pass the
 * lang explicitly to buildSeo instead of using this helper.
 */
export function resolveLang(request: Request): Lang {
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
