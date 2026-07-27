<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		mesubscriptionsListMyMemberships,
		mesubscriptionsListMySubscriptions
	} from '$lib/api/generated/sdk.gen';
	import type { MyMembershipSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import MembershipCard from '$lib/components/account/MembershipCard.svelte';
	import RejoinCard from '$lib/components/account/RejoinCard.svelte';
	import ApplicationsSection from '$lib/components/account/applications/ApplicationsSection.svelte';
	import { isWithinRevivalWindow } from '$lib/utils/subscriptions';
	import { Button } from '$lib/components/ui/button';
	import { Loader2 } from '@lucide/svelte';

	const accessToken = $derived(authStore.accessToken);

	const membershipsQuery = createQuery(() => ({
		queryKey: ['me', 'memberships'],
		queryFn: async () => {
			const res = await mesubscriptionsListMyMemberships({
				query: { page_size: 50 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load memberships');
			return (res.data?.results ?? []) as MyMembershipSchema[];
		},
		enabled: !!accessToken
	}));

	const memberships = $derived(membershipsQuery.data ?? []);

	// The memberships list only carries live rows; expired subscriptions — the
	// ones a member can still revive — are only visible here.
	const subscriptionsQuery = createQuery(() => ({
		queryKey: ['me', 'subscriptions'],
		queryFn: async () => {
			const res = await mesubscriptionsListMySubscriptions({
				query: { page_size: 50 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load subscriptions');
			return res.data?.results ?? [];
		},
		enabled: !!accessToken
	}));

	/**
	 * One rejoin offer per org: the newest expired ONLINE subscription still
	 * inside its revival window, for an org the member has genuinely left.
	 *
	 * DO NOT "simplify" the membership clause to `mb.status === 'active'`.
	 * Expiry does not delete the member row: the backend's subscription signals
	 * (`signals.py`) map an EXPIRED subscription onto member status CANCELLED,
	 * so `list_my_memberships` keeps returning the org as a *bare cancelled*
	 * row — `status === 'cancelled'` with no inlined subscription (only
	 * non-terminal subs are inlined). That bare row is precisely the state a
	 * rejoin offer replaces.
	 *
	 * Every other shape excludes the org, because the member has moved on and
	 * the backend would refuse the revival:
	 *   - `active`/`paused` — already re-subscribed (paused is still a live
	 *     membership, so an `active`-only test would leak a stale offer);
	 *   - `banned` — the CTA would only ever 400;
	 *   - any row carrying an inlined subscription — a non-terminal sub exists.
	 */
	const rejoinSubs = $derived.by(() => {
		const subs = subscriptionsQuery.data ?? [];
		const blockedOrgIds = new Set(
			memberships
				.filter((mb) => !(mb.status === 'cancelled' && !mb.subscription))
				.map((mb) => mb.organization_id)
		);
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: a per-pass dedupe set, built and consumed synchronously inside this $derived.by and discarded when it returns
		const seen = new Set<string>();
		return subs.filter((s) => {
			if (s.plan.payment_method !== 'online') return false;
			if (!isWithinRevivalWindow(s)) return false;
			if (blockedOrgIds.has(s.organization_id)) return false;
			if (seen.has(s.organization_id)) return false; // list is -created_at: first hit is newest
			seen.add(s.organization_id);
			return true;
		});
	});

	// A rejoin offer supersedes the org's own card: by the predicate above the
	// only rows that can match here are the bare cancelled ones, and the
	// RejoinCard says strictly more than they do (deadline, price, the CTA).
	// Without this the same org renders twice — a dead card up top and its
	// rejoin offer far below.
	const rejoinOrgIds = $derived(new Set(rejoinSubs.map((s) => s.organization_id)));
	const displayedMemberships = $derived(
		memberships.filter((mb) => !rejoinOrgIds.has(mb.organization_id))
	);

	// Both queries feed the same section: settling one while the other is still
	// in flight would flash the empty state at a member who has rejoin offers.
	// `isPending`, not `isLoading` — a query disabled while auth bootstraps
	// reports `isLoading === false`, which would flash the empty state at every
	// member on first paint.
	//
	// A guest who reaches this route therefore sits on the spinner forever: with
	// no token the queries never enable, so they never leave `pending`. That is
	// deliberate here. `!!accessToken` cannot tell a guest from a member whose
	// token is still bootstrapping (the root layout arms `markBootstrapPending()`
	// precisely because `accessToken` is null for both), so gating on it would
	// bring back the empty-state flash this line exists to fix. The real fix is a
	// route guard on `(auth)` — which every page in the group needs, including
	// `ApplicationsSection` and `account/privacy`, both of which gate identically.
	// Out of scope here; tracked in the task report.
	const isSectionPending = $derived.by(() => {
		const membershipsPending = membershipsQuery.isPending;
		const subscriptionsPending = subscriptionsQuery.isPending;
		return membershipsPending || subscriptionsPending;
	});
</script>

<svelte:head>
	<title>{m['account.memberships.title']()}</title>
</svelte:head>

<div class="container mx-auto max-w-3xl space-y-6 px-4 py-6">
	<h1 class="text-2xl font-bold">{m['account.memberships.title']()}</h1>

	<section aria-labelledby="memberships-heading" class="space-y-3">
		<h2 id="memberships-heading" class="text-lg font-semibold">
			{m['account.memberships.sectionMemberships']()}
		</h2>

		{#if isSectionPending}
			<div role="status" aria-label={m['common.loading']()}>
				<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
			</div>
		{:else if displayedMemberships.length === 0 && rejoinSubs.length === 0}
			<div class="rounded-lg border p-6 text-center">
				<!-- h3, not h2: this sits *inside* the memberships section, so an h2
				     here would read as a third top-level section. -->
				<h3 class="font-medium">{m['account.memberships.empty.title']()}</h3>
				<p class="mt-1 text-sm text-muted-foreground">{m['account.memberships.empty.body']()}</p>
				<Button href="/organizations" variant="outline" class="mt-4">
					{m['account.memberships.empty.cta']()}
				</Button>
			</div>
		{:else}
			<div class="space-y-3">
				{#each displayedMemberships as mb (mb.organization_id)}
					<MembershipCard membership={mb} />
				{/each}
				<!-- Keyed on the org rather than `id` (optional on the schema): the
				     selection above already guarantees one row per organization. -->
				{#each rejoinSubs as rs (rs.organization_id)}
					<RejoinCard sub={rs} />
				{/each}
			</div>
		{/if}
	</section>

	<!--
		Mounted unconditionally — never behind the memberships gate, a tab or an
		accordion. Each application row fires a state-advancing GET on read
		(`staleTime: 0`), so every remount re-runs the backend's approved →
		completed transition; and the notification deep-links that land here expect
		the section to exist on first paint, whatever the memberships queries are
		doing. It renders its own <h2>.
	-->
	<ApplicationsSection />
</div>
