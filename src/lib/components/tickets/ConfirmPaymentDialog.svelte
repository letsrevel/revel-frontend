<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { fade, scale } from 'svelte/transition';
	import { isPwycTicket, getPwycWarning } from '$lib/utils/ticket-helpers';
	import { Input } from '$lib/components/ui/input';
	import { AlertTriangle, X } from '@lucide/svelte';
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
{#if isOpen && ticket}
	{@const pwyc = isPwycTicket(ticket)}
	{@const pwycWarning = pwyc ? getPwycWarning(ticket, pwycPricePaid) : null}
	{@const pwycValid = !pwyc || (pwycPricePaid !== '' && parseFloat(pwycPricePaid) > 0)}
	<div
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				onClose();
			}
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') {
				onClose();
			}
		}}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
		transition:fade={{ duration: 150 }}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="confirm-payment-dialog-title"
			class="relative mx-4 w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg"
			transition:scale={{ duration: 150, start: 0.95 }}
		>
			<!-- Close button -->
			<button
				type="button"
				onclick={onClose}
				aria-label={m['eventTicketsAdmin.closeDialog']()}
				class="absolute right-4 top-4 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<X class="h-4 w-4" aria-hidden="true" />
			</button>

			<!-- Icon + Title -->
			<div class="flex items-start gap-4">
				<div
					class="shrink-0 rounded-full bg-blue-100 p-3 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
					aria-hidden="true"
				>
					<AlertTriangle class="h-6 w-6" />
				</div>
				<div class="flex-1 pt-1">
					<h2 id="confirm-payment-dialog-title" class="text-lg font-semibold text-foreground">
						{m['eventTicketsAdmin.confirmPaymentTitle']()}
					</h2>
				</div>
			</div>

			<!-- Message -->
			<div class="mt-4 text-sm text-muted-foreground">
				{ticket.status === 'cancelled'
					? m['eventTicketsAdmin.confirmPaymentMessageReactivate']()
					: m['eventTicketsAdmin.confirmPaymentMessageActivate']()}
			</div>

			<!-- PWYC Price Input -->
			{#if pwyc}
				<div class="mt-4 space-y-2">
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
							pwycPricePaid = (e.currentTarget as HTMLInputElement).value
								.replace(/,/g, '.')
								.replace(/[^\d.]/g, '');
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
			<div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
			</div>
		</div>
	</div>
{/if}
