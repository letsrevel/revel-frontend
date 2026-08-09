<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { invalidateAll } from '$app/navigation';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		eventadmincoreCancellationRefundPreview,
		eventadmincoreUpdateEventStatus
	} from '$lib/api/generated/sdk.gen';
	import type { EventDetailSchema, EventRefundPreviewSchema } from '$lib/api/generated/types.gen';
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
	import { Textarea } from '$lib/components/ui/textarea';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { authStore } from '$lib/stores/auth.svelte';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { formatMoney } from '$lib/utils/format';
	import { formatDateTime } from '$lib/utils/date';
	import { Loader2, AlertTriangle, Info, X, RotateCcw } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	const REASON_MAX_LENGTH = 1000;

	interface Props {
		open: boolean;
		eventId: string;
		/**
		 * Retry mode: the event is already cancelled and the dialog only
		 * (re-)dispatches the refund sweep — re-POSTing cancel-with-refunds is
		 * the supported, idempotent way to resume a partial run.
		 */
		retryRefunds?: boolean;
		/** Called once the event has been cancelled successfully. */
		onCancelled?: (event: EventDetailSchema) => void;
	}

	let { open = $bindable(), eventId, retryRefunds = false, onCancelled }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	let reason = $state('');
	let refundTickets = $state(false);

	$effect(() => {
		if (open) {
			reason = '';
			refundTickets = retryRefunds;
		}
	});

	// Advisory pre-flight: never blocks cancellation, even when it errors.
	const previewQuery = createQuery<EventRefundPreviewSchema>(() => ({
		queryKey: ['event-cancellation-refund-preview', eventId],
		queryFn: async () => {
			const response = await eventadmincoreCancellationRefundPreview({
				path: { event_id: eventId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error || !response.data) {
				throw new Error(extractErrorMessage(response.error) || 'preview-failed');
			}
			return response.data;
		},
		enabled: open && !!accessToken && !!eventId,
		staleTime: 0,
		retry: false
	}));

	const preview = $derived(previewQuery.data);
	// Read both flags unconditionally so TanStack tracks them both.
	const isLoadingPreview = $derived.by(() => {
		const loading = previewQuery.isLoading;
		const fetching = previewQuery.isFetching;
		return loading || fetching;
	});

	const hasInsufficientBalance = $derived(
		preview?.currencies.some((line) => line.balance_sufficient === false) ?? false
	);
	const nothingLeftToRefund = $derived(
		retryRefunds && !!preview && preview.online_refundable_tickets === 0
	);

	const cancelMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error('not-authenticated');
			const trimmed = reason.trim();
			const body: { cancellation_reason?: string; refund_tickets?: boolean } = {};
			if (trimmed && !retryRefunds) body.cancellation_reason = trimmed;
			if (refundTickets) body.refund_tickets = true;
			const response = await eventadmincoreUpdateEventStatus({
				path: { event_id: eventId, status: 'cancelled' },
				body: Object.keys(body).length > 0 ? body : null,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error || !response.data) {
				throw new Error(extractErrorMessage(response.error) || 'cancel-failed');
			}
			return response.data;
		},
		onSuccess: async (data) => {
			toast.success(m['cancelEvent.successTitle'](), {
				description: refundTickets
					? m['cancelEvent.successWithRefunds']()
					: m['cancelEvent.successDescription'](),
				duration: 6000
			});
			queryClient.invalidateQueries({ queryKey: ['events'] });
			queryClient.invalidateQueries({ queryKey: ['event-cancellation-refund-preview', eventId] });
			// Refresh the SvelteKit load functions so callers driven by
			// data.event(s) (admin events list, edit page) reflect the new
			// cancelled status without a full page reload.
			await invalidateAll();
			open = false;
			onCancelled?.(data);
		},
		onError: (err: Error) => {
			toast.error(m['cancelEvent.errorTitle'](), {
				description: extractErrorMessage(err) || undefined,
				duration: 6000
			});
		}
	}));

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
				{#if retryRefunds}
					<RotateCcw class="h-5 w-5 text-primary" aria-hidden="true" />
					{m['cancelEvent.retryTitle']()}
				{:else}
					<X class="h-5 w-5 text-destructive" aria-hidden="true" />
					{m['cancelEvent.dialogTitle']()}
				{/if}
			</DialogTitle>
			<DialogDescription>
				{retryRefunds ? m['cancelEvent.retryDescription']() : m['cancelEvent.dialogDescription']()}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4">
			{#if !retryRefunds}
				<Alert>
					<Info class="h-4 w-4" aria-hidden="true" />
					<AlertDescription>{m['cancelEvent.sharedNotice']()}</AlertDescription>
				</Alert>

				<div>
					<Label for="event-cancel-reason">{m['cancelEvent.reasonLabel']()}</Label>
					<Textarea
						id="event-cancel-reason"
						bind:value={reason}
						maxlength={REASON_MAX_LENGTH}
						rows={4}
						placeholder={m['cancelEvent.reasonPlaceholder']()}
						disabled={cancelMutation.isPending}
					/>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['cancelEvent.reasonHelp']({ max: REASON_MAX_LENGTH })}
					</p>
				</div>
			{/if}

			<!-- Refund sweep opt-in + advisory preview -->
			<div class="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
				{#if !retryRefunds}
					<div class="flex items-start gap-2">
						<Checkbox
							id="cancel-refund-tickets"
							bind:checked={refundTickets}
							disabled={cancelMutation.isPending}
						/>
						<div class="grid gap-1">
							<Label for="cancel-refund-tickets" class="cursor-pointer font-medium">
								{m['cancelEvent.refundTicketsLabel']()}
							</Label>
							<p class="text-xs text-muted-foreground">
								{m['cancelEvent.refundTicketsHelp']()}
							</p>
						</div>
					</div>
				{/if}

				{#if isLoadingPreview && !preview}
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
						{m['cancelEvent.previewLoading']()}
					</div>
				{:else if previewQuery.isError && !preview}
					<p class="text-sm text-muted-foreground">{m['cancelEvent.previewError']()}</p>
				{:else if preview}
					<div class="space-y-2 text-sm" data-testid="cancel-refund-preview">
						<p class="text-muted-foreground">
							{m['cancelEvent.previewCounts']({
								active: preview.active_tickets,
								online: preview.online_refundable_tickets,
								offline: preview.offline_tickets
							})}
						</p>
						{#each preview.currencies as line (line.currency)}
							<div class="flex items-baseline justify-between gap-2">
								<span class="font-medium tabular-nums">
									{m['cancelEvent.previewCurrencyLine']({
										total: formatMoney(line.total_refundable, line.currency)
									})}
								</span>
								{#if line.available_balance != null}
									<span class="text-xs tabular-nums text-muted-foreground">
										{m['cancelEvent.previewBalance']({
											balance: formatMoney(line.available_balance, line.currency)
										})}
									</span>
								{/if}
							</div>
						{/each}
						{#if preview.tickets_refund_started_at}
							<p class="text-xs text-muted-foreground">
								{m['cancelEvent.refundsStartedAt']({
									datetime: formatDateTime(preview.tickets_refund_started_at)
								})}
							</p>
						{/if}
					</div>
				{/if}

				{#if refundTickets && hasInsufficientBalance}
					<Alert>
						<AlertTriangle class="h-4 w-4" aria-hidden="true" />
						<AlertDescription>{m['cancelEvent.balanceInsufficient']()}</AlertDescription>
					</Alert>
				{/if}

				{#if refundTickets && !nothingLeftToRefund}
					<Alert variant="destructive">
						<AlertTriangle class="h-4 w-4" aria-hidden="true" />
						<AlertDescription>
							{m['cancelEvent.irreversibleWarning']()}
							{m['cancelEvent.asyncNote']()}
						</AlertDescription>
					</Alert>
				{/if}

				{#if nothingLeftToRefund}
					<Alert>
						<Info class="h-4 w-4" aria-hidden="true" />
						<AlertDescription>{m['cancelEvent.retryNothingLeft']()}</AlertDescription>
					</Alert>
				{/if}
			</div>
		</div>

		<DialogFooter class="gap-2">
			<Button variant="outline" onclick={handleClose} disabled={cancelMutation.isPending}>
				{m['cancelEvent.keepButton']()}
			</Button>
			{#if !nothingLeftToRefund}
				<Button
					variant={retryRefunds ? 'default' : 'destructive'}
					onclick={() => cancelMutation.mutate()}
					disabled={cancelMutation.isPending}
				>
					{#if cancelMutation.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{m['cancelEvent.cancelling']()}
					{:else if retryRefunds}
						<RotateCcw class="mr-2 h-4 w-4" aria-hidden="true" />
						{m['cancelEvent.retryButton']()}
					{:else}
						<AlertTriangle class="mr-2 h-4 w-4" aria-hidden="true" />
						{m['cancelEvent.confirmButton']()}
					{/if}
				</Button>
			{/if}
		</DialogFooter>
	</DialogContent>
</Dialog>
