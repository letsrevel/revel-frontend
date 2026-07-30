import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import {
	orgQuestionnairesKey,
	orgQuestionnairesQueryOptions,
	invalidateOrgQuestionnaires
} from './org-questionnaires';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	questionnaireListOrgQuestionnaires: vi.fn()
}));

import { questionnaireListOrgQuestionnaires } from '$lib/api/generated/sdk.gen';

const listMock = vi.mocked(questionnaireListOrgQuestionnaires);

/** Minimal stand-in for the paginated list endpoint; only ids are asserted on. */
function page(ids: string[]) {
	return { data: { count: ids.length, results: ids.map((id) => ({ id })) }, error: undefined };
}

/**
 * Same `staleTime` the app sets globally (`src/routes/+layout.svelte`). Without
 * it every read refetches and these tests would pass with the invalidation
 * deleted — the 60s freshness window *is* the bug (#722).
 */
function productionLikeClient(): QueryClient {
	return new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 1000, retry: false } } });
}

describe('orgQuestionnairesKey', () => {
	it('is the key the members admin tier picker reads', () => {
		// Pinned deliberately: the picker's cache entry is what #722 was leaving
		// stale, and any silent change of shape here would just move the bug.
		expect(orgQuestionnairesKey('acme')).toEqual([
			'organization',
			'acme',
			'membership-questionnaires'
		]);
	});

	it('scopes the cache per organization', () => {
		expect(orgQuestionnairesKey('acme')).not.toEqual(orgQuestionnairesKey('globex'));
	});
});

describe('orgQuestionnairesQueryOptions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('reads the very key the invalidator writes off', () => {
		const options = orgQuestionnairesQueryOptions({
			organizationId: 'org-1',
			organizationSlug: 'acme',
			accessToken: 'tok'
		});
		expect(options.queryKey).toEqual(orgQuestionnairesKey('acme'));
	});

	it('fetches the org list with the bearer token', async () => {
		listMock.mockResolvedValue(page(['vibe-check']) as never);

		const client = productionLikeClient();
		const data = await client.fetchQuery(
			orgQuestionnairesQueryOptions({
				organizationId: 'org-1',
				organizationSlug: 'acme',
				accessToken: 'tok'
			})
		);

		expect(listMock).toHaveBeenCalledWith({
			query: { organization_id: 'org-1', page_size: 100 },
			headers: { Authorization: 'Bearer tok' }
		});
		expect(data).toEqual(page(['vibe-check']).data);
	});

	it('is disabled without a token, and when the caller has no permission', () => {
		expect(
			orgQuestionnairesQueryOptions({
				organizationId: 'org-1',
				organizationSlug: 'acme',
				accessToken: null
			}).enabled
		).toBe(false);

		expect(
			orgQuestionnairesQueryOptions({
				organizationId: 'org-1',
				organizationSlug: 'acme',
				accessToken: 'tok',
				enabled: false
			}).enabled
		).toBe(false);
	});
});

describe('invalidateOrgQuestionnaires', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('marks the cached list stale even though nothing is observing it', async () => {
		// The shape of the bug: the questionnaire admin mutates and navigates away
		// while the members admin is unmounted. Nothing refetches at that moment —
		// what has to survive is the *invalidated* flag, so the next mount refetches
		// instead of serving the 60s-fresh pre-mutation list.
		listMock.mockResolvedValue(page(['vibe-check']) as never);

		const client = productionLikeClient();
		const options = orgQuestionnairesQueryOptions({
			organizationId: 'org-1',
			organizationSlug: 'acme',
			accessToken: 'tok'
		});
		await client.fetchQuery(options);
		expect(client.getQueryState(orgQuestionnairesKey('acme'))?.isInvalidated).toBe(false);

		await invalidateOrgQuestionnaires(client, 'acme');

		expect(client.getQueryState(orgQuestionnairesKey('acme'))?.isInvalidated).toBe(true);
	});

	it('control: without it, a fresh cache keeps serving the pre-mutation list', async () => {
		listMock.mockResolvedValue(page(['vibe-check']) as never);

		const client = productionLikeClient();
		const options = orgQuestionnairesQueryOptions({
			organizationId: 'org-1',
			organizationSlug: 'acme',
			accessToken: 'tok'
		});
		await client.fetchQuery(options);

		// A membership questionnaire is created elsewhere and nobody invalidates —
		// this is precisely what the members admin was showing before #722.
		listMock.mockResolvedValue(page(['vibe-check', 'membership-vetting']) as never);
		const stale = await client.fetchQuery(options);

		expect(stale?.results.map((q) => q.id)).toEqual(['vibe-check']);
		expect(listMock).toHaveBeenCalledTimes(1);
	});

	it('refetches on the next read, so a newly created questionnaire appears', async () => {
		listMock.mockResolvedValue(page(['vibe-check']) as never);

		const client = productionLikeClient();
		const options = orgQuestionnairesQueryOptions({
			organizationId: 'org-1',
			organizationSlug: 'acme',
			accessToken: 'tok'
		});
		await client.fetchQuery(options);

		// …a membership questionnaire is created elsewhere…
		listMock.mockResolvedValue(page(['vibe-check', 'membership-vetting']) as never);
		await invalidateOrgQuestionnaires(client, 'acme');

		const refreshed = await client.fetchQuery(options);
		expect(refreshed?.results.map((q) => q.id)).toEqual(['vibe-check', 'membership-vetting']);
		expect(listMock).toHaveBeenCalledTimes(2);
	});

	it('leaves other organizations alone', async () => {
		listMock.mockResolvedValue(page(['vibe-check']) as never);

		const client = productionLikeClient();
		await client.fetchQuery(
			orgQuestionnairesQueryOptions({
				organizationId: 'org-2',
				organizationSlug: 'globex',
				accessToken: 'tok'
			})
		);

		await invalidateOrgQuestionnaires(client, 'acme');

		expect(client.getQueryState(orgQuestionnairesKey('globex'))?.isInvalidated).toBe(false);
	});
});
