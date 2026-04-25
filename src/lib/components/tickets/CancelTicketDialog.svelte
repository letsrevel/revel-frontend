<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		eventpublicticketsCancellationPreview,
		eventpublicticketsCancelMyTicket
	} from '$lib/api/generated/sdk.gen';
	import type {
		CancellationBlockReason,
		CancellationPreviewSchema,
		PaymentMethod,
		RefundWindowSchema,
		TicketCancellationResponseSchema
	} from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { authStore } from '$lib/stores/auth.svelte';
	import { formatPrice } from '$lib/utils/format';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { Loader2, AlertTriangle, X, CheckCircle2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		open: boolean;
		ticketId: string;
		/** Called once cancellation succeeds. Parent should refresh ticket lists. */
		onCancelled?: (response: TicketCancellationResponseSchema) => void;
	}

	let { open = $bindable(), ticketId, onCancelled }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	let reason = $state('');

	// Reset state every time the dialog opens
	$effect(() => {
		if (open) {
			reason = '';
		}
	});

	const previewQuery = createQuery<CancellationPreviewSchema>(() => ({
		queryKey: ['ticket-cancellation-preview', ticketId],
		queryFn: async () => {
			const response = await eventpublicticketsCancellationPreview({
				path: { ticket_id: ticketId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error || !response.data) {
				throw new Error(extractErrorMessage(response.error) || 'preview-failed');
			}
			return response.data;
		},
		enabled: open && !!accessToken && !!ticketId,
		// Always refetch when reopening — refund window may have shifted
		staleTime: 0,
		retry: false
	}));

	const cancelMutation = createMutation(() => ({
		mutationFn: async () => {
			const trimmed = reason.trim();
			const response = await eventpublicticketsCancelMyTicket({
				path: { ticket_id: ticketId },
				headers: { Authorization: `Bearer ${accessToken}` },
				body: trimmed ? { reason: trimmed } : null
			});
			if (response.error) {
				const errorAny = response.error as { code?: CancellationBlockReason; detail?: string };
				// 409: stable block reason → re-render the dialog with the localized copy.
				if (errorAny?.code) {
					throw new Error(`code:${errorAny.code}`);
				}
				// 502: Stripe refund couldn't be issued. Detect by HTTP status, not prose,
				// so the toast is right even if the backend message changes/localizes.
				if (response.response?.status === 502) {
					throw new Error('stripe-502');
				}
				throw new Error(extractErrorMessage(response.error) || 'cancel-failed');
			}
			if (!response.data) throw new Error('cancel-failed');
			return response.data;
		},
		onSuccess: (data) => {
			const refundAmt = parseFloat(data.refund_amount || '0');
			const formattedRefund = formatPrice(data.refund_amount, data.currency, '');
			let message = m['cancelTicket.successNoRefund']();
			if (refundAmt > 0 && formattedRefund) {
				message =
					data.refund_status === 'pending'
						? m['cancelTicket.successPendingRefund']({ amount: formattedRefund })
						: m['cancelTicket.successWithRefund']({ amount: formattedRefund });
			}
			toast.success(m['cancelTicket.successTitle'](), { description: message, duration: 6000 });
			queryClient.invalidateQueries({ queryKey: ['dashboard-tickets'] });
			queryClient.invalidateQueries({ queryKey: ['ticket-cancellation-preview', ticketId] });
			open = false;
			onCancelled?.(data);
		},
		onError: (err: Error) => {
			const msg = err.message || '';
			if (msg === 'stripe-502') {
				toast.error(m['cancelTicket.errorStripe'](), { duration: 6000 });
				return;
			}
			// Mapped block reason → render in dialog instead of toast.
			if (msg.startsWith('code:')) {
				return;
			}
			toast.error(m['cancelTicket.errorGeneric'](), {
				description: extractErrorMessage(err) || undefined,
				duration: 6000
			});
		}
	}));

	const preview = $derived(previewQuery.data);
	const isLoadingPreview = $derived(previewQuery.isLoading || previewQuery.isFetching);

	// If cancel mutation returned a 409 with stable code, surface it.
	const blockedCode = $derived.by<CancellationBlockReason | null>(() => {
		if (preview && !preview.can_cancel && preview.reason) return preview.reason;
		const err = cancelMutation.error;
		if (err && err.message.startsWith('code:')) {
			return err.message.slice(5) as CancellationBlockReason;
		}
		return null;
	});

	const refundAmountNum = $derived.by(() => {
		if (!preview?.refund_amount) return 0;
		return parseFloat(preview.refund_amount);
	});

	const flatFeeNum = $derived.by(() => {
		if (!preview?.flat_fee) return 0;
		return parseFloat(preview.flat_fee);
	});

	function formatDeadline(iso: string | null | undefined): string {
		if (!iso) return m['cancelTicket.deadlineNoDeadline']();
		const date = new Date(iso);
		return date.toLocaleString(getLocale(), {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function paymentMethodNote(method: PaymentMethod | undefined): string | null {
		if (!method) return null;
		switch (method) {
			case 'online':
				return m['cancelTicket.paymentMethodOnline']();
			case 'offline':
				return m['cancelTicket.paymentMethodOffline']();
			case 'at_the_door':
				return m['cancelTicket.paymentMethodAtTheDoor']();
			case 'free':
				return m['cancelTicket.paymentMethodFree']();
			default:
				return null;
		}
	}

	function reasonLabel(code: CancellationBlockReason): string {
		const map = {
			already_cancelled: m['cancelTicket.reason.already_cancelled'](),
			checked_in: m['cancelTicket.reason.checked_in'](),
			event_started: m['cancelTicket.reason.event_started'](),
			not_permitted: m['cancelTicket.reason.not_permitted'](),
			past_deadline: m['cancelTicket.reason.past_deadline'](),
			not_owner: m['cancelTicket.reason.not_owner']()
		} as const;
		return map[code];
	}

	// Future windows: those with effective_until > now (the "current" window
	// is implicit in preview.refund_amount + preview.deadline, so we list
	// remaining windows so users see what they'll lose by waiting).
	const upcomingWindows = $derived.by((): RefundWindowSchema[] => {
		if (!preview?.windows || preview.windows.length === 0) return [];
		const now = new Date().getTime();
		return preview.windows.filter((w) => new Date(w.effective_until).getTime() > now);
	});

	function handleClose(): void {
		if (cancelMutation.isPending) return;
		open = false;
	}
</script>

<Dialog bind:open>
	<DialogContent
		class="max-h-[90vh] max-w-md overflow-y-auto"
		escapeKeydownBehavior={cancelMutation.isPending ? 'ignore' : 'close'}
		interactOutsideBehavior={cancelMutation.isPending ? 'ignore' : 'close'}
	>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<X class="h-5 w-5 text-destructive" aria-hidden="true" />
				{m['cancelTicket.dialogTitle']()}
			</DialogTitle>
			<DialogDescription>{m['cancelTicket.dialogDescription']()}</DialogDescription>
		</DialogHeader>

		{#if isLoadingPreview && !preview}
			<div class="flex items-center justify-center gap-3 py-8 text-sm text-muted-foreground">
				<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
				{m['cancelTicket.loadingPreview']()}
			</div>
		{:else if previewQuery.isError && !preview}
			<Alert variant="destructive">
				<AlertTriangle class="h-4 w-4" aria-hidden="true" />
				<AlertDescription>{m['cancelTicket.loadingError']()}</AlertDescription>
			</Alert>
			<DialogFooter>
				<Button variant="outline" onclick={handleClose}>{m['cancelTicket.close']()}</Button>
				<Button onclick={() => previewQuery.refetch()}>{m['cancelTicket.retry']()}</Button>
			</DialogFooter>
		{:else if blockedCode}
			<Alert variant="destructive">
				<AlertTriangle class="h-4 w-4" aria-hidden="true" />
				<AlertTitle>{m['cancelTicket.blockedTitle']()}</AlertTitle>
				<AlertDescription>{reasonLabel(blockedCode)}</AlertDescription>
			</Alert>
			<DialogFooter>
				<Button variant="outline" onclick={handleClose}>{m['cancelTicket.close']()}</Button>
			</DialogFooter>
		{:else if preview}
			<div class="space-y-4">
				<!-- Refund summary card -->
				<div class="rounded-lg border border-border bg-muted/30 p-4" data-testid="refund-summary">
					<div class="text-xs uppercase tracking-wide text-muted-foreground">
						{m['cancelTicket.refundLabel']()}
					</div>
					<div class="mt-1 flex items-baseline gap-2">
						{#if refundAmountNum > 0}
							<span class="text-3xl font-bold text-foreground">
								{formatPrice(preview.refund_amount, preview.currency, '')}
							</span>
						{:else if preview.payment_method === 'free'}
							<span class="text-base text-muted-foreground">
								{m['cancelTicket.refundFreeTicket']()}
							</span>
						{:else}
							<span class="text-3xl font-bold text-foreground">
								{m['cancelTicket.refundNoRefundShort']()}
							</span>
						{/if}
					</div>

					{#if flatFeeNum > 0 && refundAmountNum > 0}
						<p class="mt-2 text-xs text-muted-foreground">
							{m['cancelTicket.refundFlatFeeNote']({
								fee: formatPrice(preview.flat_fee, preview.currency, '')
							})}
						</p>
					{/if}

					{#if preview.deadline}
						<p class="mt-3 text-xs text-muted-foreground">
							<span class="font-medium">{m['cancelTicket.deadlineLabel']()}:</span>
							{formatDeadline(preview.deadline)}
						</p>
					{/if}

					{#if paymentMethodNote(preview.payment_method)}
						<p class="mt-3 text-xs text-muted-foreground">
							{paymentMethodNote(preview.payment_method)}
						</p>
					{/if}
				</div>

				<!-- Upcoming refund windows -->
				{#if upcomingWindows.length > 0}
					<details class="rounded-md border border-border bg-background p-3 text-sm">
						<summary class="cursor-pointer font-medium">
							{m['cancelTicket.refundScheduleTitle']()}
						</summary>
						<p class="mt-2 text-xs text-muted-foreground">
							{m['cancelTicket.refundScheduleHint']()}
						</p>
						<ul class="mt-2 space-y-1 text-xs">
							{#each upcomingWindows as win (win.effective_until)}
								<li class="flex items-baseline justify-between gap-2 text-muted-foreground">
									<span>
										{m['cancelTicket.refundScheduleRow']({
											pct: win.refund_percentage,
											deadline: formatDeadline(win.effective_until)
										})}
									</span>
									<span class="tabular-nums">
										{m['cancelTicket.refundScheduleAmount']({
											amount: formatPrice(win.refund_amount, preview.currency, '')
										})}
									</span>
								</li>
							{/each}
						</ul>
					</details>
				{/if}

				<!-- Reason textarea -->
				<div>
					<Label for="cancel-reason">{m['cancelTicket.reasonLabel']()}</Label>
					<Textarea
						id="cancel-reason"
						bind:value={reason}
						maxlength={500}
						rows={3}
						placeholder={m['cancelTicket.reasonPlaceholder']()}
						disabled={cancelMutation.isPending}
					/>
					<p class="mt-1 text-xs text-muted-foreground">{m['cancelTicket.reasonHelp']()}</p>
				</div>
			</div>

			<DialogFooter class="gap-2">
				<Button variant="outline" onclick={handleClose} disabled={cancelMutation.isPending}>
					{m['cancelTicket.keepButton']()}
				</Button>
				<Button
					variant="destructive"
					onclick={() => cancelMutation.mutate()}
					disabled={cancelMutation.isPending}
				>
					{#if cancelMutation.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{m['cancelTicket.cancelling']()}
					{:else}
						<CheckCircle2 class="mr-2 h-4 w-4" aria-hidden="true" />
						{m['cancelTicket.confirmButton']()}
					{/if}
				</Button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>
