import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';

type InviteInput = Pick<
	MembershipRecordSchema,
	| 'has_account'
	| 'invite_status'
	| 'merged_into_id'
	| 'email'
	| 'kind'
	| 'valid_from'
	| 'valid_until'
>;

/**
 * Whether the per-row Invite / Resend action is offered. Mirrors
 * `member_register_linking.send_invite` (refuses linked, merged, email-less,
 * revoked, and future-dated entries with a 400) and narrows it to the entries
 * invitations are meant for, like `send_bulk_invites`: open and STANDARD.
 * TODO: this client-side rule is a fallback; replace it with the backend's
 * `can_invite` flag once the register schema exposes one.
 *
 * The backend does not itself refuse temporary or ended entries, but a day
 * member or a closed entry has nothing to link, so the UI never offers it.
 */
export function canInvite(record: InviteInput, now: Date = new Date()): boolean {
	if (record.has_account || record.invite_status === 'linked') return false;
	if (record.merged_into_id) return false;
	if (!record.email) return false;
	if (record.kind !== 'standard') return false;
	if (record.valid_until) return false;
	return Date.parse(record.valid_from) <= now.getTime();
}
