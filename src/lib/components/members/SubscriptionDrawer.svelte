<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminsubscriptionsGetSubscription,
		organizationadminsubscriptionsListSubscriptionPayments,
		organizationadminsubscriptionsRecordPayment,
		organizationadminsubscriptionsCancelSubscription,
		organizationadminsubscriptionsPauseSubscription,
		organizationadminsubscriptionsResumeSubscription,
		organizationadminsubscriptionsRefundPayment,
		organizationadminsubscriptionsUncancelSubscription
	} from '$lib/api/generated/sdk.gen';
	import type {
		SubscriptionSchema,
		MembershipPaymentSchema,
		OrganizationAdminDetailSchema,
		PaymentRecordSchema,
		CancelSubscriptionSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { AlertTriangle, ExternalLink, Loader2 } from '@lucide/svelte';
	import StatusBadge from './StatusBadge.svelte';
	import PaymentsTable from './PaymentsTable.svelte';
	import RecordPaymentModal from './RecordPaymentModal.svelte';
	import CancelSubscriptionDialog from './CancelSubscriptionDialog.svelte';
	import RefundPaymentDialog from './RefundPaymentDialog.svelte';
	import StaffReviveModal from './StaffReviveModal.svelte';
	import {
		getAvailableActions,
		formatPlanPrice,
		getDateLine,
		isSubscriptionActivationPending
	} from '$lib/utils/subscriptions';
	import { backendMessage } from '$lib/utils/api-error-detail';
	import { formatDate } from '$lib/utils/date';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		subId: string;
		open: boolean;
		onClose: () => void;
	}

	const { organization, subId, open, onClose }: Props = $props();
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	const subKey = $derived(['organization', organization.slug, 'subscription', subId]);
	const paymentsKey = $derived([
		'organization',
		organization.slug,
		'subscription',
		subId,
		'payments'
	]);

	const subQuery = createQuery(() => ({
		queryKey: subKey,
		queryFn: async () => {
			const res = await organizationadminsubscriptionsGetSubscription({
				path: { slug: organization.slug, sub_id: subId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error)
				throw new Error(
					backendMessage(res.error) || m['orgAdmin.members.subscriptions.drawer.errors.load']()
				);
			return res.data as SubscriptionSchema;
		},
		enabled: open && !!accessToken
	}));

	const paymentsQuery = createQuery(() => ({
		queryKey: paymentsKey,
		queryFn: async () => {
			const res = await organizationadminsubscriptionsListSubscriptionPayments({
				path: { slug: organization.slug, sub_id: subId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error)
				throw new Error(
					backendMessage(res.error) ||
						m['orgAdmin.members.subscriptions.drawer.errors.loadPayments']()
				);
			return (res.data?.results ?? []) as MembershipPaymentSchema[];
		},
		enabled: open && !!accessToken
	}));

	const sub = $derived(subQuery.data as SubscriptionSchema);
	const payments = $derived(paymentsQuery.data ?? []);
	// `member_status` is a queryset annotation on the admin subscription schemas —
	// the *member row's* status, not this subscription's — and it is what lets the
	// undo button be pre-gated on the 403 the uncancel service would answer. `null`
	// means no member row exists at all, which is not "active": `canUncancel` treats
	// it, like an absent value, as "cannot pre-gate, let the server decide".
	const actions = $derived(sub ? getAvailableActions(sub, sub.member_status) : null);

	// The plan's payment method is the same source the backend refund guard reads
	// (`payment.subscription.plan.payment_method`), so gating on it here keeps the
	// UI and the 400 exactly in step.
	const isOnlinePlan = $derived(!!sub && sub.plan.payment_method === 'online');

	// Stripe stops billing once a subscription is cancelled or expired, so the
	// "payments arrive automatically" reassurance would be misleading there.
	const TERMINAL_STATUSES = ['cancelled', 'expired'];
	const showOnlinePaymentsNote = $derived(
		isOnlinePlan && !!sub && !TERMINAL_STATUSES.includes(sub.status)
	);

	// Pause is the only action `cancel_at_period_end` takes away, and it does so on
	// a row that otherwise looks pausable — so name the remedy (Undo cancellation,
	// rendered in the action row above) instead of leaving a silent gap.
	// Kept on the raw flag rather than on `actions.uncancel`: when the plan has been
	// archived since, the undo button is gone but the block still needs explaining.
	const showPauseBlockedNote = $derived(
		!!sub && sub.status === 'active' && !!sub.cancel_at_period_end
	);

	const isLoading = $derived.by(() => {
		const loading = subQuery.isLoading;
		const data = subQuery.data;
		// Force tracking of paymentsQuery properties on mount to prevent stale signals
		const _payLoading = paymentsQuery.isLoading;
		const _payData = paymentsQuery.data;
		return loading || !data;
	});

	// `pending_plan` is only ever written by the ONLINE scheduled-downgrade path
	// (`subscription_stripe_plan_change.schedule_online_downgrade`); the OFFLINE
	// switch clears it in the same save. So a set `pending_plan_id` is exactly the
	// case where pause/cancel call `release_online_schedule` and drop the switch —
	// and the OFFLINE pause, which drops nothing, never shows the warning.
	const hasPendingSwitch = $derived(!!sub?.pending_plan_id);

	// `stripe_dashboard_url` is built server-side with this precedence
	// (`MembershipSubscription.stripe_dashboard_url`): the Stripe *Subscription*
	// once `stripe_subscription_id` is linked, otherwise the hosted *Checkout
	// Session* that will create it — which is what finally makes a PENDING row
	// inspectable ("the member says they paid but it still shows PENDING"). It stays
	// null for OFFLINE/unlinked rows, so the `{#if}` on the URL keeps the button
	// away rather than rendering a dead anchor. A session page is not a management
	// surface, so mirror the precedence here and label what the link actually opens.
	const stripeLinkIsCheckoutSession = $derived(!!sub && !sub.stripe_subscription_id);

	let recordOpen = $state(false);
	let cancelOpen = $state(false);
	let pauseConfirmOpen = $state(false);
	let reviveOpen = $state(false);
	let refundTarget = $state<MembershipPaymentSchema | null>(null);

	function invalidateAll() {
		queryClient.invalidateQueries({ queryKey: subKey });
		queryClient.invalidateQueries({ queryKey: paymentsKey });
		queryClient.invalidateQueries({
			queryKey: ['organization', organization.slug, 'subscriptions']
		});
		// A subscription save syncs the member row too — the BE signal maps PAUSED
		// onto member paused and CANCELLED/EXPIRED onto member cancelled. Without
		// this the Members tab on the same page keeps the pre-mutation status.
		queryClient.invalidateQueries({
			queryKey: ['organization', organization.slug, 'members']
		});
	}

	const recordMut = createMutation(() => ({
		mutationFn: async (payload: PaymentRecordSchema) => {
			const res = await organizationadminsubscriptionsRecordPayment({
				path: { slug: organization.slug, sub_id: subId },
				body: payload,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error)
				throw new Error(
					backendMessage(res.error) ||
						m['orgAdmin.members.subscriptions.drawer.errors.recordPayment']()
				);
			return res.data as MembershipPaymentSchema;
		},
		onSuccess: () => {
			invalidateAll();
			recordOpen = false;
		},
		onError: (err: Error) => toast.error(err.message)
	}));

	const cancelMut = createMutation(() => ({
		mutationFn: async (payload: CancelSubscriptionSchema) => {
			const res = await organizationadminsubscriptionsCancelSubscription({
				path: { slug: organization.slug, sub_id: subId },
				body: payload,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// 409 (`subscription_activation_pending`), only reachable from the
			// *immediate* path: the backend must expire this row's still-payable hosted
			// Checkout Session before terminalizing it, and the re-read came back
			// `complete` — the member finished paying mid-round-trip. The money moved,
			// the activation webhooks are in flight, and the cancellation was
			// **aborted**. Not a failure, so it must not reach `toast.error`: staff
			// reading a red "couldn't cancel" would go looking for a bug instead of
			// learning that the row is about to go ACTIVE and can be cancelled then.
			// Keyed on the machine-readable `code`; the sibling `detail` is translated.
			if (isSubscriptionActivationPending(res.error)) return null;
			if (res.error)
				throw new Error(
					// 502: Stripe was unreachable and the cancel was aborted, so the row is
					// exactly as it was. The backend's detail ("Payment processing
					// failed…") reads like a charge failed, which is not what happened, so
					// this status gets its own copy that says nothing changed and to retry.
					res.response?.status === 502
						? m['orgAdmin.members.subscriptions.drawer.errors.cancelStripeUnreachable']()
						: backendMessage(res.error) ||
								m['orgAdmin.members.subscriptions.drawer.errors.cancel']()
				);
			return res.data;
		},
		onSuccess: (data) => {
			invalidateAll();
			cancelOpen = false;
			// `null` is the activation-pending answer: the subscription was NOT
			// cancelled. Closing the dialog is still right — a retry can only hit the
			// same 409 until the webhooks land — but staff have to be told why, and
			// told neutrally.
			if (data === null) {
				toast.info(m['orgAdmin.members.subscriptions.drawer.cancelActivationPending']());
			}
		},
		onError: (err: Error) => toast.error(err.message)
	}));

	const pauseMut = createMutation(() => ({
		mutationFn: async () => {
			const res = await organizationadminsubscriptionsPauseSubscription({
				path: { slug: organization.slug, sub_id: subId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error)
				throw new Error(
					backendMessage(res.error) || m['orgAdmin.members.subscriptions.drawer.errors.pause']()
				);
			return res.data;
		},
		onSuccess: () => {
			invalidateAll();
			pauseConfirmOpen = false;
		},
		onError: (err: Error) => toast.error(err.message)
	}));

	const resumeMut = createMutation(() => ({
		mutationFn: async () => {
			const res = await organizationadminsubscriptionsResumeSubscription({
				path: { slug: organization.slug, sub_id: subId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error)
				throw new Error(
					backendMessage(res.error) || m['orgAdmin.members.subscriptions.drawer.errors.resume']()
				);
			return res.data;
		},
		onSuccess: invalidateAll,
		onError: (err: Error) => toast.error(err.message)
	}));

	/**
	 * #808 — clear a scheduled cancellation, which also unblocks Pause on this row.
	 * One click, like Resume: it restores the state the row was in before someone
	 * scheduled the cancellation, and the Cancel dialog next to it is the undo.
	 *
	 * The button *is* gated on the member's suspension, same as the member-facing
	 * card: `SubscriptionSchema.member_status` carries the member row's status
	 * alongside the subscription's own (see `actions` above). That is a pre-gate,
	 * not a guarantee — the member row can be suspended between load and click, and
	 * `member_status` may be absent — so the 403 below is still a live path.
	 */
	const uncancelMut = createMutation(() => ({
		mutationFn: async () => {
			const res = await organizationadminsubscriptionsUncancelSubscription({
				path: { slug: organization.slug, sub_id: subId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// Every refusal is shown verbatim: the 502 says the cancellation is still
			// scheduled on both sides, and the suspended-membership 403 now answers this
			// endpoint with organizer-facing copy of its own ("Restore the member before
			// resuming renewals."), so there is nothing left here to override.
			if (res.error)
				throw new Error(
					backendMessage(res.error) || m['orgAdmin.members.subscriptions.drawer.errors.uncancel']()
				);
			return res.data;
		},
		onSuccess: () => {
			invalidateAll();
			// The button vanishes with the state it was gating; without this the only
			// feedback would be a control silently disappearing.
			toast.success(m['orgAdmin.members.subscriptions.drawer.uncancelDone']());
		},
		onError: (err: Error) => toast.error(err.message)
	}));

	const refundMut = createMutation(() => ({
		mutationFn: async ({ paymentId, notes }: { paymentId: string; notes: string }) => {
			const res = await organizationadminsubscriptionsRefundPayment({
				path: { slug: organization.slug, payment_id: paymentId },
				body: { notes },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error)
				throw new Error(
					backendMessage(res.error) || m['orgAdmin.members.subscriptions.drawer.errors.refund']()
				);
			return res.data;
		},
		onSuccess: () => {
			invalidateAll();
			refundTarget = null;
		},
		onError: (err: Error) => toast.error(err.message)
	}));

	function fmtDate(d: string | null | undefined): string {
		return d ? formatDate(d) : '—';
	}
</script>

<Dialog {open} onOpenChange={(v: boolean) => (!v ? onClose() : null)}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
		{#if isLoading}
			<Loader2 class="h-5 w-5 animate-spin" />
		{:else}
			<DialogHeader>
				<DialogTitle>
					<!-- `min-w-0` + `break-all` on the identity column: a flex item's
					     automatic minimum size is its CONTENT size, so without them a long
					     unbroken email (no spaces to wrap at) refuses to shrink, pushes the
					     status badge out of the dialog and makes the whole drawer scroll
					     sideways on a phone. `shrink-0` keeps the badge legible instead of
					     being squeezed to a sliver once the email does yield. -->
					<div class="flex items-start justify-between gap-4">
						<div class="min-w-0">
							<div class="text-base font-bold">{sub.user_display_name}</div>
							<div class="break-all text-xs text-muted-foreground">{sub.user_email}</div>
						</div>
						<StatusBadge status={sub.status} class="shrink-0" />
					</div>
				</DialogTitle>
			</DialogHeader>

			<div class="space-y-1 text-sm">
				<div>
					<span class="font-medium">{sub.plan.name}</span>
					<span class="text-muted-foreground"> · {formatPlanPrice(sub.plan)}</span>
				</div>
				{#each [getDateLine(sub)] as line (line.kind)}
					<div class="text-xs text-muted-foreground">
						{#if line.kind === 'renewal'}
							{m['subscriptions.dateLine.renewal']({ date: fmtDate(line.date) })}
						{:else if line.kind === 'cancels'}
							{m['subscriptions.dateLine.cancels']({ date: fmtDate(line.date) })}
						{:else if line.kind === 'period_ends'}
							{m['subscriptions.dateLine.periodEnds']({ date: fmtDate(line.date) })}
						{:else if line.kind === 'paused_since'}
							{m['subscriptions.dateLine.pausedSince']({ date: fmtDate(line.date) })}
						{:else if line.kind === 'ended'}
							{m['subscriptions.dateLine.ended']({ date: fmtDate(line.date) })}
						{:else if line.kind === 'pending'}
							{m['subscriptions.dateLine.pending']()}
						{/if}
					</div>
				{/each}
			</div>

			<div class="flex flex-wrap gap-2">
				{#if actions?.recordPayment}
					<Button size="sm" onclick={() => (recordOpen = true)}>
						{m['orgAdmin.members.subscriptions.drawer.recordPayment']()}
					</Button>
				{/if}
				<!-- Sits where Pause would be: on a row scheduled to cancel these two are
				     mutually exclusive, and this is the button that brings Pause back. -->
				{#if actions?.uncancel}
					<Button
						size="sm"
						onclick={() => uncancelMut.mutate()}
						disabled={uncancelMut.isPending}
						aria-busy={uncancelMut.isPending}
					>
						{#if uncancelMut.isPending}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
							{m['orgAdmin.members.subscriptions.drawer.uncancelling']()}
						{:else}
							{m['orgAdmin.members.subscriptions.drawer.uncancel']()}
						{/if}
					</Button>
				{/if}
				{#if actions?.pause}
					<Button
						size="sm"
						variant="outline"
						onclick={() => (pauseConfirmOpen = true)}
						disabled={pauseMut.isPending}
					>
						{m['orgAdmin.members.subscriptions.drawer.pause']()}
					</Button>
				{/if}
				{#if actions?.resume}
					<Button
						size="sm"
						variant="outline"
						onclick={() => resumeMut.mutate()}
						disabled={resumeMut.isPending}
					>
						{m['orgAdmin.members.subscriptions.drawer.resume']()}
					</Button>
				{/if}
				{#if actions?.cancel}
					<Button size="sm" variant="outline" onclick={() => (cancelOpen = true)}>
						{m['orgAdmin.members.subscriptions.drawer.cancel']()}
					</Button>
				{/if}
				{#if actions?.revive}
					<Button size="sm" variant="outline" onclick={() => (reviveOpen = true)}>
						{m['orgAdmin.members.subscriptions.drawer.revive']()}
					</Button>
				{/if}
				{#if sub.stripe_dashboard_url}
					<Button
						href={sub.stripe_dashboard_url}
						target="_blank"
						rel="noopener noreferrer"
						size="sm"
						variant="outline"
					>
						<ExternalLink class="h-4 w-4" aria-hidden="true" />
						{stripeLinkIsCheckoutSession
							? m['orgAdmin.members.subscriptions.drawer.checkoutOnStripe']()
							: m['orgAdmin.members.subscriptions.drawer.manageOnStripe']()}
					</Button>
				{/if}
			</div>

			{#if showPauseBlockedNote}
				<p class="text-xs text-muted-foreground">
					{m['orgAdmin.members.subscriptions.drawer.pauseBlockedByCancel']()}
				</p>
			{/if}

			{#if showOnlinePaymentsNote}
				<p class="text-xs text-muted-foreground">
					{m['orgAdmin.members.subscriptions.drawer.onlinePayments']()}
				</p>
			{/if}

			<div class="pt-2">
				<h4 class="mb-2 text-sm font-bold">
					{m['orgAdmin.members.subscriptions.drawer.payments']()}
				</h4>
				{#if paymentsQuery.isLoading}
					<Loader2 class="h-4 w-4 animate-spin" />
				{:else}
					<PaymentsTable {payments} {isOnlinePlan} onRefund={(p) => (refundTarget = p)} />
				{/if}
			</div>

			<RecordPaymentModal
				subscription={sub}
				open={recordOpen}
				onClose={() => (recordOpen = false)}
				onSubmit={(p) => recordMut.mutate(p)}
				isSubmitting={recordMut.isPending}
			/>
			<StaffReviveModal
				{sub}
				{subId}
				{organization}
				open={reviveOpen}
				onClose={() => (reviveOpen = false)}
				onSuccess={invalidateAll}
			/>
			<!-- Pause is destructive in effect, not in name: it stops billing AND drops
			     the member out of members-only events and tiers until a resume. Resume
			     stays one-click — it only restores access. -->
			<Dialog
				open={pauseConfirmOpen}
				onOpenChange={(v: boolean) => {
					if (!v && !pauseMut.isPending) pauseConfirmOpen = false;
				}}
			>
				<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{m['orgAdmin.members.subscriptions.drawer.pauseConfirmTitle']()}
						</DialogTitle>
					</DialogHeader>
					<div class="flex gap-3 text-sm text-muted-foreground">
						<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
						<div class="space-y-1">
							<p>{m['orgAdmin.members.subscriptions.drawer.pauseConfirmBody']()}</p>
							{#if hasPendingSwitch}
								<p>{m['orgAdmin.members.subscriptions.drawer.pauseConfirmPendingSwitch']()}</p>
							{/if}
						</div>
					</div>
					<div class="flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							onclick={() => (pauseConfirmOpen = false)}
							disabled={pauseMut.isPending}
						>
							{m['orgAdmin.members.subscriptions.drawer.pauseConfirmDismiss']()}
						</Button>
						<Button type="button" onclick={() => pauseMut.mutate()} disabled={pauseMut.isPending}>
							{#if pauseMut.isPending}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
							{m['orgAdmin.members.subscriptions.drawer.pauseConfirmCta']()}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
			<CancelSubscriptionDialog
				subscription={sub}
				open={cancelOpen}
				onClose={() => (cancelOpen = false)}
				onSubmit={(p) => cancelMut.mutate(p)}
				isSubmitting={cancelMut.isPending}
			/>
			<RefundPaymentDialog
				payment={refundTarget}
				open={!!refundTarget}
				onClose={() => (refundTarget = null)}
				onSubmit={(p) => {
					if (refundTarget?.id) {
						refundMut.mutate({ paymentId: refundTarget.id, notes: p.notes ?? '' });
					}
				}}
				isSubmitting={refundMut.isPending}
			/>
		{/if}
	</DialogContent>
</Dialog>
