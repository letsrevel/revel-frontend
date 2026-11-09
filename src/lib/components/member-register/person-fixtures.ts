import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';

/** A linked, current standard entry; override fields per test. */
export function makeRecord(
	overrides: Partial<MembershipRecordSchema> = {}
): MembershipRecordSchema {
	return {
		id: 'r1',
		user_id: 'u1',
		tier_id: 't1',
		tier_name: 'Gold',
		event_id: null,
		ticket_id: null,
		kind: 'standard',
		source: 'manual',
		ended_reason: null,
		valid_from: '2026-01-01T00:00:00Z',
		valid_until: null,
		accepted_at: null,
		created_at: '2026-01-01T00:00:00Z',
		has_account: true,
		invited_at: null,
		invite_status: 'linked',
		can_invite: false,
		invite_blocked_reason: null,
		has_duplicate_claim: false,
		merged_into_id: null,
		linked_via: 'invite',
		linked_at: '2026-02-01T10:00:00Z',
		has_note: false,
		is_current: true,
		member_status: 'active',
		subscription: null,
		full_name: 'Ada Rossi',
		email: 'ada@example.org',
		questionnaire_name: null,
		...overrides
	};
}

/** An entry with no account. */
export function makeUnlinked(
	overrides: Partial<MembershipRecordSchema> = {}
): MembershipRecordSchema {
	return makeRecord({
		id: 'r2',
		user_id: null,
		has_account: false,
		invite_status: 'not_invited',
		can_invite: true,
		linked_via: null,
		linked_at: null,
		member_status: null,
		full_name: 'Bruno Verdi',
		email: 'bruno@example.org',
		...overrides
	});
}
