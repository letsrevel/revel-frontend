<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminsubscriptionsListPlans,
		organizationadminsubscriptionsCreatePlan,
		organizationadminsubscriptionsUpdatePlan,
		organizationadminsubscriptionsDeletePlan,
		organizationadminsubscriptionsArchivePlan
	} from '$lib/api/generated/sdk.gen';
	import type {
		PlanSchema,
		MembershipTierSchema,
		OrganizationAdminDetailSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Pencil, Archive, Trash2, Plus, Loader2, RefreshCw } from '@lucide/svelte';
	import PlanFormModal, { type PlanFormPayload } from './PlanFormModal.svelte';
	import MigrateSubscribersDialog from './MigrateSubscribersDialog.svelte';
	import { formatPlanPrice } from '$lib/utils/subscriptions';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		tier: MembershipTierSchema;
	}

	const { organization, tier }: Props = $props();
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	const plansQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'tier', tier.id, 'plans'],
		queryFn: async () => {
			const res = await organizationadminsubscriptionsListPlans({
				path: { slug: organization.slug, tier_id: tier.id ?? '' },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load plans');
			return res.data as PlanSchema[];
		},
		enabled: !!accessToken
	}));

	const plans = $derived(plansQuery.data ?? []);

	let editing = $state<PlanSchema | null>(null);
	let formOpen = $state(false);
	let migrating = $state<PlanSchema | null>(null);

	function invalidatePlans() {
		queryClient.invalidateQueries({
			queryKey: ['organization', organization.slug, 'tier', tier.id, 'plans']
		});
		// The staff "create subscription" picker keys its org-wide plan list on
		// ['organization', slug, 'plans', …] — invalidate that prefix too, or a
		// freshly created plan stays missing from the picker until it goes stale.
		queryClient.invalidateQueries({
			queryKey: ['organization', organization.slug, 'plans']
		});
	}

	const createMut = createMutation(() => ({
		mutationFn: async (payload: PlanFormPayload) => {
			const res = await organizationadminsubscriptionsCreatePlan({
				path: { slug: organization.slug, tier_id: tier.id ?? '' },
				body: payload,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to create plan');
			return res.data;
		},
		onSuccess: () => {
			invalidatePlans();
			formOpen = false;
		},
		onError: (err: Error) =>
			toast.error(m['orgAdmin.members.plans.errors.createFailed']({ detail: err.message }))
	}));

	const updateMut = createMutation(() => ({
		mutationFn: async ({ id, payload }: { id: string; payload: PlanFormPayload }) => {
			const res = await organizationadminsubscriptionsUpdatePlan({
				path: { slug: organization.slug, plan_id: id },
				body: payload,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to update plan');
			return res.data;
		},
		onSuccess: () => {
			invalidatePlans();
			formOpen = false;
			editing = null;
		},
		onError: (err: Error) =>
			toast.error(m['orgAdmin.members.plans.errors.updateFailed']({ detail: err.message }))
	}));

	const archiveMut = createMutation(() => ({
		mutationFn: async (id: string) => {
			const res = await organizationadminsubscriptionsArchivePlan({
				path: { slug: organization.slug, plan_id: id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to archive plan');
			return res.data;
		},
		onSuccess: invalidatePlans,
		onError: (err: Error) =>
			toast.error(m['orgAdmin.members.plans.errors.archiveFailed']({ detail: err.message }))
	}));

	const deleteMut = createMutation(() => ({
		mutationFn: async (id: string) => {
			const res = await organizationadminsubscriptionsDeletePlan({
				path: { slug: organization.slug, plan_id: id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) {
				throw new Error(m['orgAdmin.members.plans.delete.inUse']());
			}
		},
		onSuccess: invalidatePlans
	}));

	function openCreate() {
		editing = null;
		formOpen = true;
	}

	function openEdit(p: PlanSchema) {
		editing = p;
		formOpen = true;
	}

	function handleSave(payload: PlanFormPayload) {
		if (editing) {
			updateMut.mutate({ id: editing.id ?? '', payload });
		} else {
			createMut.mutate(payload);
		}
	}

	function handleDelete(p: PlanSchema) {
		if (!confirm(`Delete ${p.name}?`)) return;
		const planId = p.id ?? '';
		deleteMut.mutate(planId, {
			onError: () => {
				if (
					confirm(
						`${m['orgAdmin.members.plans.delete.inUse']()}\n\n${m['orgAdmin.members.plans.delete.archiveInstead']()}?`
					)
				) {
					archiveMut.mutate(planId);
				}
			}
		});
	}
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between">
		<h4 class="text-sm font-semibold">{m['orgAdmin.members.plans.title']()}</h4>
		<Button size="sm" variant="outline" onclick={openCreate}>
			<Plus class="mr-1 h-3 w-3" />
			{m['orgAdmin.members.plans.add']()}
		</Button>
	</div>

	{#if plansQuery.isLoading}
		<Loader2 class="h-4 w-4 animate-spin" />
	{:else if plans.length === 0}
		<p class="text-sm text-muted-foreground">{m['orgAdmin.members.plans.empty']()}</p>
	{:else}
		<div class="space-y-2">
			{#each plans as p (p.id)}
				<Card class={p.is_active !== false ? '' : 'opacity-60'}>
					<CardContent class="p-3">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium">{p.name}</p>
								<p class="text-sm text-muted-foreground">{formatPlanPrice(p)}</p>
								<div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
									<span class="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
										{p.payment_method === 'online'
											? m['orgAdmin.members.plans.badge.online']()
											: m['orgAdmin.members.plans.badge.offline']()}
									</span>
									<span class="text-muted-foreground">
										{p.max_subscriptions != null
											? m['orgAdmin.members.plans.occupancyCapped']({
													active: p.active_subscription_count,
													cap: p.max_subscriptions
												})
											: m['orgAdmin.members.plans.occupancy']({
													active: p.active_subscription_count
												})}
									</span>
									{#if p.max_subscriptions != null && p.active_subscription_count >= p.max_subscriptions}
										<span
											class="rounded-full bg-red-100 px-2 py-0.5 text-red-900 dark:bg-red-900/30 dark:text-red-100"
										>
											{m['orgAdmin.members.plans.badge.soldOut']()}
										</span>
									{/if}
									{#if p.sales_status === 'paused'}
										<span
											class="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
										>
											{m['orgAdmin.members.plans.badge.paused']()}
										</span>
									{/if}
								</div>
								{#if p.is_active === false}
									<p class="mt-1 text-xs text-muted-foreground">
										{m['orgAdmin.members.plans.archived']()}
									</p>
								{/if}
							</div>
							<div class="flex shrink-0 gap-0.5">
								<Button
									size="icon"
									variant="ghost"
									class="h-7 w-7"
									aria-label={m['orgAdmin.members.plans.edit']()}
									onclick={() => openEdit(p)}
								>
									<Pencil class="h-3.5 w-3.5" />
								</Button>
								{#if p.payment_method === 'online' && p.active_subscription_count > 0}
									<Button
										size="icon"
										variant="ghost"
										class="h-7 w-7"
										aria-label={m['orgAdmin.members.plans.migrate.title']()}
										onclick={() => (migrating = p)}
									>
										<RefreshCw class="h-3.5 w-3.5" />
									</Button>
								{/if}
								{#if p.is_active !== false}
									<Button
										size="icon"
										variant="ghost"
										class="h-7 w-7"
										aria-label={m['orgAdmin.members.plans.archive']()}
										onclick={() => archiveMut.mutate(p.id ?? '')}
									>
										<Archive class="h-3.5 w-3.5" />
									</Button>
								{/if}
								<Button
									size="icon"
									variant="ghost"
									class="h-7 w-7 text-destructive"
									aria-label={m['orgAdmin.members.plans.delete.title']()}
									onclick={() => handleDelete(p)}
								>
									<Trash2 class="h-3.5 w-3.5" />
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			{/each}
		</div>
	{/if}
</div>

<PlanFormModal
	plan={editing}
	open={formOpen}
	onClose={() => {
		formOpen = false;
		editing = null;
	}}
	onSave={handleSave}
	{organization}
	isSaving={createMut.isPending || updateMut.isPending}
/>

{#if migrating}
	<MigrateSubscribersDialog
		{organization}
		plan={migrating}
		open={!!migrating}
		onClose={() => (migrating = null)}
	/>
{/if}
