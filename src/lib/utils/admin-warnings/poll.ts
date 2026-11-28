/**
 * Poll warning rules (#1314, G2). Pure functions: each returns an
 * `AdminWarning`, or `null` when the setting is fine. Callers add the fix target.
 */
import * as m from '$lib/paraglide/messages.js';
import { isOrgRestricted } from './org';
import type { AdminWarning } from './types';

const isEveryone = (v: string | null | undefined): boolean => v === 'public' || v === 'unlisted';

export interface PollResultsNeverInput {
	result_visibility: string | null | undefined;
	result_timing: string | null | undefined;
}

/** G2a: results are public, but the timing is "never", so only staff see them. */
export function pollPublicResultsNeverShown(input: PollResultsNeverInput): AdminWarning | null {
	if (!isEveryone(input.result_visibility) || input.result_timing !== 'never') return null;
	return {
		id: 'G2a',
		level: 'info',
		title: () => m['adminWarnings.pollG2aTitle'](),
		message: () => m['adminWarnings.pollG2aMessage']()
	};
}

export interface PollResultsVisibleInput {
	orgVisibility: string | null | undefined;
	result_visibility: string | null | undefined;
	/** Poll status; `draft` adds "after you open the poll". */
	status?: string | null | undefined;
}

/** G2b-visible: a restricted organization, but everyone can see the results. */
export function pollResultsVisibleToEveryone(input: PollResultsVisibleInput): AdminWarning | null {
	if (!isOrgRestricted(input.orgVisibility) || !isEveryone(input.result_visibility)) return null;
	const draft = input.status === 'draft';
	return {
		id: 'G2b-visible',
		level: 'info',
		title: () => m['adminWarnings.pollG2bVisibleTitle'](),
		message: () =>
			draft
				? m['adminWarnings.pollG2bVisibleDraftMessage']()
				: m['adminWarnings.pollG2bVisibleMessage']()
	};
}

export interface PollVoteVisibleInput {
	orgVisibility: string | null | undefined;
	vote_visibility: string | null | undefined;
	status?: string | null | undefined;
}

/** G2b-vote: a restricted organization, but everyone can see the poll and vote. */
export function pollVotableByEveryone(input: PollVoteVisibleInput): AdminWarning | null {
	if (!isOrgRestricted(input.orgVisibility) || !isEveryone(input.vote_visibility)) return null;
	const draft = input.status === 'draft';
	return {
		id: 'G2b-vote',
		level: 'info',
		title: () => m['adminWarnings.pollG2bVoteTitle'](),
		message: () =>
			draft ? m['adminWarnings.pollG2bVoteDraftMessage']() : m['adminWarnings.pollG2bVoteMessage']()
	};
}
