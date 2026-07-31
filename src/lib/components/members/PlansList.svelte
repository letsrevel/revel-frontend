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
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { AlertTriangle, Pencil, Archive, Trash2, Plus, Loader2, RefreshCw } from '@lucide/svelte';
	import PlanFormModal, { type PlanFormPayload } from './PlanFormModal.svelte';
	import MigrateSubscribersDialog from './MigrateSubscribersDialog.svelte';
	import { formatPlanPrice, isLifetimePlan } from '$lib/utils/subscriptions';
	import { backendMessage } from '$lib/utils/api-error-detail';

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
	let archiveTarget = $state<PlanSchema | null>(null);
	let deleteTarget = $state<PlanSchema | null>(null);
	// Set when a delete comes back refused, so the dialog can explain *why* and —
	// only when archiving would actually help — offer it as the way forward.
	let deleteRefusal = $state<{ message: string; canArchive: boolean } | null>(null);

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
			// The refusal reason has to reach the organizer: creating a plan on a tier
			// carrying `requires_membership_approval` / `membership_questionnaire` is
			// now a 400 with a translated `detail` explaining exactly that (those knobs
			// were previously inert, so the tier looks fine until you try this). A
			// hardcoded string here would render it as an unexplained failure.
			if (res.error) throw new Error(backendMessage(res.error) || m['common.errors_tryAgain']());
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
			if (res.error) throw new Error(backendMessage(res.error) || m['common.errors_tryAgain']());
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
			if (res.error) throw new Error(backendMessage(res.error) || m['common.errors_tryAgain']());
			return res.data;
		},
		onSuccess: () => {
			invalidatePlans();
			archiveTarget = null;
			deleteTarget = null;
			deleteRefusal = null;
		},
		onError: (err: Error) =>
			toast.error(m['orgAdmin.members.plans.errors.archiveFailed']({ detail: err.message }))
	}));

	const deleteMut = createMutation(() => ({
		mutationFn: async (plan: PlanSchema) => {
			const res = await organizationadminsubscriptionsDeletePlan({
				path: { slug: organization.slug, plan_id: plan.id ?? '' },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) {
				// `subscription_service.delete_plan` raises 400 for exactly one reason —
				// the plan still has subscriptions — so that is the only status where
				// "archive instead" is a real remedy. Everything else (404 on a plan a
				// colleague already removed, a 5xx, a dropped connection) used to be
				// reported as "this plan has subscribers", which was simply untrue.
				const inUse = res.response?.status === 400;
				deleteRefusal = {
					message:
						backendMessage(res.error) ||
						(inUse
							? m['orgAdmin.members.plans.delete.inUse']()
							: m['orgAdmin.members.plans.errors.deleteFailed']()),
					// Archiving an already-archived plan is a no-op, so don't offer it.
					canArchive: inUse && plan.is_active !== false
				};
				throw new Error(deleteRefusal.message);
			}
		},
		onSuccess: () => {
			invalidatePlans();
			deleteTarget = null;
			deleteRefusal = null;
		},
		// No toast: the refusal is rendered inside the still-open dialog, next to the
		// archive escape hatch it may offer. The guard catches a *thrown* failure
		// (network drop, not an HTTP error envelope), which never reaches the branch
		// above and would otherwise leave the dialog silently unchanged.
		onError: () => {
			deleteRefusal ??= {
				message: m['orgAdmin.members.plans.errors.deleteFailed'](),
				canArchive: false
			};
		}
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

	function openDelete(p: PlanSchema) {
		deleteRefusal = null;
		deleteTarget = p;
	}

	function closeDelete() {
		if (deleteMut.isPending || archiveMut.isPending) return;
		deleteTarget = null;
		deleteRefusal = null;
	}

	function closeArchive() {
		if (archiveMut.isPending) return;
		archiveTarget = null;
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
										{#if p.payment_method === 'online'}
											{m['orgAdmin.members.plans.badge.online']()}
										{:else if p.payment_method === 'free'}
											{m['orgAdmin.members.plans.badge.free']()}
										{:else}
											{m['orgAdmin.members.plans.badge.offline']()}
										{/if}
									</span>
									<!-- A lifetime term has no renewal to quote, and the price line
									     above says so too ("Free" / "€50.00 · one-time") — this names
									     the fact rather than leaving it implied by an absence. -->
									{#if isLifetimePlan(p)}
										<span class="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
											{m['orgAdmin.members.plans.badge.lifetime']()}
										</span>
									{/if}
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
										onclick={() => (archiveTarget = p)}
									>
										<Archive class="h-3.5 w-3.5" />
									</Button>
								{/if}
								<Button
									size="icon"
									variant="ghost"
									class="h-7 w-7 text-destructive"
									aria-label={m['orgAdmin.members.plans.delete.title']()}
									onclick={() => openDelete(p)}
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

<!-- Archiving reads like a tidy-up but is a gate: it stops new sign-ups, plan
     switches AND revivals into the plan, which can strand an expired member who
     is still inside their revival window. -->
{#if archiveTarget}
	<Dialog open={!!archiveTarget} onOpenChange={(v: boolean) => (!v ? closeArchive() : null)}>
		<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
			<DialogHeader>
				<DialogTitle>
					{m['orgAdmin.members.plans.archiveConfirm.title']({ plan: archiveTarget.name })}
				</DialogTitle>
			</DialogHeader>
			<div class="flex gap-3 text-sm text-muted-foreground">
				<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
				<p>{m['orgAdmin.members.plans.archiveConfirm.body']()}</p>
			</div>
			<div class="flex justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					onclick={closeArchive}
					disabled={archiveMut.isPending}
				>
					{m['common.cancel']()}
				</Button>
				<Button
					type="button"
					onclick={() => archiveMut.mutate(archiveTarget?.id ?? '')}
					disabled={archiveMut.isPending}
				>
					{#if archiveMut.isPending}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
					{m['orgAdmin.members.plans.archiveConfirm.cta']()}
				</Button>
			</div>
		</DialogContent>
	</Dialog>
{/if}

<!-- Delete confirmation. On a refusal the dialog stays open and swaps its body for
     the backend's own sentence — plus the archive escape hatch when (and only
     when) archiving is the actual remedy. -->
{#if deleteTarget}
	<Dialog open={!!deleteTarget} onOpenChange={(v: boolean) => (!v ? closeDelete() : null)}>
		<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
			<DialogHeader>
				<DialogTitle>{m['orgAdmin.members.plans.delete.title']()}</DialogTitle>
			</DialogHeader>
			<div class="flex gap-3 text-sm">
				<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
				<div class="space-y-1">
					<p class="font-medium text-foreground">
						{m['orgAdmin.members.plans.delete.confirmMessage']({ name: deleteTarget.name })}
					</p>
					<p class="text-muted-foreground">
						{deleteRefusal ? deleteRefusal.message : m['orgAdmin.members.plans.delete.body']()}
					</p>
				</div>
			</div>
			<div class="flex justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					onclick={closeDelete}
					disabled={deleteMut.isPending || archiveMut.isPending}
				>
					{m['common.cancel']()}
				</Button>
				{#if deleteRefusal?.canArchive}
					<Button
						type="button"
						onclick={() => archiveMut.mutate(deleteTarget?.id ?? '')}
						disabled={archiveMut.isPending}
					>
						{#if archiveMut.isPending}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
						{m['orgAdmin.members.plans.delete.archiveInstead']()}
					</Button>
				{:else}
					<Button
						type="button"
						variant="destructive"
						onclick={() => deleteTarget && deleteMut.mutate(deleteTarget)}
						disabled={deleteMut.isPending}
					>
						{#if deleteMut.isPending}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
						{m['orgAdmin.members.plans.delete.title']()}
					</Button>
				{/if}
			</div>
		</DialogContent>
	</Dialog>
{/if}
