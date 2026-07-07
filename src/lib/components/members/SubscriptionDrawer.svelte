<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminsubscriptionsGetSubscription,
		organizationadminsubscriptionsListSubscriptionPayments,
		organizationadminsubscriptionsRecordPayment,
		organizationadminsubscriptionsCancelSubscription,
		organizationadminsubscriptionsPauseSubscription,
		organizationadminsubscriptionsResumeSubscription,
		organizationadminsubscriptionsRefundPayment
	} from '$lib/api/generated/sdk.gen';
	import type {
		SubscriptionSchema,
		PaymentSchema2,
		OrganizationAdminDetailSchema,
		PaymentRecordSchema,
		CancelSubscriptionSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Loader2 } from '@lucide/svelte';
	import StatusBadge from './StatusBadge.svelte';
	import PaymentsTable from './PaymentsTable.svelte';
	import RecordPaymentModal from './RecordPaymentModal.svelte';
	import CancelSubscriptionDialog from './CancelSubscriptionDialog.svelte';
	import RefundPaymentDialog from './RefundPaymentDialog.svelte';
	import { getAvailableActions, formatPlanPrice, getDateLine } from '$lib/utils/subscriptions';
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
			if (res.error) throw new Error('Failed to load subscription');
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
			if (res.error) throw new Error('Failed to load payments');
			return (res.data?.results ?? []) as PaymentSchema2[];
		},
		enabled: open && !!accessToken
	}));

	const sub = $derived(subQuery.data);
	const payments = $derived(paymentsQuery.data ?? []);
	const actions = $derived(sub ? getAvailableActions(sub) : null);

	let recordOpen = $state(false);
	let cancelOpen = $state(false);
	let refundTarget = $state<PaymentSchema2 | null>(null);

	function invalidateAll() {
		queryClient.invalidateQueries({ queryKey: subKey });
		queryClient.invalidateQueries({ queryKey: paymentsKey });
		queryClient.invalidateQueries({
			queryKey: ['organization', organization.slug, 'subscriptions']
		});
	}

	const recordMut = createMutation(() => ({
		mutationFn: async (payload: PaymentRecordSchema) => {
			const res = await organizationadminsubscriptionsRecordPayment({
				path: { slug: organization.slug, sub_id: subId },
				body: payload,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to record payment');
			return res.data as PaymentSchema2;
		},
		onSuccess: () => {
			invalidateAll();
			recordOpen = false;
		},
		onError: (err: Error) => alert(`Failed to record payment: ${err.message}`)
	}));

	const cancelMut = createMutation(() => ({
		mutationFn: async (payload: CancelSubscriptionSchema) => {
			const res = await organizationadminsubscriptionsCancelSubscription({
				path: { slug: organization.slug, sub_id: subId },
				body: payload,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to cancel');
			return res.data;
		},
		onSuccess: () => {
			invalidateAll();
			cancelOpen = false;
		},
		onError: (err: Error) => alert(`Failed to cancel: ${err.message}`)
	}));

	const pauseMut = createMutation(() => ({
		mutationFn: async () => {
			const res = await organizationadminsubscriptionsPauseSubscription({
				path: { slug: organization.slug, sub_id: subId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to pause');
			return res.data;
		},
		onSuccess: invalidateAll,
		onError: (err: Error) => alert(`Failed to pause: ${err.message}`)
	}));

	const resumeMut = createMutation(() => ({
		mutationFn: async () => {
			const res = await organizationadminsubscriptionsResumeSubscription({
				path: { slug: organization.slug, sub_id: subId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to resume');
			return res.data;
		},
		onSuccess: invalidateAll,
		onError: (err: Error) => alert(`Failed to resume: ${err.message}`)
	}));

	const refundMut = createMutation(() => ({
		mutationFn: async ({ paymentId, notes }: { paymentId: string; notes: string }) => {
			const res = await organizationadminsubscriptionsRefundPayment({
				path: { slug: organization.slug, payment_id: paymentId },
				body: { notes },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to refund');
			return res.data;
		},
		onSuccess: () => {
			invalidateAll();
			refundTarget = null;
		},
		onError: (err: Error) => alert(`Failed to refund: ${err.message}`)
	}));

	function fmtDate(d: string | null | undefined): string {
		return d ? formatDate(d) : '—';
	}
</script>

<Dialog {open} onOpenChange={(v: boolean) => (!v ? onClose() : null)}>
	<DialogContent class="sm:max-w-3xl">
		{#if subQuery.isLoading || !sub}
			<Loader2 class="h-5 w-5 animate-spin" />
		{:else}
			<DialogHeader>
				<DialogTitle>
					<div class="flex items-start justify-between gap-4">
						<div>
							<div class="text-base font-semibold">{sub.user_display_name}</div>
							<div class="text-xs text-muted-foreground">{sub.user_email}</div>
						</div>
						<StatusBadge status={sub.status} />
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
				{#if actions?.pause}
					<Button
						size="sm"
						variant="outline"
						onclick={() => pauseMut.mutate()}
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
			</div>

			<div class="pt-2">
				<h4 class="mb-2 text-sm font-semibold">
					{m['orgAdmin.members.subscriptions.drawer.payments']()}
				</h4>
				{#if paymentsQuery.isLoading}
					<Loader2 class="h-4 w-4 animate-spin" />
				{:else}
					<PaymentsTable {payments} onRefund={(p) => (refundTarget = p)} />
				{/if}
			</div>

			<RecordPaymentModal
				subscription={sub}
				open={recordOpen}
				onClose={() => (recordOpen = false)}
				onSubmit={(p) => recordMut.mutate(p)}
				isSubmitting={recordMut.isPending}
			/>
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
