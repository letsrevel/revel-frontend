export const LANGS = ['en', 'de', 'it', 'fr'] as const;
export type Lang = (typeof LANGS)[number];

export const X_DEFAULT = 'x-default' as const;

export const OG_LOCALE: Record<Lang, string> = {
	en: 'en_US',
	de: 'de_DE',
	it: 'it_IT',
	fr: 'fr_FR'
};

export const SITE_NAME = 'Revel';
export const TWITTER_SITE = '@letsrevel';

// Versioned shareable assets (in static/). They are served with a 1-year
// immutable cache and scrapers (LinkedIn, Facebook, …) key their image
// caches by URL, so replacing the bytes in place is invisible to them.
// When the artwork changes: add a new file with a bumped suffix, point the
// constant at it, and keep the old file for already-scraped pages (#623).
export const OG_IMAGE_PATH = '/og-image-v2.png';
export const OG_LOGO_PATH = '/og-logo-v1.png';
