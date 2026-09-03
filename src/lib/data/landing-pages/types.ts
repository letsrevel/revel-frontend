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
	locale: 'en' | 'de' | 'it' | 'fr' | 'es' | 'pt';
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

/**
 * The locales every landing page must provide. Derived from `LandingPageContent`
 * so the two can't drift. Used to type the `landingPages` lookup as a total map:
 * these pages are hand-authored per locale (they are NOT in messages/*.json, so no
 * i18n check covers them), and before this was `Record<string, …>` a page could ship
 * with only some locales and silently 404 the rest.
 */
export type LandingPageLocale = LandingPageContent['locale'];

export type LandingPageSlug =
	| 'eventbrite-alternative'
	| 'queer-event-management'
	| 'kink-event-ticketing'
	| 'self-hosted-event-platform'
	| 'privacy-focused-events'
	| 'community-first-event-platform'
	| 'club-membership-management';
