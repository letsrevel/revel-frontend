/**
 * Landing page content data for SEO pages
 * Each page targets specific keywords and audiences with tailored messaging
 */

export interface LandingPageFeature {
	icon:
		| 'ticket'
		| 'shield'
		| 'users'
		| 'server'
		| 'eye'
		| 'check'
		| 'euro'
		| 'lock'
		| 'heart'
		| 'globe'
		| 'code'
		| 'clipboard';
	title: string;
	description: string;
}

export interface LandingPageCTA {
	text: string;
	href: string;
	variant: 'primary' | 'secondary' | 'outline';
}

export interface LandingPageContent {
	slug: string;
	locale: 'en' | 'de' | 'it' | 'fr';
	meta: {
		title: string;
		description: string;
		keywords: string;
	};
	hero: {
		headline: string;
		subheadline: string;
	};
	intro: {
		paragraphs: string[];
	};
	features: LandingPageFeature[];
	benefits: {
		title: string;
		items: string[];
	};
	cta: {
		title: string;
		description: string;
		buttons: LandingPageCTA[];
	};
	faq: Array<{
		question: string;
		answer: string;
	}>;
	relatedPages: string[];
}

export type LandingPageSlug =
	| 'eventbrite-alternative'
	| 'queer-event-management'
	| 'kink-event-ticketing'
	| 'self-hosted-event-platform'
	| 'privacy-focused-events'
	| 'community-first-event-platform';
