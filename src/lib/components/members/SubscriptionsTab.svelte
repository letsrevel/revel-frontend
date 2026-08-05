<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminsubscriptionsListSubscriptions,
		organizationadminsubscriptionsCreateSubscription
	} from '$lib/api/generated/sdk.gen';
	import type {
		SubscriptionSchema,
		OrganizationAdminDetailSchema,
		SubscriptionCreateSchema,
		SubscriptionStatus
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Loader2, Plus } from '@lucide/svelte';
	import SubscriptionListItem from './SubscriptionListItem.svelte';
	import SubscriptionCreateModal from './SubscriptionCreateModal.svelte';
	import SubscriptionDrawer from './SubscriptionDrawer.svelte';
	import SubscriptionMetrics from './SubscriptionMetrics.svelte';
	import { onDestroy } from 'svelte';
	import { backendMessage } from '$lib/utils/api-error-detail';
	import { getStatusLabel, STATUS_ORDER } from '$lib/utils/subscriptions';

	// Buffer matching the bits-ui Dialog close animation. Chaining a Dialog
	// open inside another Dialog's close handler in the same tick leaves
	// `pointer-events: none` stuck on <body>; waiting for the close to settle
	// avoids that.
	const DIALOG_CLOSE_MS = 250;

	interface Props {
		organization: OrganizationAdminDetailSchema;
	}

	const { organization }: Props = $props();
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	const PAGE_SIZE = 25;

	let search = $state('');
	let debounced = $state('');
	let statusFilter = $state<SubscriptionStatus | 'all'>('all');
	let pageNum = $state(1);
	let createOpen = $state(false);
	let drawerSubId = $state<string | null>(null);
	let drawerOpenTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(drawerOpenTimer));

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
		pageNum = 1;
	});

	const subsQuery = createQuery(() => ({
		queryKey: [
			'organization',
			organization.slug,
			'subscriptions',
			{ search: debounced, page: pageNum, status: statusFilter }
		],
		queryFn: async () => {
			const res = await organizationadminsubscriptionsListSubscriptions({
				path: { slug: organization.slug },
				query: {
					page: pageNum,
					page_size: PAGE_SIZE,
					search: debounced || undefined,
					status: statusFilter === 'all' ? undefined : statusFilter
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load subscriptions');
			return res.data;
		},
		enabled: !!accessToken
	}));

	const subs = $derived((subsQuery.data?.results ?? []) as SubscriptionSchema[]);
	const totalCount = $derived(subsQuery.data?.count ?? 0);
	const totalPages = $derived(Math.max(1, Math.ceil(totalCount / PAGE_SIZE)));

	const createMut = createMutation(() => ({
		mutationFn: async (payload: SubscriptionCreateSchema) => {
			const res = await organizationadminsubscriptionsCreateSubscription({
				path: { slug: organization.slug },
				body: payload,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) {
				// 400 is `ValidationErrorResponse | ErrorDetail` (backend #824): the old
				// `{detail?: string}` cast silently dropped the `{errors}` branch and
				// stringified a request-validation 422's `detail` LIST.
				throw new Error(backendMessage(res.error) ?? 'Failed to create subscription');
			}
			return res.data as SubscriptionSchema;
		},
		onSuccess: (sub) => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'subscriptions']
			});
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'members']
			});
			createOpen = false;
			const id = sub.id ?? null;
			clearTimeout(drawerOpenTimer);
			drawerOpenTimer = setTimeout(() => {
				drawerSubId = id;
			}, DIALOG_CLOSE_MS);
		},
		onError: (err: Error) => toast.error(err.message)
	}));
</script>

<div class="space-y-3">
	<SubscriptionMetrics {organization} />
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex flex-1 flex-col gap-2 sm:flex-row">
			<Input
				bind:value={search}
				placeholder={m['orgAdmin.members.subscriptions.searchPlaceholder']()}
				class="max-w-sm"
			/>
			<select
				bind:value={statusFilter}
				class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:w-48"
				aria-label={m['orgAdmin.members.subscriptions.filter.all']()}
			>
				<option value="all">{m['orgAdmin.members.subscriptions.filter.all']()}</option>
				<!-- Driven off the shared, exhaustive-by-construction order rather than
				     six hand-written options: a new backend status now reaches the
				     dropdown, the metrics strip and the badge together. -->
				{#each STATUS_ORDER as status (status)}
					<option value={status}>{getStatusLabel(status)}</option>
				{/each}
			</select>
		</div>
		<Button onclick={() => (createOpen = true)}>
			<Plus class="mr-1 h-4 w-4" />
			{m['orgAdmin.members.subscriptions.create.title']()}
		</Button>
	</div>

	{#if subsQuery.isLoading}
		<Loader2 class="h-5 w-5 animate-spin" />
	{:else if subs.length === 0}
		<p class="text-sm text-muted-foreground">
			{#if statusFilter !== 'all' || debounced}
				{m['orgAdmin.members.subscriptions.emptyFiltered']()}
			{:else}
				{m['orgAdmin.members.subscriptions.empty']()}
			{/if}
		</p>
	{:else}
		<!-- Desktop table -->
		<div class="hidden overflow-x-auto md:block">
			<table class="w-full text-sm">
				<thead class="border-b">
					<tr>
						<th
							class="px-3 py-2 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
							>{m['orgAdmin.members.subscriptions.col.user']()}</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
							>{m['orgAdmin.members.subscriptions.col.tier']()}</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
							>{m['orgAdmin.members.subscriptions.col.plan']()}</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
							>{m['orgAdmin.members.subscriptions.col.status']()}</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
							>{m['orgAdmin.members.subscriptions.col.periodEnd']()}</th
						>
					</tr>
				</thead>
				<tbody>
					{#each subs as s (s.id)}
						<SubscriptionListItem sub={s} onClick={() => (drawerSubId = s.id ?? null)} />
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile cards -->
		<div class="grid gap-2 md:hidden">
			{#each subs as s (s.id)}
				<SubscriptionListItem sub={s} onClick={() => (drawerSubId = s.id ?? null)} />
			{/each}
		</div>

		{#if totalPages > 1}
			<div class="flex items-center justify-between">
				<p class="text-sm text-muted-foreground">
					{m['orgAdmin.members.subscriptions.pageOf']({ page: pageNum, total: totalPages })}
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
			</div>
		{/if}
	{/if}
</div>

<SubscriptionCreateModal
	{organization}
	open={createOpen}
	onClose={() => (createOpen = false)}
	onSubmit={(p) => createMut.mutate(p)}
	isSubmitting={createMut.isPending}
/>

{#if drawerSubId}
	<SubscriptionDrawer
		{organization}
		subId={drawerSubId}
		open={!!drawerSubId}
		onClose={() => (drawerSubId = null)}
	/>
{/if}
