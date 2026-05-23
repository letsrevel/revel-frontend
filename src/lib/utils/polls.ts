import type { PollStatus, ResourceVisibility } from '$lib/api/generated/types.gen';

export function buildPollVoterUrl(origin: string, slug: string, pollId: string): string {
	const cleanOrigin = origin.replace(/\/+$/, '');
	return `${cleanOrigin}/org/${encodeURIComponent(slug)}/polls/${encodeURIComponent(pollId)}`;
}

export function isPollDraft(status: PollStatus): boolean {
	return status === 'draft';
}

export function isPollOpen(status: PollStatus): boolean {
	return status === 'open';
}

export function isPollClosed(status: PollStatus): boolean {
	return status === 'closed';
}

export type VoteCountKey = 'votes_zero' | 'votes_one' | 'votes_other';

export function formatVoteCount(n: number): { key: VoteCountKey; count: number } {
	if (n === 0) return { key: 'votes_zero', count: 0 };
	if (n === 1) return { key: 'votes_one', count: 1 };
	return { key: 'votes_other', count: n };
}

export function resultVisibilityRequiresPublicAnonymous(viz: ResourceVisibility): boolean {
	return viz === 'public' || viz === 'unlisted';
}

const PUBLIC_VOTE_VIZ: ResourceVisibility[] = ['public', 'unlisted'];

export function voteVisibilityAllowsAnonymousVoter(viz: ResourceVisibility): boolean {
	return PUBLIC_VOTE_VIZ.includes(viz);
}

export function validateClosesAt(value: string | null): string | null {
	if (!value) return null;
	const ts = Date.parse(value);
	if (Number.isNaN(ts)) return null;
	if (ts <= Date.now()) return 'pollNewPage.closesAtPast';
	return null;
}
