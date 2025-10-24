<script lang="ts">
	import type { EventTicketSchema } from '$lib/api/generated/types.gen';
	import { Card } from '$lib/components/ui/card';
	import TicketStatusBadge from './TicketStatusBadge.svelte';
	import { Ticket, Calendar, MapPin, Download } from 'lucide-svelte';
	import QRCode from 'qrcode';
	import { onMount } from 'svelte';

	interface Props {
		ticket: EventTicketSchema;
		eventName: string;
		eventDate?: string;
		eventLocation?: string;
	}

	let { ticket, eventName, eventDate, eventLocation }: Props = $props();

	let qrCodeDataUrl = $state<string | null>(null);
	let isGenerating = $state(false);

	// Generate QR code on mount
	onMount(async () => {
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
	});

	// Format checked in date
	let checkedInDate = $derived(() => {
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
</script>

<Card class="p-6">
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
		{#if ticket.status === 'active' || ticket.status === 'checked_in'}
			<div class="flex flex-col items-center gap-4 rounded-lg border border-border bg-muted/30 p-6">
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

		<!-- Checked In Info -->
		{#if ticket.status === 'checked_in' && checkedInDate()}
			<div class="rounded-lg bg-blue-50 p-4 text-sm">
				<p class="font-medium text-blue-900">Checked in at {checkedInDate()}</p>
			</div>
		{/if}

		<!-- Ticket ID -->
		<div class="border-t border-border pt-4">
			<p class="text-xs text-muted-foreground">Ticket ID: {ticket.id}</p>
		</div>
	</div>
</Card>
