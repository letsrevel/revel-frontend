import * as m from '$lib/paraglide/messages.js';

export interface AccessSummary {
	/** Who sees the event in listings/search ("Everyone", "Only invited users", ...). */
	whoCanSee: string;
	/** Full "who can view" sentence used by the Essentials explainer. */
	viewDescription: string;
	/** Who can RSVP / buy tickets, lowercase ("anyone", "only invited people", ...). */
	whoCanAttend: string;
	/** Public visibility + members-only type: nudge organizers about joining the org. */
	showJoinOrgHint: boolean;
}

/**
 * Plain-language summary of a visibility + event_type combination. Pure (reads
 * only the active-locale messages) so the Essentials explainer and the editor's
 * glance card share one source of wording.
 */
export function summarizeAccess(
	visibility?: string | null,
	eventType?: string | null
): AccessSummary {
	const vis = visibility || 'public';
	const type = eventType || 'public';

	const whoCanSee =
		vis === 'public'
			? m['essentialsStep.whoCanSee_everyone']()
			: vis === 'unlisted'
				? m['essentialsStep.whoCanSee_directLink']()
				: vis === 'members-only'
					? m['essentialsStep.whoCanSee_members']()
					: vis === 'staff-only'
						? m['essentialsStep.whoCanSee_staff']()
						: m['essentialsStep.whoCanSee_invited'](); // private

	const whoCanAttend =
		type === 'public'
			? m['essentialsStep.whoCanAttend_anyone']()
			: type === 'members-only'
				? m['essentialsStep.whoCanAttend_members']()
				: m['essentialsStep.whoCanAttend_invited'](); // private

	const viewDescription =
		vis === 'unlisted'
			? m['essentialsStep.viewDescription_unlisted']()
			: m['essentialsStep.viewDescription_default']({ who: whoCanSee });

	return {
		whoCanSee,
		viewDescription,
		whoCanAttend,
		showJoinOrgHint: vis === 'public' && type === 'members-only'
	};
}

/** Upper-case the first character (the attend phrases are stored lowercase). */
export function capitalizeFirst(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}
