import type { CheckInResponseSchema } from '$lib/api/generated/types.gen';
import { getUserDisplayName } from '$lib/utils/user-display';

/** The private staff note on a person who was just checked in. */
export interface ScanNote {
	name: string;
	body: string;
}

/** Extract the staff note from a check-in result; null when there is none. */
export function scanNoteFrom(result: CheckInResponseSchema): ScanNote | null {
	const body = result.private_note?.trim();
	if (!body) return null;
	return { name: getUserDisplayName(result.user), body: result.private_note ?? body };
}
