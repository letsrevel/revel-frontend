import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';

/**
 * An open STANDARD register entry: no end date and the standard kind. Mirrors
 * the backend's `_is_open_standard`; every "does this behave like a live
 * membership" decision (unlink effect, merge outcome, editability) goes through
 * here so they cannot drift apart.
 */
export function isOpenStandard(
	record: Pick<MembershipRecordSchema, 'kind' | 'valid_until'>
): boolean {
	return !record.valid_until && record.kind === 'standard';
}
