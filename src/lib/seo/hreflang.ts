import { LANGS, X_DEFAULT, type Lang } from './constants';

export type HreflangEntry = { lang: Lang | typeof X_DEFAULT; href: string };

/**
 * Per-locale URL prefixes for hand-rolled landing pages — the only pages with
 * real language versions. Pages served at ONE URL (events, orgs, series,
 * listings, plain pages: Paraglide localizes the chrome by cookie, content is
 * untranslated) emit no hreflang at all (#994).
 * en is at root, de under /de, it under /it, fr under /fr, es under /es,
 * pt under /pt, x-default = en.
 */
export function landingPageHreflang(origin: string, slug: string): HreflangEntry[] {
	const prefix: Record<Lang, string> = {
		en: '',
		de: '/de',
		it: '/it',
		fr: '/fr',
		es: '/es',
		pt: '/pt'
	};
	return [
		...LANGS.map((lang) => ({ lang, href: `${origin}${prefix[lang]}/${slug}` }) as HreflangEntry),
		{ lang: X_DEFAULT, href: `${origin}/${slug}` }
	];
}
