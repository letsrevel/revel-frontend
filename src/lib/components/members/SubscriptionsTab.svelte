<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminsubscriptionsListSubscriptions,
		organizationadminsubscriptionsCreateSubscription
	} from '$lib/api/generated/sdk.gen';
	import type {
		SubscriptionSchema,
		OrganizationAdminDetailSchema,
		SubscriptionCreateSchema,
		MembershipTierSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Loader2, Plus } from 'lucide-svelte';
	import SubscriptionListItem from './SubscriptionListItem.svelte';
	import SubscriptionCreateModal from './SubscriptionCreateModal.svelte';
	import SubscriptionDrawer from './SubscriptionDrawer.svelte';
	import { onDestroy } from 'svelte';

	// Buffer matching the bits-ui Dialog close animation. Chaining a Dialog
	// open inside another Dialog's close handler in the same tick leaves
	// `pointer-events: none` stuck on <body>; waiting for the close to settle
	// avoids that.
	const DIALOG_CLOSE_MS = 250;

	interface Props {
		organization: OrganizationAdminDetailSchema;
		tiers: MembershipTierSchema[];
	}

	const { organization, tiers }: Props = $props();
	const tierNameById = $derived(
		new Map(tiers.filter((t) => t.id).map((t) => [t.id as string, t.name]))
	);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	let search = $state('');
	let debounced = $state('');
	let statusFilter = $state<string>('all');
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

	const subsQuery = createQuery(() => ({
		queryKey: [
			'organization',
			organization.slug,
			'subscriptions',
			{ search: debounced, page: pageNum }
		],
		queryFn: async () => {
			const res = await organizationadminsubscriptionsListSubscriptions({
				path: { slug: organization.slug },
				query: { page: pageNum, page_size: 100, search: debounced || undefined },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load subscriptions');
			return res.data;
		},
		enabled: !!accessToken
	}));

	const subs = $derived((subsQuery.data?.results ?? []) as SubscriptionSchema[]);
	const filtered = $derived(
		statusFilter === 'all' ? subs : subs.filter((s) => s.status === statusFilter)
	);

	const createMut = createMutation(() => ({
		mutationFn: async (payload: SubscriptionCreateSchema) => {
			const res = await organizationadminsubscriptionsCreateSubscription({
				path: { slug: organization.slug },
				body: payload,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) {
				const detail = (res.error as { detail?: string }).detail ?? 'Failed to create subscription';
				throw new Error(detail);
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
		onError: (err: Error) => alert(`Failed to create subscription: ${err.message}`)
	}));
</script>

<div class="space-y-3">
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
				<option value="active">{m['subscriptions.status.active']()}</option>
				<option value="pending">{m['subscriptions.status.pending']()}</option>
				<option value="past_due">{m['subscriptions.status.past_due']()}</option>
				<option value="paused">{m['subscriptions.status.paused']()}</option>
				<option value="cancelled">{m['subscriptions.status.cancelled']()}</option>
				<option value="expired">{m['subscriptions.status.expired']()}</option>
			</select>
		</div>
		<Button onclick={() => (createOpen = true)}>
			<Plus class="mr-1 h-4 w-4" />
			{m['orgAdmin.members.subscriptions.create.title']()}
		</Button>
	</div>

	{#if subsQuery.isLoading}
		<Loader2 class="h-5 w-5 animate-spin" />
	{:else if filtered.length === 0}
		<p class="text-sm text-muted-foreground">
			{#if statusFilter !== 'all' && subs.length > 0}
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
						<th class="px-3 py-2 text-left">{m['orgAdmin.members.subscriptions.col.user']()}</th>
						<th class="px-3 py-2 text-left">{m['orgAdmin.members.subscriptions.col.tier']()}</th>
						<th class="px-3 py-2 text-left">{m['orgAdmin.members.subscriptions.col.plan']()}</th>
						<th class="px-3 py-2 text-left">{m['orgAdmin.members.subscriptions.col.status']()}</th>
						<th class="px-3 py-2 text-left"
							>{m['orgAdmin.members.subscriptions.col.periodEnd']()}</th
						>
					</tr>
				</thead>
				<tbody>
					{#each filtered as s (s.id)}
						<SubscriptionListItem
							sub={s}
							tierName={tierNameById.get(s.plan.tier_id) ?? null}
							onClick={() => (drawerSubId = s.id ?? null)}
						/>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile cards -->
		<div class="grid gap-2 md:hidden">
			{#each filtered as s (s.id)}
				<SubscriptionListItem
					sub={s}
					tierName={tierNameById.get(s.plan.tier_id) ?? null}
					onClick={() => (drawerSubId = s.id ?? null)}
				/>
			{/each}
		</div>
	{/if}
</div>

<SubscriptionCreateModal
	{organization}
	{tiers}
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
