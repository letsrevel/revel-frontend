import type { Lang } from './constants';

export type Robots = 'index,follow' | 'noindex,follow' | 'noindex,nofollow';

export interface SeoConfig {
	title: string;
	description: string;
	canonical: string;
	robots?: Robots;
	og: {
		type: 'website' | 'profile' | 'event' | 'article';
		title: string;
		description: string;
		url: string;
		image?: string;
		imageAlt?: string;
		imageWidth?: number;
		imageHeight?: number;
		imageType?: string;
		siteName: string;
		locale: string;
		localeAlternate: string[];
	};
	twitter: {
		card: 'summary' | 'summary_large_image';
		title: string;
		description: string;
		image?: string;
		imageAlt?: string;
		site: string;
	};
	hreflang: Array<{ lang: Lang | typeof import('./constants').X_DEFAULT; href: string }>;
	jsonLd: object[];
}
