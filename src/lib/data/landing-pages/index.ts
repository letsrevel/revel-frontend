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
	LandingPageLocale,
	LandingPageSlug
} from './types';
import type { LandingPageContent, LandingPageLocale, LandingPageSlug } from './types';
import {
	eventbriteAlternativeEN,
	eventbriteAlternativeDE,
	eventbriteAlternativeIT,
	eventbriteAlternativeFR,
	eventbriteAlternativeES,
	eventbriteAlternativePT
} from './eventbrite-alternative';
import {
	queerEventManagementEN,
	queerEventManagementDE,
	queerEventManagementIT,
	queerEventManagementFR,
	queerEventManagementES,
	queerEventManagementPT
} from './queer-event-management';
import {
	kinkEventTicketingEN,
	kinkEventTicketingDE,
	kinkEventTicketingIT,
	kinkEventTicketingFR,
	kinkEventTicketingES,
	kinkEventTicketingPT
} from './kink-event-ticketing';
import {
	selfHostedEventPlatformEN,
	selfHostedEventPlatformDE,
	selfHostedEventPlatformIT,
	selfHostedEventPlatformFR,
	selfHostedEventPlatformES,
	selfHostedEventPlatformPT
} from './self-hosted-event-platform';
import {
	privacyFocusedEventsEN,
	privacyFocusedEventsDE,
	privacyFocusedEventsIT,
	privacyFocusedEventsFR,
	privacyFocusedEventsES,
	privacyFocusedEventsPT
} from './privacy-focused-events';
import {
	communityFirstEventPlatformEN,
	communityFirstEventPlatformDE,
	communityFirstEventPlatformIT,
	communityFirstEventPlatformFR,
	communityFirstEventPlatformES,
	communityFirstEventPlatformPT
} from './community-first-event-platform';
import {
	clubMembershipManagementEN,
	clubMembershipManagementDE,
	clubMembershipManagementIT,
	clubMembershipManagementFR,
	clubMembershipManagementES,
	clubMembershipManagementPT
} from './club-membership-management';

/**
 * Total map: every locale × every slug. TypeScript now rejects a landing page that
 * is missing a locale (or a locale missing a page) at compile time — previously both
 * index signatures were `string`, so an incomplete page compiled and broke silently.
 */
export const landingPages: Record<
	LandingPageLocale,
	Record<LandingPageSlug, LandingPageContent>
> = {
	en: {
		'eventbrite-alternative': eventbriteAlternativeEN,
		'queer-event-management': queerEventManagementEN,
		'kink-event-ticketing': kinkEventTicketingEN,
		'self-hosted-event-platform': selfHostedEventPlatformEN,
		'privacy-focused-events': privacyFocusedEventsEN,
		'community-first-event-platform': communityFirstEventPlatformEN,
		'club-membership-management': clubMembershipManagementEN
	},
	de: {
		'eventbrite-alternative': eventbriteAlternativeDE,
		'queer-event-management': queerEventManagementDE,
		'kink-event-ticketing': kinkEventTicketingDE,
		'self-hosted-event-platform': selfHostedEventPlatformDE,
		'privacy-focused-events': privacyFocusedEventsDE,
		'community-first-event-platform': communityFirstEventPlatformDE,
		'club-membership-management': clubMembershipManagementDE
	},
	it: {
		'eventbrite-alternative': eventbriteAlternativeIT,
		'queer-event-management': queerEventManagementIT,
		'kink-event-ticketing': kinkEventTicketingIT,
		'self-hosted-event-platform': selfHostedEventPlatformIT,
		'privacy-focused-events': privacyFocusedEventsIT,
		'community-first-event-platform': communityFirstEventPlatformIT,
		'club-membership-management': clubMembershipManagementIT
	},
	fr: {
		'eventbrite-alternative': eventbriteAlternativeFR,
		'queer-event-management': queerEventManagementFR,
		'kink-event-ticketing': kinkEventTicketingFR,
		'self-hosted-event-platform': selfHostedEventPlatformFR,
		'privacy-focused-events': privacyFocusedEventsFR,
		'community-first-event-platform': communityFirstEventPlatformFR,
		'club-membership-management': clubMembershipManagementFR
	},
	es: {
		'eventbrite-alternative': eventbriteAlternativeES,
		'queer-event-management': queerEventManagementES,
		'kink-event-ticketing': kinkEventTicketingES,
		'self-hosted-event-platform': selfHostedEventPlatformES,
		'privacy-focused-events': privacyFocusedEventsES,
		'community-first-event-platform': communityFirstEventPlatformES,
		'club-membership-management': clubMembershipManagementES
	},
	pt: {
		'eventbrite-alternative': eventbriteAlternativePT,
		'queer-event-management': queerEventManagementPT,
		'kink-event-ticketing': kinkEventTicketingPT,
		'self-hosted-event-platform': selfHostedEventPlatformPT,
		'privacy-focused-events': privacyFocusedEventsPT,
		'community-first-event-platform': communityFirstEventPlatformPT,
		'club-membership-management': clubMembershipManagementPT
	}
};

export const landingPageSlugs: LandingPageSlug[] = [
	'eventbrite-alternative',
	'queer-event-management',
	'kink-event-ticketing',
	'self-hosted-event-platform',
	'privacy-focused-events',
	'community-first-event-platform',
	'club-membership-management'
];

export function getLandingPage(locale: string, slug: string): LandingPageContent | undefined {
	// Callers pass raw route params, so widen for the lookup; the literal above is
	// what carries the completeness guarantee.
	const table: Record<string, Record<string, LandingPageContent>> = landingPages;
	return table[locale]?.[slug];
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
