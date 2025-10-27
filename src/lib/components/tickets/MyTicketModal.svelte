<script lang="ts">
	import type { EventTicketSchemaActual } from '$lib/utils/eligibility';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Card } from '$lib/components/ui/card';
	import TicketStatusBadge from './TicketStatusBadge.svelte';
	import { Ticket, Calendar, MapPin, Download } from 'lucide-svelte';
	import QRCode from 'qrcode';
	import { onMount } from 'svelte';

	interface Props {
		open: boolean;
		ticket: EventTicketSchemaActual;
		eventName: string;
		eventDate?: string;
		eventLocation?: string;
		onClose: () => void;
		onResumePayment?: () => void;
		isResumingPayment?: boolean;
	}

	let {
		open = $bindable(),
		ticket,
		eventName,
		eventDate,
		eventLocation,
		onClose,
		onResumePayment,
		isResumingPayment = false
	}: Props = $props();

	let qrCodeDataUrl = $state<string | null>(null);
	let isGenerating = $state(false);

	// Generate QR code when modal opens and ticket ID is available
	$effect(() => {
		if (open && ticket.id && !qrCodeDataUrl) {
			generateQRCode();
		}
	});

	async function generateQRCode() {
		if (!ticket.id) return;

		isGenerating = true;
		try {
			// Generate QR code with ticket ID
			const url = await QRCode.toDataURL(ticket.id, {
				width: 256,
				margin: 2,
				color: {
					dark: '#000000',
					light: '#FFFFFF'
				}
			});
			qrCodeDataUrl = url;
		} catch (err) {
			console.error('Failed to generate QR code:', err);
		} finally {
			isGenerating = false;
		}
	}

	// Format checked in date
	let checkedInDate = $derived.by(() => {
		if (!ticket.checked_in_at) return null;
		const date = new Date(ticket.checked_in_at);
		return date.toLocaleString();
	});

	// Download QR code
	function downloadQRCode() {
		if (!qrCodeDataUrl) return;

		const link = document.createElement('a');
		link.download = `ticket-${ticket.id}.png`;
		link.href = qrCodeDataUrl;
		link.click();
	}

	// Check if ticket is pending and payment method allows resume
	let canResumePayment = $derived(() => {
		if (ticket.status !== 'pending') return false;
		if (!ticket.tier) return false;

		const paymentMethod = ticket.tier.payment_method;
		// Allow resume for online (Stripe) and offline, but not at-the-door
		return paymentMethod === 'online' || paymentMethod === 'offline';
	});
</script>

<Dialog bind:open>
	<DialogContent class="max-h-[90vh] max-w-lg overflow-y-auto">
		<DialogHeader>
			<DialogTitle class="sr-only">Your Ticket</DialogTitle>
		</DialogHeader>

		<div class="space-y-6">
			<!-- Header -->
			<div class="flex items-start justify-between">
				<div class="flex items-center gap-3">
					<div class="rounded-full bg-primary/10 p-3">
						<Ticket class="h-6 w-6 text-primary" aria-hidden="true" />
					</div>
					<div>
						<h2 class="text-xl font-bold">{eventName}</h2>
						<p class="text-sm text-muted-foreground">
							{ticket.tier?.name || 'General Admission'}
						</p>
					</div>
				</div>
				<TicketStatusBadge status={ticket.status} />
			</div>

			<!-- Pending Payment Banner -->
			{#if ticket.status === 'pending'}
				<div
					class="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950"
					role="alert"
				>
					<div class="flex items-start gap-3">
						<svg
							class="h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400"
							fill="currentColor"
							viewBox="0 0 20 20"
							aria-hidden="true"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
								clip-rule="evenodd"
							/>
						</svg>
						<div class="flex-1">
							<p class="font-medium text-orange-900 dark:text-orange-100">
								Your ticket is pending payment
							</p>
							<p class="mt-1 text-sm text-orange-800 dark:text-orange-200">
								{#if ticket.tier?.payment_method === 'online'}
									Complete your payment to confirm your ticket. Your reservation will expire if
									payment is not completed.
								{:else if ticket.tier?.payment_method === 'offline'}
									Please complete your offline payment as instructed by the organizer to confirm
									your ticket.
								{:else}
									Complete your payment to confirm your ticket.
								{/if}
							</p>
							{#if canResumePayment() && onResumePayment}
								<button
									onclick={onResumePayment}
									disabled={isResumingPayment}
									class="mt-3 inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-orange-500 dark:hover:bg-orange-600"
								>
									{#if isResumingPayment}
										<div
											class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
											aria-hidden="true"
										></div>
										Processing...
									{:else}
										Resume Payment
									{/if}
								</button>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- Event Details -->
			{#if eventDate || eventLocation}
				<dl class="space-y-2 text-sm">
					{#if eventDate}
						<div class="flex items-center gap-2">
							<Calendar class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
							<dd>{eventDate}</dd>
						</div>
					{/if}
					{#if eventLocation}
						<div class="flex items-center gap-2">
							<MapPin class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
							<dd>{eventLocation}</dd>
						</div>
					{/if}
				</dl>
			{/if}

			<!-- QR Code -->
			{#if ticket.status === 'pending' || ticket.status === 'active' || ticket.status === 'checked_in'}
				<div
					class="flex flex-col items-center gap-4 rounded-lg border border-border bg-muted/30 p-6"
				>
					{#if isGenerating}
						<div class="flex h-64 w-64 items-center justify-center">
							<div
								class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"
								role="status"
								aria-label="Generating QR code"
							></div>
						</div>
					{:else if qrCodeDataUrl}
						<img
							src={qrCodeDataUrl}
							alt="Ticket QR Code"
							class="h-64 w-64 rounded-lg border border-border bg-white"
						/>
						<p class="text-center text-sm text-muted-foreground">Show this QR code at check-in</p>
						<button
							type="button"
							onclick={downloadQRCode}
							class="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
						>
							<Download class="h-4 w-4" aria-hidden="true" />
							Download QR Code
						</button>
					{:else}
						<div class="text-center text-sm text-destructive">
							Unable to generate QR code. Please refresh the page.
						</div>
					{/if}
				</div>
			{/if}

			<!-- Manual Payment Instructions (for pending tickets) -->
			{#if ticket.status === 'pending' && ticket.tier?.manual_payment_instructions}
				<div
					class="rounded-lg border-2 border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/30"
				>
					<h3
						class="mb-2 flex items-center gap-2 font-semibold text-yellow-900 dark:text-yellow-100"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							viewBox="0 0 20 20"
							fill="currentColor"
							aria-hidden="true"
						>
							<path
								fill-rule="evenodd"
								d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
								clip-rule="evenodd"
							/>
						</svg>
						Payment Instructions
					</h3>
					<p class="whitespace-pre-wrap text-sm text-yellow-900 dark:text-yellow-100">
						{ticket.tier.manual_payment_instructions}
					</p>
				</div>
			{/if}

			<!-- Checked In Info -->
			{#if ticket.status === 'checked_in' && checkedInDate()}
				<div class="rounded-lg bg-blue-50 p-4 text-sm dark:bg-blue-950/50">
					<p class="font-medium text-blue-900 dark:text-blue-100">
						Checked in at {checkedInDate()}
					</p>
				</div>
			{/if}

			<!-- Ticket ID -->
			<div class="border-t border-border pt-4">
				<p class="text-xs text-muted-foreground">Ticket ID: {ticket.id}</p>
			</div>
		</div>
	</DialogContent>
</Dialog>
