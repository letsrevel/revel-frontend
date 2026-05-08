export const LANGS = ['en', 'de', 'it'] as const;
export type Lang = (typeof LANGS)[number];

export const X_DEFAULT = 'x-default' as const;

export const OG_LOCALE: Record<Lang, string> = {
	en: 'en_US',
	de: 'de_DE',
	it: 'it_IT'
};

export const SITE_NAME = 'Revel';
export const TWITTER_SITE = '@letsrevel';
