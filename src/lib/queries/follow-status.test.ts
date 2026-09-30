import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationGetFollowStatus: vi.fn(),
	eventseriesGetFollowStatus: vi.fn()
}));

import { organizationGetFollowStatus } from '$lib/api/generated/sdk.gen';
import { followStatusQueryOptions } from './follow-status';

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('followStatusQueryOptions', () => {
	beforeEach(() => vi.clearAllMocks());

	it('treats a 404 (org not visible) as not following', async () => {
		vi.mocked(organizationGetFollowStatus).mockResolvedValue({
			error: { detail: 'Not found' },
			response: { status: 404 }
		} as never);
		await expect(
			client().fetchQuery(followStatusQueryOptions('organization', 'acme', 'tok'))
		).resolves.toEqual({ is_following: false, follow: null });
	});

	it('throws other failures instead of reporting "not following"', async () => {
		vi.mocked(organizationGetFollowStatus).mockResolvedValue({
			error: { detail: 'Server error' },
			response: { status: 500 }
		} as never);
		await expect(
			client().fetchQuery(followStatusQueryOptions('organization', 'acme', 'tok'))
		).rejects.toEqual({ detail: 'Server error' });
	});

	it('answers "not following" without a request when signed out', async () => {
		await expect(
			client().fetchQuery(followStatusQueryOptions('organization', 'acme', null))
		).resolves.toEqual({ is_following: false, follow: null });
		expect(organizationGetFollowStatus).not.toHaveBeenCalled();
	});
});
