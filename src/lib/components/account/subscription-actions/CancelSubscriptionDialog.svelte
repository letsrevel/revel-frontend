<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		mesubscriptionsCancelSubscription,
		organizationGetOrganization,
		organizationListMembershipPlans
	} from '$lib/api/generated/sdk.gen';
	import type { MySubscriptionSchema } from '$lib/api/generated/types.gen';
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
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import { formatDate } from '$lib/utils/date';
	import {
		settleSubscriptionCaches,
		MY_MEMBERSHIPS_KEY,
		MY_SUBSCRIPTIONS_KEY,
		myOrgSubscriptionKey
	} from '$lib/utils/subscription-cache';
	import { backendMessage } from '$lib/utils/api-error-detail';
	import { isSubscriptionActivationPending } from '$lib/utils/subscriptions';
	import { Info, Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		sub: MySubscriptionSchema;
	}
	const { open, onOpenChange, sub }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();
	const uid = $props.id();

	let mode = $state<'period_end' | 'immediate'>('period_end');
	let immediateConfirmed = $state(false);
	let errorMessage = $state<string | null>(null);

	/**
	 * The 409 (`subscription_activation_pending`), reachable only from the
	 * *immediate* path: the backend has to expire the still-payable hosted
	 * Checkout Session before it may terminalize a PENDING ONLINE row, and when
	 * the re-read comes back `complete` the member finished paying mid-round-trip
	 * (`_expire_open_checkout_before_terminalizing`). Money moved and the
	 * activation webhooks are in flight, so the backend **aborts the cancel** —
	 * the membership is on its way to ACTIVE, not gone.
	 *
	 * That makes this neither a failure nor a success, and it must never render as
	 * either: red copy tells someone who was just charged that something broke,
	 * and the success toast tells them they are cancelled while Stripe is about to
	 * bill them. It gets its own non-destructive state instead.
	 */
	let activationPending = $state(false);
	/** The backend's translated explanation for that 409, when it sent one. */
	let activationDetail = $state<string | null>(null);

	// Refund policy is org-level and public; fetch it only while the dialog is
	// actually open so closed cards cost nothing.
	const orgQuery = createQuery(() => ({
		queryKey: ['org', sub.organization_slug, 'public-detail'],
		queryFn: async () => {
			const res = await organizationGetOrganization({ path: { slug: sub.organization_slug } });
			if (res.error || !res.data) throw new Error('Failed to load organization');
			return res.data;
		},
		enabled: open
	}));
	const refundPolicy = $derived(orgQuery.data?.membership_refund_policy?.trim() || null);

	// Cancelling releases the Stripe schedule first (BE `release_online_schedule`,
	// called from both the immediate and the period-end cancel path), which drops
	// the queued downgrade. Naming the abandoned plan needs the org catalogue —
	// the same public list, under the same cache key, that MembershipCard and
	// ChangePlanDialog already read, so this costs nothing beyond a cache hit.
	const plansQuery = createQuery(() => ({
		queryKey: ['org', sub.organization_slug, 'membership-plans'],
		queryFn: async () => {
			const res = await organizationListMembershipPlans({ path: { slug: sub.organization_slug } });
			// The endpoint returns a bare array (no pagination envelope).
			if (res.error || !res.data) throw new Error(m['changePlan.loadError']());
			return res.data;
		},
		enabled: open && !!sub.pending_plan_id
	}));

	/** Warning about the queued plan change this cancellation will discard. */
	const pendingSwitchDropped = $derived.by(() => {
		const pendingPlanId = sub.pending_plan_id;
		if (!pendingPlanId) return null;
		const name =
			(plansQuery.data ?? []).find((p) => p.id === pendingPlanId)?.name ??
			m['orgPublic.yourMembership.pendingSwitchFallbackPlan']();
		return m['cancelSub.pendingSwitchDropped']({ plan: name });
	});

	/**
	 * Re-read the member-facing subscription queries from the server.
	 *
	 * Used on the 409 only, where there is deliberately **no** `settleSubscriptionCaches`:
	 * that helper's whole contract is "the mutation's own response body is the last
	 * writer", and this refusal carries no subscription body at all — the row it
	 * describes is being rewritten by Stripe's activation webhooks right now, so the
	 * server is the only honest source. A plain invalidation both refetches the
	 * mounted queries (so the account card stops showing the pre-cancel snapshot)
	 * and marks them stale, so a remount a few seconds later — once the webhook has
	 * landed — picks up the ACTIVE row too.
	 *
	 * Never rejects: a failed refetch is already visible in each query's own error
	 * state, and the dialog has nothing better to say about it.
	 */
	async function refreshMemberSubscriptionCaches(): Promise<void> {
		try {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: MY_MEMBERSHIPS_KEY }),
				queryClient.invalidateQueries({ queryKey: MY_SUBSCRIPTIONS_KEY }),
				// Prefix match, as in `settleSubscriptionCaches`: it also clears the
				// checkout-return caches nested under this key.
				queryClient.invalidateQueries({ queryKey: myOrgSubscriptionKey(sub.organization_id) })
			]);
		} catch {
			// Already reflected in each query's own error state.
		}
	}

	const cancelMutation = createMutation(() => ({
		mutationFn: async () => {
			errorMessage = null;
			const res = await mesubscriptionsCancelSubscription({
				path: { org_id: sub.organization_id },
				body: { immediate: mode === 'immediate' },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// Paid already, webhook still in flight, cancellation NOT performed. Keyed
			// on the backend's machine-readable `code` — the sibling `detail` is
			// translated, so matching on it would work only in English. Checked before
			// the failure branch below, because this is not a failure.
			if (isSubscriptionActivationPending(res.error)) {
				errorMessage = null;
				activationDetail = backendMessage(res.error);
				activationPending = true;
				return null;
			}
			// hey-api resolves rather than throws — a missing payload is a failure
			// even when no error body came back.
			if (res.error || !res.data) {
				// 502: Stripe was unreachable and the cancel was aborted, so nothing
				// changed and retrying is the whole remedy. The backend's own detail
				// ("Payment processing failed…") reads like the charge failed, which is
				// the opposite of what happened, so it is replaced rather than passed
				// through — and kept distinct from the generic fallback, which offers no
				// such promise that the membership is untouched.
				if (res.response?.status === 502) {
					throw new Error(m['cancelSub.stripeUnreachable']());
				}
				throw new Error(backendMessage(res.error) || m['cancelSub.error']());
			}
			return res.data;
		},
		onSuccess: (data) => {
			// `null` is the activation-pending answer: nothing was cancelled, so there
			// is no truthful body to seed and no success to announce.
			if (!data) {
				void refreshMemberSubscriptionCaches();
				return;
			}
			// The 200 body is the truthful post-cancel subscription; seeding it into
			// the member-facing caches (and re-asserting it after the refetch) is what
			// stops Stripe's schedule-release write-back from racing this mutation and
			// leaving the card on "Next renewal" — see subscription-cache.ts (#693).
			// Deliberately not awaited: the dialog has nothing left to say about the
			// refetch, and holding the mutation open would only prolong the spinner.
			void settleSubscriptionCaches(queryClient, data);
			if (mode === 'immediate') {
				toast.success(m['cancelSub.successImmediate']());
			} else if (data.current_period_end) {
				toast.success(
					m['cancelSub.successPeriodEnd']({ date: formatDate(data.current_period_end) })
				);
			} else {
				toast.success(m['cancelSub.successPeriodEndNoDate']());
			}
			onOpenChange(false);
		},
		onError: (err: Error) => {
			errorMessage = err.message || m['cancelSub.error']();
		}
	}));

	const isBusy = $derived(cancelMutation.isPending);
	// Every operand is read unconditionally: a short-circuiting expression would
	// leave the skipped one untracked once the guard flips.
	const canConfirm = $derived.by(() => {
		const busy = isBusy;
		const needsCheck = mode === 'immediate';
		const checked = immediateConfirmed;
		return !busy && (!needsCheck || checked);
	});

	// Fresh choices every time the dialog opens; leave content intact during the
	// close animation (reset-on-open, not on close). These are user-editable
	// choices, so they cannot be `$derived`; and the parent owns `open`, so it
	// can flip it without ever calling `handleOpenChange` — an effect on `open`
	// is the only place that catches every opening.
	$effect(() => {
		if (!open) return;
		mode = 'period_end';
		immediateConfirmed = false;
		errorMessage = null;
		activationPending = false;
		activationDetail = null;
	});

	function handleOpenChange(next: boolean): void {
		// The cancellation is in flight; closing now would hide its outcome.
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
			<DialogTitle>{m['cancelSub.title']()}</DialogTitle>
			<DialogDescription>
				{m['cancelSub.description']({ plan: sub.plan.name, org: sub.organization_name })}
			</DialogDescription>
		</DialogHeader>

		{#if activationPending}
			<!-- Deliberately NOT `text-destructive` and deliberately not a `role="alert"`:
			     nothing failed and nothing is broken. The member paid, the membership
			     stands, and the only thing they have to do is wait — so this reads as a
			     status, in the same neutral surface the dialog uses for its other
			     informational blocks. -->
			<div class="flex gap-3 rounded-lg border bg-muted/40 p-3" role="status" aria-live="polite">
				<Info class="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
				<div class="space-y-1 text-sm">
					<p class="font-medium">{m['cancelSub.activationPending']()}</p>
					<!-- The backend's own sentence ("Your payment went through. We're still
					     confirming your subscription…"), already translated server-side. -->
					{#if activationDetail}
						<p class="text-muted-foreground">{activationDetail}</p>
					{/if}
				</div>
			</div>
		{:else}
			<fieldset class="space-y-3" disabled={isBusy}>
				<legend class="sr-only">{m['cancelSub.title']()}</legend>

				<label class="flex items-start gap-3 rounded-lg border p-3">
					<input type="radio" name="{uid}-mode" value="period_end" bind:group={mode} class="mt-1" />
					<span>
						<span class="block text-sm font-medium">{m['cancelSub.periodEnd']()}</span>
						<span class="block text-xs text-muted-foreground">
							{#if sub.current_period_end}
								{m['cancelSub.periodEndHintDated']({ date: formatDate(sub.current_period_end) })}
							{:else}
								{m['cancelSub.periodEndHint']()}
							{/if}
							<!-- A voluntary period-end cancel terminalizes as CANCELLED with
							     `expired_at` left unset, and revival only accepts EXPIRED rows —
							     so the rejoin window never opens for this choice. -->
							{m['cancelSub.rejoinAfterEnd']()}
						</span>
					</span>
				</label>

				<label class="flex items-start gap-3 rounded-lg border p-3">
					<input type="radio" name="{uid}-mode" value="immediate" bind:group={mode} class="mt-1" />
					<span>
						<span class="block text-sm font-medium">{m['cancelSub.immediate']()}</span>
						<span class="block text-xs text-muted-foreground">
							{m['cancelSub.immediateHint']()}
							<!-- Only point at the policy when there is one to read: the org may
							     not have authored it, and the <details> below renders on the
							     same condition. -->
							{#if refundPolicy}
								{m['cancelSub.refundPolicyPointer']()}
							{/if}
						</span>
					</span>
				</label>

				{#if mode === 'immediate'}
					<div class="flex items-center gap-2 pl-1">
						<Checkbox
							id="{uid}-immediate-confirm"
							checked={immediateConfirmed}
							onCheckedChange={(checked) => {
								immediateConfirmed = checked === true;
							}}
						/>
						<Label for="{uid}-immediate-confirm" class="cursor-pointer text-sm">
							{m['cancelSub.immediateConfirm']()}
						</Label>
					</div>
				{/if}
			</fieldset>

			<!-- Outside the fieldset: the queued switch is released by BOTH cancellation
			     modes, so it is a consequence of cancelling, not of one radio option. -->
			{#if pendingSwitchDropped}
				<p class="text-sm text-muted-foreground">{pendingSwitchDropped}</p>
			{/if}

			{#if refundPolicy}
				<details class="rounded-lg border p-3">
					<summary
						class="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						{m['cancelSub.refundPolicy']()}
					</summary>
					<MarkdownContent content={refundPolicy} class="mt-2 text-sm" />
				</details>
			{/if}

			{#if errorMessage}
				<p role="alert" class="text-sm font-medium text-destructive">{errorMessage}</p>
			{/if}
		{/if}

		<DialogFooter class="gap-2">
			{#if activationPending}
				<!-- No retry: until the activation webhooks land, a second immediate
				     cancel can only hit the same 409. Dismissing is the only useful
				     action left, and the membership card behind the dialog is where the
				     activated row will show up. -->
				<Button variant="outline" onclick={() => handleOpenChange(false)}>
					{m['common.close']()}
				</Button>
			{:else}
				<Button variant="outline" onclick={() => handleOpenChange(false)} disabled={isBusy}>
					{m['cancelSub.keepCta']()}
				</Button>
				<Button
					variant="destructive"
					onclick={() => cancelMutation.mutate()}
					disabled={!canConfirm}
				>
					{#if isBusy}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{m['cancelSub.cancelling']()}
					{:else}
						{m['cancelSub.confirmCta']()}
					{/if}
				</Button>
			{/if}
		</DialogFooter>
	</DialogContent>
</Dialog>
