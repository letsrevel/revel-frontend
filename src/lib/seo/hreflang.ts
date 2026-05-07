import { LANGS, X_DEFAULT, type Lang } from './constants';

export type HreflangEntry = { lang: Lang | typeof X_DEFAULT; href: string };

/**
 * Same URL across all locales. Use for pages where Paraglide localizes chrome
 * but content stays at one canonical URL (events, orgs, series, listings).
 */
export function sameUrlHreflang(absoluteUrl: string): HreflangEntry[] {
	return [
		...LANGS.map((lang) => ({ lang, href: absoluteUrl }) as HreflangEntry),
		{ lang: X_DEFAULT, href: absoluteUrl }
	];
}

/**
 * Per-locale URL prefixes for hand-rolled landing pages.
 * en is at root, de under /de, it under /it, x-default = en.
 */
export function landingPageHreflang(origin: string, slug: string): HreflangEntry[] {
	const prefix: Record<Lang, string> = { en: '', de: '/de', it: '/it' };
	return [
		...LANGS.map(
			(lang) => ({ lang, href: `${origin}${prefix[lang]}/${slug}` }) as HreflangEntry
		),
		{ lang: X_DEFAULT, href: `${origin}/${slug}` }
	];
}
