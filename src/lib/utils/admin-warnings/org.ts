/**
 * Organization warning rules (#1314, A1, A4, A5). Pure functions: each returns
 * an `AdminWarning`, or `null` when the setting is fine. Callers add the fix
 * target and the action.
 */
import * as m from '$lib/paraglide/messages.js';
import { compactWarnings, withFix, withLink, type AdminWarning } from './types';
import { membershipQuestionnaireNotPublished } from './questionnaire';

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

export interface OrgSettingsWarningsInput {
	/** Live form value. */
	visibility: string | null | undefined;
	/** Live form value. */
	acceptNewMembers: boolean | null | undefined;
	/** Live form value: id of the chosen default membership questionnaire ('' = none). */
	defaultQuestionnaireId: string;
	/** `null` = counts not loaded: no A1. */
	counts: Omit<OrgPublicEventsInput, 'orgVisibility'> | null;
	customDomain: string | null | undefined;
	membershipQuestionnaires: ReadonlyArray<{
		id: string;
		questionnaire_type: string | null | undefined;
		questionnaire: { status: string | null | undefined };
	}>;
	/** Link target for the F2 fix (the questionnaires page). */
	questionnairesHref: string;
}

export interface OrgSettingsWarnings {
	visibility: AdminWarning[];
	requests: AdminWarning[];
	questionnaire: AdminWarning[];
}

/**
 * Warnings of the organization settings page, from the live form state. Adds the
 * fix targets. The F2 dismissal follows the chosen questionnaire (id `F2-<id>`).
 */
export function orgSettingsWarnings(input: OrgSettingsWarningsInput): OrgSettingsWarnings {
	const a1 = input.counts
		? orgHiddenWithPublicEvents({ orgVisibility: input.visibility, ...input.counts })
		: null;
	const a5 = orgCustomDomainWhileRestricted({
		orgVisibility: input.visibility,
		custom_domain: input.customDomain
	});
	const a4 = orgRequestsWhileRestricted({
		orgVisibility: input.visibility,
		accept_membership_requests: input.acceptNewMembers
	});
	const q = input.membershipQuestionnaires.find((x) => x.id === input.defaultQuestionnaireId);
	const f2 = q
		? membershipQuestionnaireNotPublished({
				questionnaire_type: q.questionnaire_type,
				status: q.questionnaire.status,
				is_organization_default: true,
				tierCount: 0
			})
		: null;
	return {
		visibility: compactWarnings([
			a1 && withFix(a1, 'visibility', () => m['adminWarnings.fixVisibility']()),
			a5 && withFix(a5, 'visibility', () => m['adminWarnings.fixVisibility']())
		]),
		requests: compactWarnings([
			a4 &&
				withFix(a4, 'accept_membership_requests', () => m['adminWarnings.fixMembershipRequests']())
		]),
		questionnaire:
			q && f2
				? [
						withLink({ ...f2, id: `F2-${q.id}` }, input.questionnairesHref, () =>
							m['adminWarnings.fixOpenQuestionnaires']()
						)
					]
				: []
	};
}
