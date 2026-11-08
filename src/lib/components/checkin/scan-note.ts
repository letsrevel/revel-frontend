import type { CheckInResponseSchema } from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';
import { getUserDisplayName } from '$lib/utils/user-display';
import { membershipCalloutFrom, type ScanMembershipCallout } from './scan-membership';

/**
 * What a successful check-in tells door staff beyond the toast: the private
 * staff note and/or the membership standing. Either may be absent, never both.
 */
export interface ScanNote {
	name: string;
	/** The private staff note, or null when there is none (or the preview already showed it). */
	body: string | null;
	membership: ScanMembershipCallout | null;
}

interface ScanNoteOptions {
	/**
	 * The note the pre-confirm dialog already displayed. When the check-in returns
	 * the same text it is not shown a second time; the membership block still is,
	 * because the preview cannot carry it.
	 */
	previewedNote?: string | null;
}

/** Extract the note and membership from a check-in result; null when there is neither. */
export function scanNoteFrom(
	result: CheckInResponseSchema,
	options: ScanNoteOptions = {}
): ScanNote | null {
	const note = result.private_note?.trim() || null;
	const alreadyShown = !!note && note === options.previewedNote?.trim();
	const body = alreadyShown ? null : note;
	const membership = membershipCalloutFrom(result.membership);
	if (!body && !membership) return null;
	return {
		name: getUserDisplayName(result.user, m['memberVerify.unknownMember']()),
		body,
		membership
	};
}
