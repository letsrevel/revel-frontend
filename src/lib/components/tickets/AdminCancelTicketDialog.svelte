<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		eventadminticketsCancelTicket,
		eventadminticketsTicketRefundContext
	} from '$lib/api/generated/sdk.gen';
	import type { TicketRefundContextSchema } from '$lib/api/generated/types.gen';
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
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { formatMoney } from '$lib/utils/format';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { Loader2, AlertTriangle, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		open: boolean;
		eventId: string;
		ticketId: string;
		accessToken: string | null;
		onClose: () => void;
		/** Called after the ticket has been cancelled — parent refreshes its data. */
		onCancelled: () => void;
	}

	const { open, eventId, ticketId, accessToken, onClose, onCancelled }: Props = $props();

	let alsoRefund = $state(false);
	let refundAmount = $state('');
	let errorMessage = $state<string | null>(null);

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
		staleTime: 0,
		retry: false
	}));

	const context = $derived(contextQuery.data);
	const remaining = $derived(context ? parseFloat(context.remaining_refundable) : 0);

	// Re-seed the form each time the dialog opens; prefill the refund amount
	// with the policy suggestion when there is one, else the full remainder.
	// `seeded` (not `refundAmount === ''`) guards the prefill so clearing the
	// input mid-edit doesn't snap the value back.
	let wasOpen = $state(false);
	let seeded = $state(false);
	$effect(() => {
		if (open && !wasOpen) {
			alsoRefund = false;
			refundAmount = '';
			errorMessage = null;
			seeded = false;
		}
		wasOpen = open;
	});
	$effect(() => {
		if (open && context && !seeded) {
			refundAmount = context.policy_suggested_amount ?? context.remaining_refundable;
			seeded = true;
		}
	});

	const refundAmountNum = $derived.by(() => {
		const parsed = parseFloat(refundAmount);
		return Number.isFinite(parsed) ? parsed : 0;
	});
	const refundValid = $derived(
		!alsoRefund || (refundAmountNum > 0 && refundAmountNum <= remaining)
	);

	const cancelMutation = createMutation(() => ({
		mutationFn: async () => {
			const response = await eventadminticketsCancelTicket({
				path: { event_id: eventId, ticket_id: ticketId },
				body: alsoRefund ? { refund_amount: refundAmountNum.toFixed(2) } : null,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				const status = response.response?.status;
				let message: string;
				if (status === 402) {
					message = m['refundTicket.errorInsufficientBalance']();
				} else if (status === 502) {
					message = m['refundTicket.errorStripe']();
				} else {
					message = extractErrorMessage(response.error) || m['adminCancelTicket.errorGeneric']();
				}
				// silent: rendered inline below; avoids the duplicate global toast.
				throw Object.assign(new Error(message), { silent: true });
			}
			return response.data;
		},
		onSuccess: () => {
			toast.success(m['adminCancelTicket.successTitle'](), {
				description: alsoRefund
					? m['adminCancelTicket.successWithRefund']({
							amount: formatMoney(refundAmountNum.toFixed(2), context?.currency)
						})
					: undefined,
				duration: 6000
			});
			queryClient.invalidateQueries({ queryKey: ['ticket-refund-context', eventId, ticketId] });
			onCancelled();
			onClose();
		},
		onError: (err: unknown) => {
			errorMessage = err instanceof Error ? err.message : m['adminCancelTicket.errorGeneric']();
		}
	}));

	function submit(): void {
		// Never send a literal "Bearer null" during the auth bootstrap window.
		if (cancelMutation.isPending || !accessToken || !refundValid) return;
		errorMessage = null;
		cancelMutation.mutate();
	}

	function handleClose(): void {
		if (cancelMutation.isPending) return;
		onClose();
	}
</script>

<Dialog {open} onOpenChange={(value) => (!value ? handleClose() : undefined)}>
	<DialogContent
		class="max-h-[90vh] max-w-md overflow-y-auto"
		escapeKeydownBehavior={cancelMutation.isPending ? 'ignore' : 'close'}
		interactOutsideBehavior={cancelMutation.isPending ? 'ignore' : 'close'}
	>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<X class="h-5 w-5 text-destructive" aria-hidden="true" />
				{m['eventTicketsAdmin.cancelTicketTitle']()}
			</DialogTitle>
			<DialogDescription>{m['eventTicketsAdmin.cancelTicketMessage']()}</DialogDescription>
		</DialogHeader>

		<div class="space-y-4">
			{#if contextQuery.isLoading}
				<div class="flex items-center justify-center gap-3 py-4 text-sm text-muted-foreground">
					<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
					{m['refundTicket.loadingContext']()}
				</div>
			{:else if contextQuery.isError && !context}
				<!-- Without the context the refund section can't render; say so
				     (with retry) instead of silently offering a refundless cancel. -->
				<Alert variant="destructive">
					<AlertTriangle class="h-4 w-4" aria-hidden="true" />
					<AlertDescription class="flex flex-wrap items-center justify-between gap-2">
						{m['refundTicket.loadingError']()}
						<Button size="sm" variant="outline" onclick={() => contextQuery.refetch()}>
							{m['refundTicket.retry']()}
						</Button>
					</AlertDescription>
				</Alert>
			{:else if context && remaining > 0}
				<div class="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
					<div class="flex items-start gap-2">
						<Checkbox
							id="cancel-also-refund"
							bind:checked={alsoRefund}
							disabled={cancelMutation.isPending}
						/>
						<div class="grid gap-1">
							<Label for="cancel-also-refund" class="cursor-pointer font-medium">
								{m['adminCancelTicket.refundSectionLabel']()}
							</Label>
							<p class="text-xs text-muted-foreground">
								{m['adminCancelTicket.refundHint']({
									max: formatMoney(context.remaining_refundable, context.currency)
								})}
							</p>
						</div>
					</div>
					{#if alsoRefund}
						<div>
							<Label for="cancel-refund-amount">{m['refundTicket.amountLabel']()}</Label>
							<Input
								id="cancel-refund-amount"
								type="number"
								inputmode="decimal"
								min="0.01"
								max={context.remaining_refundable}
								step="0.01"
								bind:value={refundAmount}
								disabled={cancelMutation.isPending}
								aria-invalid={!refundValid}
								aria-describedby={!refundValid ? 'cancel-refund-amount-error' : undefined}
							/>
							{#if !refundValid}
								<p
									id="cancel-refund-amount-error"
									class="mt-1 text-sm text-destructive"
									role="alert"
								>
									{m['refundTicket.amountInvalid']({
										max: formatMoney(context.remaining_refundable, context.currency)
									})}
								</p>
							{/if}
						</div>
					{:else}
						<p class="text-xs text-muted-foreground">
							{m['adminCancelTicket.noRefundNote']()}
						</p>
					{/if}
				</div>
			{/if}

			{#if errorMessage}
				<Alert variant="destructive">
					<AlertTriangle class="h-4 w-4" aria-hidden="true" />
					<AlertDescription role="alert">{errorMessage}</AlertDescription>
				</Alert>
			{/if}
		</div>

		<DialogFooter class="gap-2">
			<Button variant="outline" onclick={handleClose} disabled={cancelMutation.isPending}>
				{m['eventTicketsAdmin.cancelTicketKeep']()}
			</Button>
			<Button
				variant="destructive"
				onclick={submit}
				disabled={cancelMutation.isPending || !accessToken || !refundValid}
			>
				{#if cancelMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				{m['eventTicketsAdmin.cancelTicketButton']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
