<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { isPwycTicket, getPwycWarning } from '$lib/utils/ticket-helpers';
	import { Input } from '$lib/components/ui/input';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { AlertTriangle } from '@lucide/svelte';
	import type { AdminTicketSchema } from '$lib/api/generated/types.gen';

	interface Props {
		isOpen: boolean;
		ticket: AdminTicketSchema | null;
		pwycPricePaid: string;
		isPending: boolean;
		onConfirm: () => void;
		onClose: () => void;
	}

	let {
		isOpen,
		ticket,
		pwycPricePaid = $bindable(),
		isPending,
		onConfirm,
		onClose
	}: Props = $props();
</script>

<!-- Confirm Payment Dialog -->
<Dialog open={isOpen && !!ticket} onOpenChange={(open) => !open && onClose()}>
	<DialogContent class="max-w-lg">
		{#if ticket}
			{@const pwyc = isPwycTicket(ticket)}
			{@const pwycWarning = pwyc ? getPwycWarning(ticket, pwycPricePaid) : null}
			{@const pwycValid = !pwyc || (pwycPricePaid !== '' && parseFloat(pwycPricePaid) > 0)}
			<DialogHeader>
				<div class="flex items-start gap-4">
					<div
						class="shrink-0 rounded-full bg-blue-100 p-3 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
						aria-hidden="true"
					>
						<AlertTriangle class="h-6 w-6" />
					</div>
					<div class="flex-1 pt-1 text-left">
						<DialogTitle>{m['eventTicketsAdmin.confirmPaymentTitle']()}</DialogTitle>
						<DialogDescription class="mt-2">
							{ticket.status === 'cancelled'
								? m['eventTicketsAdmin.confirmPaymentMessageReactivate']()
								: m['eventTicketsAdmin.confirmPaymentMessageActivate']()}
						</DialogDescription>
					</div>
				</div>
			</DialogHeader>

			<!-- PWYC Price Input -->
			{#if pwyc}
				<div class="space-y-2">
					<label for="pwyc-price-input" class="block text-sm font-medium text-foreground">
						{m['eventTicketsAdmin.amountPaidLabel']({
							currency: ticket.tier?.currency?.toUpperCase() || 'EUR'
						})}
					</label>
					<Input
						id="pwyc-price-input"
						type="text"
						inputmode="decimal"
						value={pwycPricePaid}
						oninput={(e) => {
							const sanitized = (e.currentTarget as HTMLInputElement).value
								.replace(/,/g, '.')
								.replace(/[^\d.]/g, '');
							// Keep only the first decimal point ("1.2.3" → "1.23") so the raw
							// value is always a valid decimal before it is sent as price_paid.
							const [integerPart, ...decimalParts] = sanitized.split('.');
							pwycPricePaid = decimalParts.length
								? `${integerPart}.${decimalParts.join('')}`
								: integerPart;
						}}
						placeholder={ticket.tier?.pwyc_min || '0.00'}
						aria-describedby={pwycWarning ? 'pwyc-warning' : undefined}
					/>
					{#if pwycWarning}
						<p id="pwyc-warning" class="text-sm text-orange-600 dark:text-orange-400">
							{pwycWarning}
						</p>
					{/if}
				</div>
			{/if}

			<!-- Actions -->
			<DialogFooter class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
				<button
					type="button"
					onclick={onClose}
					class="rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{m['eventTicketsAdmin.confirmPaymentCancel']()}
				</button>
				<button
					type="button"
					onclick={onConfirm}
					disabled={isPending || !pwycValid}
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
				>
					{#if isPending}
						{m['eventTicketsAdmin.confirmingPayment']()}
					{:else}
						{m['eventTicketsAdmin.confirmPaymentButton']()}
					{/if}
				</button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>
