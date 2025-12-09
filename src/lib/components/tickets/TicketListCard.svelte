<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { UserTicketSchema } from '$lib/api/generated/types.gen';
	import { Card } from '$lib/components/ui/card';
	import TicketStatusBadge from './TicketStatusBadge.svelte';
	import MyTicketModal from './MyTicketModal.svelte';
	import AddToWalletButton from './AddToWalletButton.svelte';
	import { Calendar, MapPin, Ticket, Download, CalendarDays } from 'lucide-svelte';
	import { downloadRevelEventICalFile } from '$lib/utils/ical';
	import { getImageUrl } from '$lib/utils/url';
	import { formatEventDateRange } from '$lib/utils/date';
	import { getEventLogo } from '$lib/utils/event';
	import { getLocale } from '$lib/paraglide/runtime.js';

	interface Props {
		ticket: UserTicketSchema;
	}

	let { ticket }: Props = $props();

	let showTicketModal = $state(false);

	// Logo with fallback hierarchy: event -> series -> organization
	let logoPath = $derived(getEventLogo(ticket.event));
	let logoUrl = $derived(getImageUrl(logoPath));

	// Format event date
	let eventDate = $derived.by(() => {
		if (!ticket.event.start) return null;
		// If no end date, just show start
		return formatEventDateRange(ticket.event.start, ticket.event.start);
	});

	// Get event location (will use venue_name if available, then fallback to location)
	let eventLocation = $derived.by(() => {
		const event = ticket.event as any;
		return event.venue_name || event.location || null;
	});

	// Download iCal
	function downloadICalFile() {
		// Need to ensure we have the end date
		const event = ticket.event as any;
		if (!event.start) return;

		downloadRevelEventICalFile({
			id: ticket.event.id,
			slug: event.slug || ticket.event.id, // Fallback to ID if slug missing
			name: ticket.event.name,
			description: event.description,
			start: event.start,
			end: event.end || event.start, // Fallback to start if end not available
			location: event.location,
			venue_name: event.venue_name,
			organization: event.organization
		});
	}

	// Check if ticket can show QR code
	let canShowQRCode = $derived(
		ticket.status === 'active' ||
			ticket.status === 'checked_in' ||
			(ticket.status as string) === 'pending'
	);

	// Format created date to match event date format (e.g., "Tue, Jan 13, 2025")
	let createdDate = $derived.by(() => {
		const date = new Date(ticket.created_at);
		const locale = getLocale();
		return date.toLocaleDateString(locale, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	});
</script>

<Card class="group overflow-hidden transition-shadow hover:shadow-lg">
	<div class="flex flex-col gap-4 p-4 md:p-6">
		<!-- Header with Event Info -->
		<div class="flex items-start gap-4">
			<!-- Event Logo/Icon (with fallback: event -> series -> org) -->
			<div class="shrink-0">
				{#if logoUrl}
					<img src={logoUrl} alt="" class="h-16 w-16 rounded-lg border object-cover" />
				{:else}
					<div
						class="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary"
					>
						<Ticket class="h-8 w-8" aria-hidden="true" />
					</div>
				{/if}
			</div>

			<!-- Event Details -->
			<div class="min-w-0 flex-1">
				<div class="mb-2 flex items-start justify-between gap-2">
					<div class="min-w-0 flex-1">
						<h3 class="text-lg font-semibold">
							<a
								href="/events/{ticket.event.id}"
								class="hover:underline focus:underline focus:outline-none"
							>
								{ticket.event.name}
							</a>
						</h3>
						<p class="text-sm text-muted-foreground">
							{ticket.tier.name || 'General Admission'}
						</p>
					</div>
					<TicketStatusBadge status={ticket.status} />
				</div>

				<!-- Event Metadata -->
				<dl class="space-y-1.5 text-sm">
					{#if eventDate}
						<div class="flex items-center gap-2 text-muted-foreground">
							<Calendar class="h-4 w-4 shrink-0" aria-hidden="true" />
							<dd class="truncate">{eventDate}</dd>
						</div>
					{/if}
					{#if eventLocation}
						<div class="flex items-center gap-2 text-muted-foreground">
							<MapPin class="h-4 w-4 shrink-0" aria-hidden="true" />
							<dd class="truncate">{eventLocation}</dd>
						</div>
					{/if}
					<!-- Purchased Date -->
					<div class="text-muted-foreground">
						<span class="font-medium">{m['ticketListCard.purchased']()}</span>
						{createdDate}
					</div>
				</dl>
			</div>
		</div>

		<!-- Actions Footer -->
		<div class="border-t border-border pt-4">
			<div class="flex flex-col gap-2">
				<!-- Download iCal -->
				{#if ticket.event.start}
					<button
						type="button"
						onclick={downloadICalFile}
						class="inline-flex items-center justify-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						aria-label="Download calendar event"
					>
						<CalendarDays class="h-4 w-4" aria-hidden="true" />
						{m['ticketListCard.addToCalendar']()}
					</button>
				{/if}

				<!-- View Ticket -->
				{#if canShowQRCode}
					<button
						type="button"
						onclick={() => (showTicketModal = true)}
						class="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						aria-label="View ticket and QR code"
					>
						<Ticket class="h-4 w-4" aria-hidden="true" />
						View Ticket
					</button>
				{:else}
					<a
						href="/events/{ticket.event.id}"
						class="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						View Event
					</a>
				{/if}

				<!-- Add to Wallet -->
				{#if ticket.apple_pass_available && ticket.id}
					<AddToWalletButton ticketId={ticket.id} eventName={ticket.event.name} variant="default" />
				{/if}
			</div>
		</div>
	</div>
</Card>

<!-- Ticket Modal -->
{#if canShowQRCode}
	<MyTicketModal
		bind:open={showTicketModal}
		ticket={{
			id: ticket.id || undefined,
			status: ticket.status,
			tier: ticket.tier,
			checked_in_at: ticket.checked_in_at ?? undefined,
			event_id: ticket.event.id,
			apple_pass_available: ticket.apple_pass_available,
			guest_name: ticket.guest_name,
			venue_name: ticket.venue_name,
			sector_name: ticket.sector_name,
			seat_label: ticket.seat_label,
			seat_row: ticket.seat_row,
			seat_number: ticket.seat_number
		}}
		eventName={ticket.event.name}
		eventDate={eventDate ?? undefined}
		eventLocation={eventLocation ?? undefined}
	/>
{/if}
