/**
 * Organization warning rules (#1314, A1, A4, A5). Pure functions: each returns
 * an `AdminWarning`, or `null` when the setting is fine. Callers add the fix
 * target and the action.
 */
import * as m from '$lib/paraglide/messages.js';
import type { AdminWarning } from './types';

/**
 * True when anonymous visitors cannot open the organization page: every
 * visibility except `public` and `unlisted` (private, members-only, staff-only).
 */
export function isOrgRestricted(visibility: string | null | undefined): boolean {
	return visibility != null && visibility !== 'public' && visibility !== 'unlisted';
}

export interface OrgPublicEventsInput {
	orgVisibility: string | null | undefined;
	/** Upcoming events that visitors can see (public or unlisted, open or closed). */
	publicEventCount: number;
	/** How many of those events are in a series. */
	inSeriesCount: number;
	/** More rows exist than were counted, so the counts are lower bounds. */
	partial: boolean;
}

/**
 * A1 (merged with the old A2): a restricted organization still has upcoming
 * events that visitors can see. The series sentence is true before and after
 * the backend series-visibility release.
 */
export function orgHiddenWithPublicEvents(input: OrgPublicEventsInput): AdminWarning | null {
	if (!isOrgRestricted(input.orgVisibility) || !(input.publicEventCount > 0)) return null;
	return {
		id: 'A1',
		level: 'warn',
		title: () => m['adminWarnings.orgA1Title'](),
		message: () => {
			const parts = [
				m['adminWarnings.orgA1Message'](),
				input.partial
					? m['adminWarnings.orgA1CountPartial']({ count: input.publicEventCount })
					: m['adminWarnings.orgA1Count']({ count: input.publicEventCount })
			];
			if (input.inSeriesCount > 0) parts.push(m['adminWarnings.orgA1Series']());
			return parts.join(' ');
		}
	};
}

export interface OrgMembershipRequestsInput {
	orgVisibility: string | null | undefined;
	accept_membership_requests: boolean | null | undefined;
}

/** A4: the organization accepts membership requests but visitors cannot reach the page. */
export function orgRequestsWhileRestricted(input: OrgMembershipRequestsInput): AdminWarning | null {
	if (!input.accept_membership_requests || !isOrgRestricted(input.orgVisibility)) return null;
	return {
		id: 'A4',
		level: 'warn',
		title: () => m['adminWarnings.orgA4Title'](),
		message: () => m['adminWarnings.orgA4Message']()
	};
}

export interface OrgCustomDomainInput {
	orgVisibility: string | null | undefined;
	custom_domain: string | null | undefined;
}

/** A5: an active custom domain points at a restricted organization. */
export function orgCustomDomainWhileRestricted(input: OrgCustomDomainInput): AdminWarning | null {
	if (!input.custom_domain || !isOrgRestricted(input.orgVisibility)) return null;
	return {
		id: 'A5',
		level: 'info',
		title: () => m['adminWarnings.orgA5Title'](),
		message: () => m['adminWarnings.orgA5Message']()
	};
}
