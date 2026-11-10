<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { createMutation, createQuery } from '@tanstack/svelte-query';
	import {
		organizationadminsubscriptionsListOrganizationPlans,
		organizationadminsubscriptionsStaffChangeSubscriptionPlan
	} from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationAdminDetailSchema,
		PlanSchema,
		SubscriptionSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Loader2 } from '@lucide/svelte';
	import { formatPlanPrice } from '$lib/utils/subscriptions';
	import {
		eligibleChangePlans,
		groupPlansByTier,
		isPlanSoldOut,
		planChangeErrorMessage
	} from '$lib/utils/plan-change';

	/**
	 * Staff move a member to another OFFLINE / FREE plan. The change is immediate,
	 * takes no payment and the member's tier follows the new plan, so the dialog
	 * says exactly that before it is confirmed.
	 */
	interface Props {
		organization: OrganizationAdminDetailSchema;
		sub: SubscriptionSchema;
		open: boolean;
		onClose: () => void;
		/** Called after a successful change; the owner invalidates what it shows. */
		onChanged: () => void;
	}

	const { organization, sub, open, onClose, onChanged }: Props = $props();
	const accessToken = $derived(authStore.accessToken);

	let planId = $state('');
	let submitError = $state<string | null>(null);

	// Same key as the create modal: one fetch serves both.
	const plansQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'plans', { is_active: true }],
		queryFn: async () => {
			const res = await organizationadminsubscriptionsListOrganizationPlans({
				path: { slug: organization.slug },
				query: { is_active: true },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load plans');
			return res.data as PlanSchema[];
		},
		enabled: open && !!accessToken
	}));

	const options = $derived(eligibleChangePlans(plansQuery.data ?? [], sub.plan));
	const groups = $derived(groupPlansByTier(options));
	// Only a plan that is still offered (and not sold out) counts: a refetch can drop
	// the selected plan, and a stale id must never be sent.
	const target = $derived(options.find((p) => p.id === planId && !isPlanSoldOut(p)) ?? null);

	// A fresh session each time the dialog opens.
	$effect(() => {
		if (!open) {
			planId = '';
			submitError = null;
		}
	});

	const changeMut = createMutation(() => ({
		mutationFn: async (newPlanId: string) => {
			const res = await organizationadminsubscriptionsStaffChangeSubscriptionPlan({
				path: { slug: organization.slug, sub_id: sub.id ?? '' },
				body: { plan_id: newPlanId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error(planChangeErrorMessage(res.error, res.response?.status));
			return res.data;
		},
		onSuccess: (data) => {
			toast.success(
				m['subscriptionChangePlan.success']({ plan: data?.plan.name ?? target?.name ?? '' })
			);
			// The parent invalidates (once, fire-and-forget): the dialog closes at once.
			onChanged();
			onClose();
		},
		onError: (err: Error) => (submitError = err.message)
	}));

	function handleSubmit(e: Event): void {
		e.preventDefault();
		if (!target?.id || changeMut.isPending) return;
		submitError = null;
		changeMut.mutate(target.id);
	}
</script>

<!-- Not dismissible mid-request: an Esc/overlay close would drop the backend's answer. -->
<Dialog
	bind:open={
		() => open,
		(v: boolean) => {
			if (!v && !changeMut.isPending) onClose();
		}
	}
>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['subscriptionChangePlan.title']()}</DialogTitle>
			<DialogDescription>
				{m['subscriptionChangePlan.current']({
					plan: sub.plan.name,
					tier: sub.plan.tier_name
				})}
			</DialogDescription>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="space-y-1">
				<Label for="change-plan-select">{m['subscriptionChangePlan.planLabel']()}</Label>
				{#if plansQuery.isLoading}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				{:else if plansQuery.isError}
					<p role="alert" class="text-sm text-destructive">
						{m['subscriptionChangePlan.loadError']()}
					</p>
				{:else if options.length === 0}
					<p class="text-sm text-muted-foreground" data-testid="change-plan-none">
						{m['subscriptionChangePlan.noPlans']()}
					</p>
				{:else}
					<select
						id="change-plan-select"
						bind:value={planId}
						disabled={changeMut.isPending}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						<option value="" disabled>—</option>
						{#each groups as group (group.tierId)}
							<optgroup label={group.tierName}>
								{#each group.plans as p (p.id)}
									<option value={p.id ?? ''} disabled={isPlanSoldOut(p)}>
										{p.name} — {formatPlanPrice(p)}{isPlanSoldOut(p)
											? ` ${m['subscriptionChangePlan.soldOutSuffix']()}`
											: ''}
									</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				{/if}
			</div>

			{#if target}
				<p class="text-sm text-muted-foreground" data-testid="change-plan-confirm-text">
					{m['subscriptionChangePlan.confirm']({ plan: target.name, tier: target.tier_name })}
				</p>
			{/if}

			{#if submitError}
				<p role="alert" class="text-sm text-destructive">{submitError}</p>
			{/if}

			<div class="flex flex-wrap justify-end gap-2">
				<Button type="button" variant="outline" onclick={onClose} disabled={changeMut.isPending}>
					{m['tierForm.cancel']()}
				</Button>
				<Button type="submit" disabled={!target || changeMut.isPending}>
					{#if changeMut.isPending}<Loader2
							class="mr-2 h-4 w-4 animate-spin"
							aria-hidden="true"
						/>{/if}
					{m['subscriptionChangePlan.submit']()}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
