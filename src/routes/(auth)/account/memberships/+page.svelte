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
	import { MY_MEMBERSHIPS_KEY, MY_SUBSCRIPTIONS_KEY } from '$lib/utils/subscription-cache';
	import { Button } from '$lib/components/ui/button';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { Loader2, Users } from '@lucide/svelte';

	const accessToken = $derived(authStore.accessToken);

	const membershipsQuery = createQuery(() => ({
		// The exported constant, not a literal: `settleSubscriptionCaches` seeds
		// this exact key after every member-facing mutation, and a rename that only
		// landed on one side would silently no-op the seeding (#693) instead of
		// failing loudly.
		queryKey: MY_MEMBERSHIPS_KEY,
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
		queryKey: MY_SUBSCRIPTIONS_KEY,
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
	// This gate never resolves without a token, because the queries never enable.
	// That used to strand a logged-out visitor on the spinner forever; the fix is
	// the `(auth)` route guard in `hooks.server.ts` (`handleAuthGuard`), which
	// redirects them to `/login?returnUrl=…` before this component ever mounts.
	// So the only case reaching this line with no token is a member whose refresh
	// is still bootstrapping — for whom a spinner is the correct answer.
	//
	// Do NOT "fix" this by gating on `!!accessToken` instead: it cannot tell a
	// guest from a member mid-bootstrap (the root layout arms
	// `markBootstrapPending()` precisely because `accessToken` is null for both),
	// so it would bring back the empty-state flash this line exists to prevent.
	const isSectionPending = $derived.by(() => {
		const membershipsPending = membershipsQuery.isPending;
		const subscriptionsPending = subscriptionsQuery.isPending;
		return membershipsPending || subscriptionsPending;
	});

	// PER-QUERY error gating (#697). The two queries fill the same section but
	// answer different questions — memberships carry the live cards,
	// subscriptions carry the rejoin offers — so a failure in one says nothing
	// about the other. Gating on BOTH being empty (the old shape) meant a partial
	// failure rendered the surviving half's rows with no error line at all: the
	// member read an incomplete list as if it were complete.
	//
	// Each half is therefore judged alone, and each carries its own copy — "could
	// not load your memberships" printed under two freshly rendered membership
	// cards, because the *subscriptions* call broke, would be a plain lie.
	//
	// TanStack keeps the last successful payload across a failed refetch, so each
	// gate still requires that its query have NOTHING left to show: a blipped
	// background poll must not wipe cards the member is reading (same contract as
	// ApplicationsSection). The emptiness test is the query's own payload, not the
	// rendered rows — `displayedMemberships` also empties when every membership is
	// superseded by a rejoin offer, and those orgs are still on screen.
	//
	// `$derived.by` with both operands read into locals first: `&&`/`||` directly
	// on tracked props short-circuits and would leave the second query untracked.
	const membershipsFailed = $derived.by(() => {
		const failed = membershipsQuery.isError;
		const empty = memberships.length === 0;
		return failed && empty;
	});

	const rejoinFailed = $derived.by(() => {
		const failed = subscriptionsQuery.isError;
		const empty = (subscriptionsQuery.data ?? []).length === 0;
		return failed && empty;
	});

	const hasNoRows = $derived(displayedMemberships.length === 0 && rejoinSubs.length === 0);

	// The empty state may only speak when BOTH halves are intact — it is the one
	// claim ("you have none") that a silent failure would turn into a falsehood.
	const showEmptyState = $derived.by(() => {
		const noRows = hasNoRows;
		const mFailed = membershipsFailed;
		const rFailed = rejoinFailed;
		return noRows && !mFailed && !rFailed;
	});
</script>

<svelte:head>
	<title>{m['account.memberships.title']()}</title>
</svelte:head>

<div class="container mx-auto max-w-3xl space-y-6 px-4 py-6">
	<PageHeader kicker={m['myInvoices.account']()} title={m['account.memberships.title']()} />

	<section aria-labelledby="memberships-heading" class="space-y-3">
		<SectionHeader id="memberships-heading" title={m['account.memberships.sectionMemberships']()} />

		{#if isSectionPending}
			<div role="status">
				<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
				<span class="sr-only">{m['common.loading']()}</span>
			</div>
		{:else}
			<!-- Not `{:else if}` chained with the rows below: a partial failure has to
			     render an error line AND the surviving half's cards at the same time. -->
			<!-- `role="alert"` on each: both lines replace the spinner after first
			     paint, and a partial failure can even arrive while the surviving
			     half's cards are already rendered and read. Two separate alerts
			     rather than one wrapper, so a partial failure announces only the
			     half that actually broke. -->
			{#if membershipsFailed}
				<p role="alert" class="text-sm text-destructive">
					{m['account.memberships.loadError']()}
				</p>
			{/if}
			{#if rejoinFailed}
				<p role="alert" class="text-sm text-destructive">
					{m['account.memberships.loadErrorRejoin']()}
				</p>
			{/if}

			{#if showEmptyState}
				<!-- level=3: this sits *inside* the memberships section, so a level-2
				     heading here would read as a third top-level section. -->
				<EmptyState
					icon={Users}
					level={3}
					title={m['account.memberships.empty.title']()}
					body={m['account.memberships.empty.body']()}
				>
					{#snippet action()}
						<Button href="/organizations" variant="outline">
							{m['account.memberships.empty.cta']()}
						</Button>
					{/snippet}
				</EmptyState>
			{:else if !hasNoRows}
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
