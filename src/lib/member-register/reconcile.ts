import * as m from '$lib/paraglide/messages.js';
import type {
	MembershipRecordSchema,
	PossibleDuplicateSchema,
	RegisterMatchReason
} from '$lib/api/generated/types.gen';
import { isOpenStandard } from './open-standard';

/**
 * What unlinking a register entry does, mirroring
 * `member_register_reconciliation.unlink_record`:
 *
 * - `reverse_merge`: the entry was merged into another; the merge is undone
 *   (and the survivor's start restored unless staff edited it since).
 * - `cancels_access`: an OPEN STANDARD linked entry. The account is detached
 *   AND the ACTIVE/PAUSED access row is cancelled with its subscriptions.
 * - `clears_user`: any other linked entry (closed, or a day membership, open or
 *   not); only the account is detached.
 * - `null`: nothing to unlink (the backend answers 400).
 *
 * The backend checks `merged_into_id` first, so a merged entry is always a
 * reversed merge.
 */
export type UnlinkEffect = 'reverse_merge' | 'cancels_access' | 'clears_user';

type UnlinkInput = Pick<
	MembershipRecordSchema,
	'merged_into_id' | 'has_account' | 'kind' | 'valid_until'
>;

export function unlinkEffect(record: UnlinkInput): UnlinkEffect | null {
	if (record.merged_into_id) return 'reverse_merge';
	if (!record.has_account) return null;
	return isOpenStandard(record) ? 'cancels_access' : 'clears_user';
}

export function canUnlink(record: UnlinkInput): boolean {
	return unlinkEffect(record) !== null;
}

export type MergeOutcome = 'absorb' | 'attach';

export interface MergePlan {
	survivor: MembershipRecordSchema;
	absorbed: MembershipRecordSchema;
	/**
	 * `absorb`: an open standard entry is folded into the survivor (earliest start
	 * kept, absorbed marked merged). `attach`: a closed or day-membership entry is
	 * attached to the survivor's account unchanged.
	 */
	outcome: MergeOutcome;
	/** ISO instant the survivor will start from (earliest of both); `absorb` only. */
	earliestStart: string | null;
	/**
	 * Always false. The backend only lets an entry WITHOUT an account be absorbed
	 * (`merge_records`: "Only an entry without an account can be merged into
	 * another entry"), and a possible-duplicate pair's linked side always has one,
	 * so the survivor cannot be swapped.
	 */
	canSwap: false;
}

/** The survivor is the linked entry; the account-less one is absorbed. */
export function planMerge(pair: PossibleDuplicateSchema): MergePlan {
	const { linked: survivor, unlinked: absorbed } = pair;
	const openStandard = isOpenStandard(absorbed);
	const earliest =
		Date.parse(absorbed.valid_from) < Date.parse(survivor.valid_from)
			? absorbed.valid_from
			: survivor.valid_from;
	return {
		survivor,
		absorbed,
		outcome: openStandard ? 'absorb' : 'attach',
		earliestStart: openStandard ? earliest : null,
		canSwap: false
	};
}

export function reasonLabel(reason: RegisterMatchReason): string {
	switch (reason) {
		case 'email':
			return m['memberRegister.reasonEmail']();
		case 'name':
			return m['memberRegister.reasonName']();
		case 'claim':
			return m['memberRegister.reasonClaim']();
	}
}
