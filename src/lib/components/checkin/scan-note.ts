import type { CheckInResponseSchema } from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';
import { getUserDisplayName } from '$lib/utils/user-display';
import { membershipCalloutFrom, type ScanMembershipCallout } from './scan-membership';

/**
 * What a successful check-in tells door staff in a blocking dialog: a private
 * staff note they have not read yet, with the membership standing alongside it.
 */
export interface ScanNote {
	name: string;
	/** The private staff note. */
	body: string;
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

/**
 * The blocking-dialog content of a check-in result: null unless there is a staff
 * note to show (and the pre-confirm preview did not already show it). A
 * membership alone is NOT dialog-worthy; see {@link checkInMembershipLine}.
 */
export function scanNoteFrom(
	result: CheckInResponseSchema,
	options: ScanNoteOptions = {}
): ScanNote | null {
	const note = result.private_note?.trim() || null;
	const alreadyShown = !!note && note === options.previewedNote?.trim();
	if (!note || alreadyShown) return null;
	return {
		name: getUserDisplayName(result.user, m['memberVerify.unknownMember']()),
		body: note,
		membership: membershipCalloutFrom(result.membership)
	};
}

/** The membership line for the non-blocking check-in toast ("Day member, valid until ..."), or null. */
export function checkInMembershipLine(result: CheckInResponseSchema): string | null {
	return membershipCalloutFrom(result.membership)?.body ?? null;
}
