/**
 * Landing page content data for SEO pages.
 *
 * Public API entry point. Content objects live in per-page modules
 * (one file per landing-page slug, all locales); this module wires them into
 * the `landingPages` lookup map and exposes the lookup helpers.
 */
export type {
	LandingPageFeature,
	LandingPageCTA,
	LandingPageContent,
	LandingPageSlug
} from './types';
import type { LandingPageContent, LandingPageSlug } from './types';
import {
	eventbriteAlternativeEN,
	eventbriteAlternativeDE,
	eventbriteAlternativeIT,
	eventbriteAlternativeFR
} from './eventbrite-alternative';
import {
	queerEventManagementEN,
	queerEventManagementDE,
	queerEventManagementIT,
	queerEventManagementFR
} from './queer-event-management';
import {
	kinkEventTicketingEN,
	kinkEventTicketingDE,
	kinkEventTicketingIT,
	kinkEventTicketingFR
} from './kink-event-ticketing';
import {
	selfHostedEventPlatformEN,
	selfHostedEventPlatformDE,
	selfHostedEventPlatformIT,
	selfHostedEventPlatformFR
} from './self-hosted-event-platform';
import {
	privacyFocusedEventsEN,
	privacyFocusedEventsDE,
	privacyFocusedEventsIT,
	privacyFocusedEventsFR
} from './privacy-focused-events';
import {
	communityFirstEventPlatformEN,
	communityFirstEventPlatformDE,
	communityFirstEventPlatformIT,
	communityFirstEventPlatformFR
} from './community-first-event-platform';

export const landingPages: Record<string, Record<string, LandingPageContent>> = {
	en: {
		'eventbrite-alternative': eventbriteAlternativeEN,
		'queer-event-management': queerEventManagementEN,
		'kink-event-ticketing': kinkEventTicketingEN,
		'self-hosted-event-platform': selfHostedEventPlatformEN,
		'privacy-focused-events': privacyFocusedEventsEN,
		'community-first-event-platform': communityFirstEventPlatformEN
	},
	de: {
		'eventbrite-alternative': eventbriteAlternativeDE,
		'queer-event-management': queerEventManagementDE,
		'kink-event-ticketing': kinkEventTicketingDE,
		'self-hosted-event-platform': selfHostedEventPlatformDE,
		'privacy-focused-events': privacyFocusedEventsDE,
		'community-first-event-platform': communityFirstEventPlatformDE
	},
	it: {
		'eventbrite-alternative': eventbriteAlternativeIT,
		'queer-event-management': queerEventManagementIT,
		'kink-event-ticketing': kinkEventTicketingIT,
		'self-hosted-event-platform': selfHostedEventPlatformIT,
		'privacy-focused-events': privacyFocusedEventsIT,
		'community-first-event-platform': communityFirstEventPlatformIT
	},
	fr: {
		'eventbrite-alternative': eventbriteAlternativeFR,
		'queer-event-management': queerEventManagementFR,
		'kink-event-ticketing': kinkEventTicketingFR,
		'self-hosted-event-platform': selfHostedEventPlatformFR,
		'privacy-focused-events': privacyFocusedEventsFR,
		'community-first-event-platform': communityFirstEventPlatformFR
	}
};

export const landingPageSlugs: LandingPageSlug[] = [
	'eventbrite-alternative',
	'queer-event-management',
	'kink-event-ticketing',
	'self-hosted-event-platform',
	'privacy-focused-events',
	'community-first-event-platform'
];

export function getLandingPage(locale: string, slug: string): LandingPageContent | undefined {
	return landingPages[locale]?.[slug];
}

/**
 * Like {@link getLandingPage} but guarantees a non-null result.
 * Landing page routes are static and reference known-valid (locale, slug) pairs,
 * so a miss indicates a misconfigured route rather than a runtime condition;
 * throwing surfaces that at (SSR) render time with a clear message instead of
 * silently rendering `undefined`.
 */
export function getLandingPageOrThrow(locale: string, slug: string): LandingPageContent {
	const content = getLandingPage(locale, slug);
	if (!content) {
		throw new Error(`Missing landing page content for locale "${locale}" and slug "${slug}"`);
	}
	return content;
}

export function getAllLandingPages(): LandingPageContent[] {
	return Object.values(landingPages).flatMap((locale) => Object.values(locale));
}
