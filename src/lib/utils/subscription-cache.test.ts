import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/svelte-query';
import type { MyMembershipSchema, MySubscriptionSchema } from '$lib/api/generated/types.gen';
import {
	MY_MEMBERSHIPS_KEY,
	MY_SUBSCRIPTIONS_KEY,
	myOrgSubscriptionKey,
	seedSubscriptionCaches,
	settleSubscriptionCaches
} from './subscription-cache';

function makeSub(over: Partial<MySubscriptionSchema> = {}): MySubscriptionSchema {
	return {
		id: 'sub-1',
		plan_id: 'p1',
		organization_id: 'o1',
		organization_name: 'Org',
		organization_slug: 'org',
		status: 'active',
		current_period_end: '2026-08-01T00:00:00Z',
		cancel_at_period_end: false,
		created_at: '2026-07-01T00:00:00Z',
		updated_at: '2026-07-01T00:00:00Z',
		plan: {
			id: 'p1',
			tier_id: 't1',
			tier_name: 'Gold',
			name: 'Monthly',
			price: '10.00',
			currency: 'EUR',
			period_unit: 'month',
			period_count: 1,
			payment_method: 'online',
			sales_status: 'open'
		},
		...over
	};
}

function makeMembership(sub: MySubscriptionSchema | null): MyMembershipSchema {
	return {
		organization_id: 'o1',
		organization_name: 'Org',
		organization_slug: 'org',
		member_since: '2026-01-01T00:00:00Z',
		status: 'active',
		subscription: sub
	};
}

function newClient(): QueryClient {
	return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** The truthful post-cancel state the endpoint returns in its 200 body. */
const TRUTH = makeSub({ cancel_at_period_end: true, cancelled_at: '2026-07-27T10:00:00Z' });
/** What the backend serves once the schedule-release webhook has written back. */
const STALE = makeSub({ cancel_at_period_end: false });

describe('seedSubscriptionCaches', () => {
	it('patches the inlined subscription in the memberships list', () => {
		const client = newClient();
		client.setQueryData(MY_MEMBERSHIPS_KEY, [makeMembership(STALE)]);

		seedSubscriptionCaches(client, TRUTH);

		const rows = client.getQueryData<MyMembershipSchema[]>(MY_MEMBERSHIPS_KEY);
		expect(rows?.[0].subscription?.cancel_at_period_end).toBe(true);
		// The membership row itself is untouched — only its subscription is ours to speak for.
		expect(rows?.[0].status).toBe('active');
	});

	it('patches the id-matching row of the flat subscriptions list only', () => {
		const client = newClient();
		const otherOrgSub = makeSub({ id: 'sub-9', organization_id: 'o9' });
		const olderSameOrg = makeSub({ id: 'sub-0', status: 'expired' });
		client.setQueryData(MY_SUBSCRIPTIONS_KEY, [STALE, olderSameOrg, otherOrgSub]);

		seedSubscriptionCaches(client, TRUTH);

		const rows = client.getQueryData<MySubscriptionSchema[]>(MY_SUBSCRIPTIONS_KEY);
		expect(rows?.[0].cancel_at_period_end).toBe(true);
		// A previous subscription for the same org must never be rewritten.
		expect(rows?.[1]).toEqual(olderSameOrg);
		expect(rows?.[2]).toEqual(otherOrgSub);
	});

	it('patches the per-org single-subscription cache', () => {
		const client = newClient();
		client.setQueryData(myOrgSubscriptionKey('o1'), STALE);

		seedSubscriptionCaches(client, TRUTH);

		expect(client.getQueryData<MySubscriptionSchema>(myOrgSubscriptionKey('o1'))).toEqual(TRUTH);
	});

	it('never creates a cache entry that did not exist', () => {
		const client = newClient();

		seedSubscriptionCaches(client, TRUTH);

		expect(client.getQueryData(MY_MEMBERSHIPS_KEY)).toBeUndefined();
		expect(client.getQueryData(MY_SUBSCRIPTIONS_KEY)).toBeUndefined();
		expect(client.getQueryData(myOrgSubscriptionKey('o1'))).toBeUndefined();
	});

	it('never re-inlines a subscription the backend has already dropped', () => {
		const client = newClient();
		// An immediate cancel makes the row terminal, so the backend stops inlining
		// it and the per-org endpoint 404s (the query maps that onto null).
		client.setQueryData(MY_MEMBERSHIPS_KEY, [makeMembership(null)]);
		client.setQueryData(myOrgSubscriptionKey('o1'), null);

		seedSubscriptionCaches(client, makeSub({ status: 'cancelled' }));

		expect(
			client.getQueryData<MyMembershipSchema[]>(MY_MEMBERSHIPS_KEY)?.[0].subscription
		).toBeNull();
		expect(client.getQueryData(myOrgSubscriptionKey('o1'))).toBeNull();
	});

	it('leaves another org’s rows alone', () => {
		const client = newClient();
		const otherRow = makeMembership(makeSub({ id: 'sub-9', organization_id: 'o9' }));
		otherRow.organization_id = 'o9';
		client.setQueryData(MY_MEMBERSHIPS_KEY, [otherRow]);

		seedSubscriptionCaches(client, TRUTH);

		expect(
			client.getQueryData<MyMembershipSchema[]>(MY_MEMBERSHIPS_KEY)?.[0].subscription
				?.cancel_at_period_end
		).toBe(false);
	});
});

describe('settleSubscriptionCaches (#693 webhook write-back race)', () => {
	/**
	 * The regression itself: the cancel 200 carries the truth, but the refetch the
	 * invalidation triggers lands *after* Stripe's schedule-release webhook has
	 * written `cancel_at_period_end: false` back onto the row. Without the
	 * re-assert the stale refetch is the last writer and the card reads
	 * "Next renewal" instead of "Cancels on …".
	 */
	it('wins over a refetch that returns the stale post-webhook state', async () => {
		const client = newClient();
		const staleFetch = vi.fn().mockResolvedValue(STALE);

		// An *active* observer — invalidation only refetches observed queries, and
		// an unobserved cache would never reproduce the race.
		const observer = new QueryObserver(client, {
			queryKey: myOrgSubscriptionKey('o1'),
			queryFn: staleFetch,
			retry: false
		});
		const unsubscribe = observer.subscribe(() => {
			/* the query only has to be *observed*; nothing here reacts to it */
		});
		// Wait for the first fetch to *settle*, not merely to start: an invalidation
		// raised while a fetch is in flight is deduped into it and would never issue
		// the second request this test is about.
		await vi.waitFor(() => {
			const state = client.getQueryState(myOrgSubscriptionKey('o1'));
			expect(state?.status).toBe('success');
			expect(state?.fetchStatus).toBe('idle');
		});

		await settleSubscriptionCaches(client, TRUTH);

		// The refetch really happened (so this is the racing path, not a no-op)…
		expect(staleFetch).toHaveBeenCalledTimes(2);
		// …and the truthful response body is still what the UI reads.
		expect(client.getQueryData<MySubscriptionSchema>(myOrgSubscriptionKey('o1'))).toEqual(TRUTH);
		unsubscribe();
	});

	it('seeds the truth before the refetch resolves', async () => {
		const client = newClient();
		let release: (value: MySubscriptionSchema) => void = () => {
			/* replaced synchronously by the promise executor below */
		};
		const slowFetch = vi.fn(
			() =>
				new Promise<MySubscriptionSchema>((resolve) => {
					release = resolve;
				})
		);
		client.setQueryData(myOrgSubscriptionKey('o1'), STALE);
		const observer = new QueryObserver(client, {
			queryKey: myOrgSubscriptionKey('o1'),
			queryFn: slowFetch,
			retry: false,
			staleTime: Infinity
		});
		const unsubscribe = observer.subscribe(() => {
			/* the query only has to be *observed*; nothing here reacts to it */
		});

		const settled = settleSubscriptionCaches(client, TRUTH);
		// Synchronously visible: the member sees "Cancels on …" without waiting on
		// a network round trip.
		expect(
			client.getQueryData<MySubscriptionSchema>(myOrgSubscriptionKey('o1'))?.cancel_at_period_end
		).toBe(true);

		release(STALE);
		await settled;
		expect(client.getQueryData<MySubscriptionSchema>(myOrgSubscriptionKey('o1'))).toEqual(TRUTH);
		unsubscribe();
	});

	it('keeps the seed when the refetch fails outright', async () => {
		const client = newClient();
		client.setQueryData(myOrgSubscriptionKey('o1'), STALE);
		const observer = new QueryObserver(client, {
			queryKey: myOrgSubscriptionKey('o1'),
			queryFn: vi.fn().mockRejectedValue(new Error('offline')),
			retry: false
		});
		const unsubscribe = observer.subscribe(() => {
			/* the query only has to be *observed*; nothing here reacts to it */
		});

		await expect(settleSubscriptionCaches(client, TRUTH)).resolves.toBeUndefined();

		expect(client.getQueryData<MySubscriptionSchema>(myOrgSubscriptionKey('o1'))).toEqual(TRUTH);
		unsubscribe();
	});
});
