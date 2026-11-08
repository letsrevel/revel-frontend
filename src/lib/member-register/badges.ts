import * as m from '$lib/paraglide/messages.js';
import type {
	MembershipRecordEndedReason,
	MembershipRecordKind,
	MembershipRecordSchema,
	MembershipRecordSource
} from '$lib/api/generated/types.gen';
import type { Tone } from '$lib/components/common/tones';
import { formatDate } from '$lib/utils/date';

export type RegisterBadgeId =
	| 'no-account'
	| 'day-member'
	| 'approximate-dates'
	| 'merged'
	| 'invite-not-invited'
	| 'invite-invited'
	| 'linked'
	| 'linked-auto'
	| 'duplicate-claim'
	| 'ended'
	| 'reason-not-recorded';

export interface RegisterBadge {
	id: RegisterBadgeId;
	tone: Tone;
	/** Already-translated visible label. */
	label: string;
}

/** Label for an end reason. Static message calls keep the build tree-shakeable. */
export function endedReasonLabel(reason: MembershipRecordEndedReason): string {
	switch (reason) {
		case 'cancelled':
			return m['memberRegister.endedCancelled']();
		case 'expelled':
			return m['memberRegister.endedExpelled']();
		case 'removed':
			return m['memberRegister.endedRemoved']();
		case 'revoked':
			return m['memberRegister.endedRevoked']();
		case 'tier_changed':
			return m['memberRegister.endedTierChanged']();
	}
}

export function sourceLabel(source: MembershipRecordSource): string {
	switch (source) {
		case 'application':
			return m['memberRegister.sourceApplication']();
		case 'staff':
			return m['memberRegister.sourceStaff']();
		case 'token':
			return m['memberRegister.sourceToken']();
		case 'subscription':
			return m['memberRegister.sourceSubscription']();
		case 'ticket':
			return m['memberRegister.sourceTicket']();
		case 'manual':
			return m['memberRegister.sourceManual']();
		case 'import':
			return m['memberRegister.sourceImport']();
		case 'backfill':
			return m['memberRegister.sourceBackfill']();
	}
}

export function kindLabel(kind: MembershipRecordKind): string {
	return kind === 'temporary'
		? m['memberRegister.kindTemporary']()
		: m['memberRegister.kindStandard']();
}

/**
 * Status badges for one register entry, in display order. Pure mapping from the
 * record to tone + label; the component renders them with `StatusBadge`.
 */
export function getRecordBadges(record: MembershipRecordSchema): RegisterBadge[] {
	const badges: RegisterBadge[] = [];
	const merged = !!record.merged_into_id;
	const closed = !!record.valid_until;

	if (!record.has_account) {
		badges.push({ id: 'no-account', tone: 'neutral', label: m['memberRegister.badgeNoAccount']() });
	}
	if (record.kind === 'temporary') {
		badges.push({ id: 'day-member', tone: 'info', label: m['memberRegister.badgeDayMember']() });
	}
	if (record.source === 'backfill') {
		badges.push({
			id: 'approximate-dates',
			tone: 'warning',
			label: m['memberRegister.badgeApproximate']()
		});
	}
	if (merged) {
		badges.push({ id: 'merged', tone: 'neutral', label: m['memberRegister.badgeMerged']() });
	}

	// Invitations only concern standard, non-merged entries.
	if (record.kind === 'standard' && !merged) {
		if (record.invite_status === 'linked') {
			badges.push({ id: 'linked', tone: 'success', label: m['memberRegister.badgeLinked']() });
		} else if (record.invite_status === 'invited') {
			badges.push({
				id: 'invite-invited',
				tone: 'info',
				label: record.invited_at
					? m['memberRegister.badgeInvitedOn']({ date: formatDate(record.invited_at) })
					: m['memberRegister.badgeInvited']()
			});
		} else {
			badges.push({
				id: 'invite-not-invited',
				tone: 'neutral',
				label: m['memberRegister.badgeNotInvited']()
			});
		}
	}
	if (record.linked_via === 'auto_email') {
		badges.push({
			id: 'linked-auto',
			tone: 'success',
			label: m['memberRegister.badgeLinkedAuto']()
		});
	}
	if (record.has_duplicate_claim) {
		badges.push({
			id: 'duplicate-claim',
			tone: 'warning',
			label: m['memberRegister.badgeDuplicateClaim']()
		});
	}

	if (closed) {
		if (record.ended_reason) {
			badges.push({ id: 'ended', tone: 'neutral', label: endedReasonLabel(record.ended_reason) });
		} else {
			badges.push({
				id: 'reason-not-recorded',
				tone: 'neutral',
				label: m['memberRegister.badgeReasonNotRecorded']()
			});
		}
	}
	return badges;
}
