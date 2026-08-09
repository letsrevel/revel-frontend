<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		eventadminticketsRefundTicketPayment,
		eventadminticketsTicketRefundContext
	} from '$lib/api/generated/sdk.gen';
	import type { TicketRefundContextSchema, TicketRefundSchema } from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import RefundStatusBadge from './RefundStatusBadge.svelte';
	import { formatMoney } from '$lib/utils/format';
	import { formatDateTime } from '$lib/utils/date';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { Loader2, AlertTriangle, Undo2, Info } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		open: boolean;
		eventId: string;
		ticketId: string;
		accessToken: string | null;
		onClose: () => void;
		/** Called after a refund has been initiated — parent refreshes its data. */
		onRefunded: () => void;
	}

	const { open, eventId, ticketId, accessToken, onClose, onRefunded }: Props = $props();

	type AmountMode = 'full' | 'policy' | 'custom';
	let amountMode = $state<AmountMode>('full');
	let customAmount = $state('');
	let reason = $state('');
	let errorMessage = $state<string | null>(null);

	// Reset the form each time the dialog opens for a ticket.
	let wasOpen = $state(false);
	$effect(() => {
		if (open && !wasOpen) {
			amountMode = 'full';
			customAmount = '';
			reason = '';
			errorMessage = null;
		}
		wasOpen = open;
	});

	const queryClient = useQueryClient();

	const contextQuery = createQuery<TicketRefundContextSchema>(() => ({
		queryKey: ['ticket-refund-context', eventId, ticketId],
		queryFn: async () => {
			const response = await eventadminticketsTicketRefundContext({
				path: { event_id: eventId, ticket_id: ticketId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error || !response.data) {
				throw new Error(extractErrorMessage(response.error) || 'context-failed');
			}
			return response.data;
		},
		enabled: open && !!accessToken && !!ticketId,
		// Always refetch on reopen — amounts move as refunds settle.
		staleTime: 0,
		retry: false
	}));

	const context = $derived(contextQuery.data);
	// Read both flags unconditionally so TanStack tracks them both (`||`
	// short-circuiting would leave `isFetching` untracked while `isLoading`
	// is true — tracked-properties notification gotcha).
	const isLoadingContext = $derived.by(() => {
		const loading = contextQuery.isLoading;
		const fetching = contextQuery.isFetching;
		return loading || fetching;
	});

	const remaining = $derived(context ? parseFloat(context.remaining_refundable) : 0);
	const refundedSoFar = $derived(context ? parseFloat(context.total_refunded) : 0);
	const pendingAmount = $derived(context ? parseFloat(context.total_pending) : 0);
	const policyAmount = $derived.by(() => {
		if (!context?.policy_suggested_amount) return null;
		const parsed = parseFloat(context.policy_suggested_amount);
		// Only offer the policy chip when it's a usable, distinct quick-pick.
		if (!Number.isFinite(parsed) || parsed <= 0 || parsed > remaining) return null;
		return parsed;
	});

	const selectedAmount = $derived.by(() => {
		if (amountMode === 'full') return remaining;
		if (amountMode === 'policy') return policyAmount ?? 0;
		const parsed = parseFloat(customAmount);
		return Number.isFinite(parsed) ? parsed : 0;
	});

	const amountValid = $derived(selectedAmount > 0 && selectedAmount <= remaining);

	const refundHistory = $derived.by((): TicketRefundSchema[] => {
		if (!context?.refunds) return [];
		return [...context.refunds].sort(
			(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		);
	});

	function sourceLabel(source: TicketRefundSchema['source']): string {
		switch (source) {
			case 'organizer_api':
				return m['refundTicket.source.organizer_api']();
			case 'user_cancellation':
				return m['refundTicket.source.user_cancellation']();
			case 'event_cancellation':
				return m['refundTicket.source.event_cancellation']();
			case 'stripe_dashboard':
				return m['refundTicket.source.stripe_dashboard']();
			default:
				return source;
		}
	}

	const refundMutation = createMutation(() => ({
		mutationFn: async () => {
			const trimmedReason = reason.trim();
			const response = await eventadminticketsRefundTicketPayment({
				path: { event_id: eventId, ticket_id: ticketId },
				body: {
					// "Full remaining" omits the amount so the backend computes it —
					// immune to the remaining amount shifting between load and submit.
					...(amountMode === 'full' ? {} : { amount: selectedAmount.toFixed(2) }),
					...(trimmedReason ? { reason: trimmedReason } : {})
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error || !response.data) {
				const status = response.response?.status;
				let message: string;
				if (status === 402) {
					message = m['refundTicket.errorInsufficientBalance']();
				} else if (status === 409) {
					message = m['refundTicket.errorNothingToRefund']();
				} else if (status === 502) {
					message = m['refundTicket.errorStripe']();
				} else if (status === 400) {
					message = extractErrorMessage(response.error) || m['refundTicket.errorAmount']();
				} else {
					message = extractErrorMessage(response.error) || m['refundTicket.errorGeneric']();
				}
				// silent: the error renders inline in the dialog; without the flag
				// the global mutations.onError adds a duplicate generic toast.
				throw Object.assign(new Error(message), { silent: true });
			}
			return response.data;
		},
		onSuccess: (refund) => {
			toast.success(m['refundTicket.successTitle'](), {
				description: m['refundTicket.successDescription']({
					amount: formatMoney(refund.amount, refund.currency)
				}),
				duration: 6000
			});
			queryClient.invalidateQueries({ queryKey: ['ticket-refund-context', eventId, ticketId] });
			onRefunded();
			onClose();
		},
		onError: (err: unknown) => {
			errorMessage = err instanceof Error ? err.message : m['refundTicket.errorGeneric']();
		}
	}));

	function submit(): void {
		// Never send a literal "Bearer null" during the auth bootstrap window.
		if (refundMutation.isPending || !accessToken || !amountValid) return;
		errorMessage = null;
		refundMutation.mutate();
	}

	function handleClose(): void {
		if (refundMutation.isPending) return;
		onClose();
	}
</script>

<Dialog {open} onOpenChange={(value) => (!value ? handleClose() : undefined)}>
	<DialogContent
		class="max-h-[90vh] max-w-md overflow-y-auto"
		escapeKeydownBehavior={refundMutation.isPending ? 'ignore' : 'close'}
		interactOutsideBehavior={refundMutation.isPending ? 'ignore' : 'close'}
	>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<Undo2 class="h-5 w-5 text-primary" aria-hidden="true" />
				{m['refundTicket.dialogTitle']()}
			</DialogTitle>
			<DialogDescription>{m['refundTicket.dialogDescription']()}</DialogDescription>
		</DialogHeader>

		{#if isLoadingContext && !context}
			<div class="flex items-center justify-center gap-3 py-8 text-sm text-muted-foreground">
				<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
				{m['refundTicket.loadingContext']()}
			</div>
		{:else if contextQuery.isError && !context}
			<Alert variant="destructive">
				<AlertTriangle class="h-4 w-4" aria-hidden="true" />
				<AlertDescription>{m['refundTicket.loadingError']()}</AlertDescription>
			</Alert>
			<DialogFooter>
				<Button variant="outline" onclick={handleClose}>{m['refundTicket.close']()}</Button>
				<Button onclick={() => contextQuery.refetch()}>{m['refundTicket.retry']()}</Button>
			</DialogFooter>
		{:else if context}
			<div class="space-y-4">
				<!-- Amounts summary -->
				<div class="rounded-lg border border-border bg-muted/30 p-4" data-testid="refund-context">
					<dl class="space-y-1 text-sm">
						<div class="flex items-baseline justify-between gap-2">
							<dt class="text-muted-foreground">{m['refundTicket.amountPaid']()}</dt>
							<dd class="font-medium tabular-nums">
								{formatMoney(context.amount_paid, context.currency)}
							</dd>
						</div>
						{#if refundedSoFar > 0 || pendingAmount > 0}
							<div class="flex items-baseline justify-between gap-2">
								<dt class="text-muted-foreground">{m['refundTicket.alreadyRefunded']()}</dt>
								<dd class="font-medium tabular-nums">
									{formatMoney(context.total_refunded, context.currency)}
								</dd>
							</div>
						{/if}
					</dl>
					<div class="mt-3 border-t pt-3">
						<div class="text-xs uppercase tracking-wide text-muted-foreground">
							{m['refundTicket.remainingRefundable']()}
						</div>
						<div class="mt-1 text-3xl font-bold text-foreground">
							{formatMoney(context.remaining_refundable, context.currency)}
						</div>
						{#if pendingAmount > 0}
							<p class="mt-1 text-xs text-muted-foreground">
								{m['refundTicket.pendingNote']({
									amount: formatMoney(context.total_pending, context.currency)
								})}
							</p>
						{/if}
					</div>
				</div>

				{#if remaining > 0}
					<!-- Quick-select chips -->
					<fieldset>
						<legend class="text-sm font-medium">{m['refundTicket.amountLabel']()}</legend>
						<div class="mt-2 flex flex-wrap gap-2" role="radiogroup">
							<Button
								type="button"
								size="sm"
								variant={amountMode === 'full' ? 'default' : 'outline'}
								role="radio"
								aria-checked={amountMode === 'full'}
								onclick={() => (amountMode = 'full')}
								disabled={refundMutation.isPending}
							>
								{m['refundTicket.quickFull']({
									amount: formatMoney(context.remaining_refundable, context.currency)
								})}
							</Button>
							{#if policyAmount !== null}
								<Button
									type="button"
									size="sm"
									variant={amountMode === 'policy' ? 'default' : 'outline'}
									role="radio"
									aria-checked={amountMode === 'policy'}
									onclick={() => (amountMode = 'policy')}
									disabled={refundMutation.isPending}
								>
									{m['refundTicket.quickPolicy']({
										amount: formatMoney(context.policy_suggested_amount, context.currency)
									})}
								</Button>
							{/if}
							<Button
								type="button"
								size="sm"
								variant={amountMode === 'custom' ? 'default' : 'outline'}
								role="radio"
								aria-checked={amountMode === 'custom'}
								onclick={() => (amountMode = 'custom')}
								disabled={refundMutation.isPending}
							>
								{m['refundTicket.quickCustom']()}
							</Button>
						</div>
						{#if amountMode === 'custom'}
							<div class="mt-2">
								<Label for="refund-custom-amount" class="sr-only">
									{m['refundTicket.amountLabel']()}
								</Label>
								<Input
									id="refund-custom-amount"
									type="number"
									inputmode="decimal"
									min="0.01"
									max={context.remaining_refundable}
									step="0.01"
									bind:value={customAmount}
									disabled={refundMutation.isPending}
									aria-invalid={customAmount !== '' && !amountValid}
								/>
								{#if customAmount !== '' && !amountValid}
									<p class="mt-1 text-sm text-destructive" role="alert">
										{m['refundTicket.amountInvalid']({
											max: formatMoney(context.remaining_refundable, context.currency)
										})}
									</p>
								{/if}
							</div>
						{/if}
					</fieldset>

					<!-- Reason -->
					<div>
						<Label for="refund-reason">{m['refundTicket.reasonLabel']()}</Label>
						<Textarea
							id="refund-reason"
							bind:value={reason}
							maxlength={500}
							rows={2}
							placeholder={m['refundTicket.reasonPlaceholder']()}
							disabled={refundMutation.isPending}
						/>
					</div>

					<Alert>
						<Info class="h-4 w-4" aria-hidden="true" />
						<AlertDescription>{m['refundTicket.ticketStaysValidNote']()}</AlertDescription>
					</Alert>
				{:else}
					<Alert>
						<Info class="h-4 w-4" aria-hidden="true" />
						<AlertDescription>{m['refundTicket.nothingLeft']()}</AlertDescription>
					</Alert>
				{/if}

				{#if errorMessage}
					<Alert variant="destructive">
						<AlertTriangle class="h-4 w-4" aria-hidden="true" />
						<AlertDescription role="alert">{errorMessage}</AlertDescription>
					</Alert>
				{/if}

				<!-- Refund history -->
				{#if refundHistory.length > 0}
					<details class="rounded-md border border-border bg-background p-3 text-sm">
						<summary class="cursor-pointer font-medium">
							{m['refundTicket.historyTitle']()}
						</summary>
						<ul class="mt-2 space-y-2">
							{#each refundHistory as refund (refund.id)}
								<li class="flex flex-wrap items-center justify-between gap-2 text-xs">
									<span class="flex items-center gap-2">
										<span class="font-medium tabular-nums">
											{formatMoney(refund.amount, refund.currency)}
										</span>
										<RefundStatusBadge status={refund.status} />
									</span>
									<span class="text-muted-foreground">
										{sourceLabel(refund.source)} · {formatDateTime(refund.created_at)}
									</span>
									{#if refund.status === 'failed' && refund.failure_reason}
										<span class="w-full text-destructive">
											{m['refundTicket.historyFailure']({ reason: refund.failure_reason })}
										</span>
									{/if}
								</li>
							{/each}
						</ul>
					</details>
				{/if}
			</div>

			<DialogFooter class="gap-2">
				<Button variant="outline" onclick={handleClose} disabled={refundMutation.isPending}>
					{m['refundTicket.close']()}
				</Button>
				{#if remaining > 0}
					<Button
						onclick={submit}
						disabled={refundMutation.isPending || !accessToken || !amountValid}
					>
						{#if refundMutation.isPending}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
							{m['refundTicket.submitting']()}
						{:else}
							<Undo2 class="mr-2 h-4 w-4" aria-hidden="true" />
							{m['refundTicket.submitButton']({
								amount: formatMoney(selectedAmount.toFixed(2), context.currency)
							})}
						{/if}
					</Button>
				{/if}
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>
