<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		organizationadminsubscriptionsListOrganizationSubscriptionPayments,
		organizationadminsubscriptionsListOrganizationPlans
	} from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationAdminDetailSchema,
		OrganizationMembershipPaymentSchema,
		PaymentStatus,
		PlanSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Loader2 } from '@lucide/svelte';
	import SubscriptionPaymentsRow from './SubscriptionPaymentsRow.svelte';
	import SubscriptionPaymentsCard from './SubscriptionPaymentsCard.svelte';

	interface Props {
		organization: OrganizationAdminDetailSchema;
	}

	const { organization }: Props = $props();
	const accessToken = $derived(authStore.accessToken);

	// The backend paginates this endpoint at 20; pass it explicitly so the
	// client-side page arithmetic can never drift from the server default.
	const PAGE_SIZE = 20;

	const SELECT_CLASS =
		'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:w-48';

	let search = $state('');
	let debounced = $state('');
	let statusFilter = $state<PaymentStatus | 'all'>('all');
	let planFilter = $state<string>('all');
	let pageNum = $state(1);

	let timer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		clearTimeout(timer);
		const q = search;
		timer = setTimeout(() => {
			debounced = q;
			pageNum = 1;
		}, 300);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		void statusFilter;
		void planFilter;
		pageNum = 1;
	});

	// Unfiltered on purpose: the ledger is historical, so it contains rows billed
	// on plans that have since been archived — an `is_active: true` list would
	// hide exactly the plans an admin is most likely reconciling.
	const plansQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'plans', 'all'],
		queryFn: async () => {
			const res = await organizationadminsubscriptionsListOrganizationPlans({
				path: { slug: organization.slug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load plans');
			return res.data as PlanSchema[];
		},
		enabled: !!accessToken
	}));

	const plans = $derived(plansQuery.data ?? []);

	const paymentsQuery = createQuery(() => ({
		queryKey: [
			'organization',
			organization.slug,
			'subscription-payments',
			{ search: debounced, page: pageNum, status: statusFilter, plan: planFilter }
		],
		queryFn: async () => {
			const res = await organizationadminsubscriptionsListOrganizationSubscriptionPayments({
				path: { slug: organization.slug },
				query: {
					page: pageNum,
					page_size: PAGE_SIZE,
					search: debounced || undefined,
					status: statusFilter === 'all' ? undefined : statusFilter,
					plan_id: planFilter === 'all' ? undefined : planFilter
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load membership payments');
			return res.data;
		},
		enabled: !!accessToken
	}));

	const payments = $derived(
		(paymentsQuery.data?.results ?? []) as OrganizationMembershipPaymentSchema[]
	);
	const totalCount = $derived(paymentsQuery.data?.count ?? 0);
	const totalPages = $derived(Math.max(1, Math.ceil(totalCount / PAGE_SIZE)));
	const hasFilters = $derived(statusFilter !== 'all' || planFilter !== 'all' || !!debounced);
</script>

<div class="space-y-3">
	<p class="text-sm text-muted-foreground">{m['orgAdmin.members.payments.description']()}</p>

	<div class="flex flex-col gap-2 sm:flex-row sm:items-end">
		<div class="flex-1">
			<Label for="payments-search" class="sr-only">
				{m['orgAdmin.members.payments.searchLabel']()}
			</Label>
			<Input
				id="payments-search"
				type="search"
				bind:value={search}
				aria-describedby="payments-search-hint"
				placeholder={m['orgAdmin.members.payments.searchPlaceholder']()}
				class="max-w-sm"
			/>
		</div>

		<div>
			<Label for="payments-status" class="sr-only">
				{m['orgAdmin.members.payments.filter.statusLabel']()}
			</Label>
			<select id="payments-status" bind:value={statusFilter} class={SELECT_CLASS}>
				<option value="all">{m['orgAdmin.members.payments.filter.allStatuses']()}</option>
				<option value="succeeded">{m['orgAdmin.members.payments.status.succeeded']()}</option>
				<option value="pending">{m['orgAdmin.members.payments.status.pending']()}</option>
				<option value="failed">{m['orgAdmin.members.payments.status.failed']()}</option>
				<option value="refunded">{m['orgAdmin.members.payments.status.refunded']()}</option>
			</select>
		</div>

		{#if plans.length > 0}
			<div>
				<Label for="payments-plan" class="sr-only">
					{m['orgAdmin.members.payments.filter.planLabel']()}
				</Label>
				<select id="payments-plan" bind:value={planFilter} class={SELECT_CLASS}>
					<option value="all">{m['orgAdmin.members.payments.filter.allPlans']()}</option>
					{#each plans as plan (plan.id)}
						<option value={plan.id}>{plan.tier_name} · {plan.name}</option>
					{/each}
				</select>
			</div>
		{/if}
	</div>

	<p id="payments-search-hint" class="text-xs text-muted-foreground">
		{m['orgAdmin.members.payments.searchHint']()}
	</p>

	{#if paymentsQuery.isLoading}
		<p class="flex items-center gap-2 text-sm text-muted-foreground" role="status">
			<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
			{m['orgAdmin.members.payments.loading']()}
		</p>
	{:else if paymentsQuery.isError}
		<div role="alert" class="space-y-2">
			<p class="text-sm text-destructive">{m['orgAdmin.members.payments.error']()}</p>
			<Button variant="outline" size="sm" onclick={() => paymentsQuery.refetch()}>
				{m['orgAdmin.members.payments.retry']()}
			</Button>
		</div>
	{:else if payments.length === 0}
		<p class="text-sm text-muted-foreground" role="status">
			{#if hasFilters}
				{m['orgAdmin.members.payments.emptyFiltered']()}
			{:else}
				{m['orgAdmin.members.payments.empty']()}
			{/if}
		</p>
	{:else}
		<p class="text-sm text-muted-foreground" role="status">
			{m['orgAdmin.members.payments.resultCount']({ count: totalCount })}
		</p>

		<!-- Wide viewports: the full reconciliation table. -->
		<div class="hidden overflow-x-auto md:block">
			<table class="w-full text-sm">
				<caption class="sr-only">{m['orgAdmin.members.payments.tableCaption']()}</caption>
				<thead class="border-b">
					<tr>
						<th scope="col" class="px-3 py-2 text-left"
							>{m['orgAdmin.members.payments.col.member']()}</th
						>
						<th scope="col" class="px-3 py-2 text-left"
							>{m['orgAdmin.members.payments.col.plan']()}</th
						>
						<th scope="col" class="px-3 py-2 text-left"
							>{m['orgAdmin.members.payments.col.amount']()}</th
						>
						<th scope="col" class="px-3 py-2 text-left"
							>{m['orgAdmin.members.payments.col.status']()}</th
						>
						<th scope="col" class="px-3 py-2 text-left"
							>{m['orgAdmin.members.payments.col.date']()}</th
						>
						<th scope="col" class="px-3 py-2 text-right"
							>{m['orgAdmin.members.payments.col.reference']()}</th
						>
					</tr>
				</thead>
				<tbody>
					{#each payments as payment (payment.id)}
						<SubscriptionPaymentsRow {payment} />
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Narrow viewports: the same rows as cards. A six-column ledger cannot
		     usefully overflow sideways on a phone. Only one of the two is ever
		     visible (`hidden md:block` / `md:hidden`). -->
		<ul class="grid gap-2 md:hidden" aria-label={m['orgAdmin.members.payments.tableCaption']()}>
			{#each payments as payment (payment.id)}
				<SubscriptionPaymentsCard {payment} />
			{/each}
		</ul>

		{#if totalPages > 1}
			<nav
				class="flex items-center justify-between"
				aria-label={m['orgAdmin.members.payments.title']()}
			>
				<p class="text-sm text-muted-foreground">
					{m['orgAdmin.members.payments.pageOf']({ page: pageNum, total: totalPages })}
				</p>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" disabled={pageNum <= 1} onclick={() => pageNum--}>
						{m['membershipRequestsTab.previous']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={pageNum >= totalPages}
						onclick={() => pageNum++}
					>
						{m['membershipRequestsTab.next']()}
					</Button>
				</div>
			</nav>
		{/if}
	{/if}
</div>
