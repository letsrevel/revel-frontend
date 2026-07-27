<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		mesubscriptionsChangePlan,
		organizationListMembershipPlans
	} from '$lib/api/generated/sdk.gen';
	import type { MySubscriptionSchema, PublicPlanSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { classifyPlanChange, formatPlanPrice } from '$lib/utils/subscriptions';
	import { formatDate } from '$lib/utils/date';
	import { backendMessage } from '$lib/utils/api-error-detail';
	import { Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		sub: MySubscriptionSchema;
	}
	const { open, onOpenChange, sub }: Props = $props();

	/** A plan that can be named in a change-plan request: `id` is guaranteed. */
	type Candidate = PublicPlanSchema & { id: string };

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();
	const uid = $props.id();

	let selectedId = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	// The plan catalogue is org-level and public; fetch it only while the dialog
	// is actually open so closed cards cost nothing.
	const plansQuery = createQuery(() => ({
		queryKey: ['org', sub.organization_slug, 'membership-plans'],
		queryFn: async () => {
			const res = await organizationListMembershipPlans({
				path: { slug: sub.organization_slug }
			});
			// The endpoint returns a bare array (no pagination envelope).
			if (res.error || !res.data) throw new Error(m['changePlan.loadError']());
			return res.data;
		},
		enabled: open
	}));

	// Only plans the backend would actually accept: a different plan, billed
	// online, in the currency the Stripe subscription already runs in.
	const candidates = $derived(
		(plansQuery.data ?? []).filter(
			(p): p is Candidate =>
				Boolean(p.id) &&
				p.id !== sub.plan_id &&
				p.payment_method === 'online' &&
				p.currency === sub.plan.currency
		)
	);

	function isSelectable(p: Candidate): boolean {
		return !p.sold_out && p.sales_status === 'open';
	}

	/** Why an option cannot be picked — sold out wins when both apply. */
	function unavailableReason(p: Candidate): { label: string; helper: string } | null {
		if (p.sold_out) {
			return {
				label: m['membershipPlans.soldOut'](),
				helper: m['membershipPlans.soldOutHelper']()
			};
		}
		if (p.sales_status !== 'open') {
			return { label: m['membershipPlans.paused'](), helper: m['membershipPlans.pausedHelper']() };
		}
		return null;
	}

	const selected = $derived(candidates.find((p) => p.id === selectedId) ?? null);
	const direction = $derived(selected ? classifyPlanChange(sub.plan, selected) : null);

	const changeMutation = createMutation(() => ({
		mutationFn: async () => {
			const target = selected;
			if (!target) throw new Error(m['changePlan.error']());
			errorMessage = null;
			const res = await mesubscriptionsChangePlan({
				path: { org_id: sub.organization_id },
				body: { plan_id: target.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// hey-api resolves rather than throws — a missing payload is a failure
			// even when no error body came back.
			if (res.error || !res.data) {
				throw new Error(backendMessage(res.error) || m['changePlan.error']());
			}
			// The target travels with the result so the toast never depends on
			// state that may have moved on by the time the request settles.
			return { data: res.data, target };
		},
		onSuccess: ({ data, target }) => {
			queryClient.invalidateQueries({ queryKey: ['me', 'memberships'] });
			queryClient.invalidateQueries({ queryKey: ['me', 'subscriptions'] });
			queryClient.invalidateQueries({
				queryKey: ['me', 'org', sub.organization_id, 'subscription']
			});
			if (classifyPlanChange(sub.plan, target) === 'upgrade') {
				toast.success(m['changePlan.successUpgrade']());
			} else if (data.current_period_end) {
				toast.success(
					m['changePlan.successDowngradeDated']({
						plan: target.name,
						date: formatDate(data.current_period_end)
					})
				);
			} else {
				toast.success(m['changePlan.successDowngrade']());
			}
			onOpenChange(false);
		},
		onError: (err: Error) => {
			errorMessage = err.message || m['changePlan.error']();
		}
	}));

	const isBusy = $derived(changeMutation.isPending);
	const loadError = $derived(plansQuery.isError ? m['changePlan.loadError']() : null);
	// Every operand is read unconditionally: a short-circuiting expression would
	// leave the skipped one untracked once the guard flips.
	const canConfirm = $derived.by(() => {
		const busy = isBusy;
		const hasTarget = selected !== null;
		return !busy && hasTarget;
	});

	// Fresh choices every time the dialog opens; leave content intact during the
	// close animation (reset-on-open, not on close). These are user-editable
	// choices, so they cannot be `$derived`; and the parent owns `open`, so it
	// can flip it without ever calling `handleOpenChange` — an effect on `open`
	// is the only place that catches every opening.
	$effect(() => {
		if (!open) return;
		selectedId = null;
		errorMessage = null;
	});

	function handleOpenChange(next: boolean): void {
		// The plan change is in flight; closing now would hide its outcome.
		if (!next && isBusy) return;
		onOpenChange(next);
	}
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent
		class="max-h-[90vh] overflow-y-auto sm:max-w-md"
		escapeKeydownBehavior={isBusy ? 'ignore' : 'close'}
		interactOutsideBehavior={isBusy ? 'ignore' : 'close'}
		showCloseButton={!isBusy}
	>
		<DialogHeader>
			<DialogTitle>{m['changePlan.title']()}</DialogTitle>
			<DialogDescription>
				{m['changePlan.description']({ org: sub.organization_name })}
			</DialogDescription>
		</DialogHeader>

		<p class="text-sm text-muted-foreground">
			{m['changePlan.currentPlan']({
				plan: sub.plan.name,
				price: formatPlanPrice(sub.plan)
			})}
		</p>

		{#if plansQuery.isPending}
			<div class="flex justify-center py-6" role="status">
				<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
				<span class="sr-only">{m['common.statuses_loading']()}</span>
			</div>
		{:else if loadError}
			<p role="alert" class="text-sm font-medium text-destructive">{loadError}</p>
		{:else if candidates.length === 0}
			<p class="text-sm text-muted-foreground">{m['changePlan.noneAvailable']()}</p>
		{:else}
			<fieldset class="space-y-3" disabled={isBusy}>
				<legend class="sr-only">{m['changePlan.title']()}</legend>

				{#each candidates as plan (plan.id)}
					{@const reason = unavailableReason(plan)}
					<div class="rounded-lg border p-3">
						<label class="flex items-start gap-3">
							<input
								type="radio"
								name="{uid}-plan"
								value={plan.id}
								bind:group={selectedId}
								disabled={!isSelectable(plan)}
								aria-describedby={reason ? `${uid}-help-${plan.id}` : undefined}
								class="mt-1"
							/>
							<span>
								<span class="block text-sm font-medium">{plan.name}</span>
								<span class="block text-xs text-muted-foreground">{formatPlanPrice(plan)}</span>
							</span>
						</label>
						{#if reason}
							<p id="{uid}-help-{plan.id}" class="mt-2 pl-7 text-xs text-muted-foreground">
								<span class="font-medium">{reason.label}</span> — {reason.helper}
							</p>
						{/if}
					</div>
				{/each}
			</fieldset>
		{/if}

		<!--
			Pre-mounted polite live region (WCAG 2.1 AA §4.1.3): the direction
			explainer appears in response to picking a radio, which moves no focus,
			so it would otherwise never be announced. The wrapper therefore lives
			outside every `{#if}` — a region injected together with its first
			message is not observed by assistive tech and stays silent.
		-->
		<div aria-live="polite" class="empty:hidden">
			{#if direction === 'upgrade'}
				<p class="text-sm text-muted-foreground">{m['changePlan.upgradeNote']()}</p>
			{:else if direction === 'downgrade'}
				<p class="text-sm text-muted-foreground">
					{#if sub.current_period_end}
						{m['changePlan.downgradeNoteDated']({ date: formatDate(sub.current_period_end) })}
					{:else}
						{m['changePlan.downgradeNote']()}
					{/if}
				</p>
			{/if}
		</div>

		{#if errorMessage}
			<p role="alert" class="text-sm font-medium text-destructive">{errorMessage}</p>
		{/if}

		<DialogFooter class="gap-2">
			<Button variant="outline" onclick={() => handleOpenChange(false)} disabled={isBusy}>
				{m['changePlan.cancel']()}
			</Button>
			<Button onclick={() => changeMutation.mutate()} disabled={!canConfirm}>
				{#if isBusy}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{m['changePlan.switching']()}
				{:else}
					{m['changePlan.confirmCta']()}
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
