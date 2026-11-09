import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';

/**
 * Which fields of a register entry staff may change, mirroring
 * `member_register_admin_service.update_record` / `end_record`.
 *
 * - Unlinked entries (`has_account=false`) are a hand-kept legal log: every
 *   field is editable, including closing the entry.
 * - A LINKED, STANDARD, OPEN entry is mirrored from the member's access row:
 *   only name, email and `valid_from` (not in the future) may change. A tier or
 *   `valid_until` change returns 409 (the tier moves through member
 *   management, the end through the End action).
 * - A linked entry that is already closed can be corrected but never reopened.
 * - A day membership (`temporary`) belongs to a temporary tier, which the
 *   register's standard-tier picker cannot offer, so its tier is read-only.
 */
export interface RecordEditability {
	/** Linked to an account, standard kind, no end date. */
	linkedOpen: boolean;
	tierLocked: boolean;
	tierLockReason: 'linked' | 'day-member' | null;
	validUntilLocked: boolean;
	/** Linked + closed: the end date can move but cannot be cleared. */
	reopenBlocked: boolean;
	/** `valid_from` must not be in the future (linked open entries). */
	validFromNotFuture: boolean;
	/** The End action applies: open and not merged. */
	canEnd: boolean;
	/** Ending cancels the person's membership and subscriptions. */
	endCancelsMembership: boolean;
}

type EditabilityInput = Pick<
	MembershipRecordSchema,
	'has_account' | 'kind' | 'valid_until' | 'merged_into_id'
>;

export function getEditability(record: EditabilityInput): RecordEditability {
	const open = !record.valid_until;
	const linkedOpen = record.has_account && record.kind === 'standard' && open;
	const dayMember = record.kind === 'temporary';
	return {
		linkedOpen,
		tierLocked: linkedOpen || dayMember,
		tierLockReason: linkedOpen ? 'linked' : dayMember ? 'day-member' : null,
		validUntilLocked: linkedOpen,
		reopenBlocked: record.has_account && !open,
		validFromNotFuture: linkedOpen,
		canEnd: open && !record.merged_into_id,
		endCancelsMembership: linkedOpen
	};
}
