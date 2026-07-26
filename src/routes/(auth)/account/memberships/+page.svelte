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

	// One rejoin offer per org: newest expired ONLINE sub inside its revival
	// window, and only when the memberships list shows no live membership for
	// that org (a member who re-subscribed already has a fresh row).
	const rejoinSubs = $derived.by(() => {
		const subs = subscriptionsQuery.data ?? [];
		const liveOrgIds = new Set(
			memberships.filter((mb) => mb.status === 'active').map((mb) => mb.organization_id)
		);
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: a per-pass dedupe set, built and consumed synchronously inside this $derived.by and discarded when it returns
		const seen = new Set<string>();
		return subs.filter((s) => {
			if (s.plan.payment_method !== 'online') return false;
			if (!isWithinRevivalWindow(s)) return false;
			if (liveOrgIds.has(s.organization_id)) return false;
			if (seen.has(s.organization_id)) return false; // list is -created_at: first hit is newest
			seen.add(s.organization_id);
			return true;
		});
	});

	// Both queries feed the same section: settling one while the other is still
	// in flight would flash the empty state at a member who has rejoin offers.
	const isLoading = $derived.by(() => {
		const membershipsPending = membershipsQuery.isLoading;
		const subscriptionsPending = subscriptionsQuery.isLoading;
		return membershipsPending || subscriptionsPending;
	});
</script>

<svelte:head>
	<title>{m['account.memberships.title']()}</title>
</svelte:head>

<div class="container mx-auto max-w-3xl space-y-4 px-4 py-6">
	<h1 class="text-2xl font-bold">{m['account.memberships.title']()}</h1>

	{#if isLoading}
		<Loader2 class="h-5 w-5 animate-spin" />
	{:else if memberships.length === 0 && rejoinSubs.length === 0}
		<div class="rounded-lg border p-6 text-center">
			<h2 class="font-medium">{m['account.memberships.empty.title']()}</h2>
			<p class="mt-1 text-sm text-muted-foreground">{m['account.memberships.empty.body']()}</p>
			<Button href="/organizations" variant="outline" class="mt-4">
				{m['account.memberships.empty.cta']()}
			</Button>
		</div>
	{:else}
		<div class="space-y-3">
			{#each memberships as mb (mb.organization_id)}
				<MembershipCard membership={mb} />
			{/each}
			<!-- Keyed on the org rather than `id` (optional on the schema): the
			     selection above already guarantees one row per organization. -->
			{#each rejoinSubs as rs (rs.organization_id)}
				<RejoinCard sub={rs} />
			{/each}
		</div>
	{/if}
</div>
