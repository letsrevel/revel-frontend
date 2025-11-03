<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { UserRsvpSchema } from '$lib/api/generated/types.gen';
	import { Card } from '$lib/components/ui/card';
	import { Calendar, MapPin, CheckCircle2, XCircle, HelpCircle } from 'lucide-svelte';
	import { getImageUrl } from '$lib/utils/url';
	import { formatEventDateRange } from '$lib/utils/date';

	interface Props {
		rsvp: UserRsvpSchema;
	}

	let { rsvp }: Props = $props();

	// Format event date
	let eventDate = $derived.by(() => {
		if (!rsvp.event.start) return null;
		return formatEventDateRange(rsvp.event.start, rsvp.event.end || rsvp.event.start);
	});

	// Get event location
	let eventLocation = $derived.by(() => {
		const event = rsvp.event as any;
		return event.venue_name || event.location || null;
	});

	// Format created date
	let createdDate = $derived.by(() => {
		const date = new Date(rsvp.created_at);
		return date.toLocaleDateString();
	});

	// Get RSVP status info
	let statusInfo = $derived.by(() => {
		switch (rsvp.status) {
			case 'yes':
				return {
					label: 'Going',
					icon: CheckCircle2,
					colorClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
				};
			case 'no':
				return {
					label: 'Not Going',
					icon: XCircle,
					colorClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
				};
			case 'maybe':
				return {
					label: 'Maybe',
					icon: HelpCircle,
					colorClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
				};
			default:
				return {
					label: 'Unknown',
					icon: HelpCircle,
					colorClass: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
				};
		}
	});
</script>

<Card class="group overflow-hidden transition-shadow hover:shadow-lg">
	<div class="flex flex-col gap-4 p-4 md:p-6">
		<!-- Header with Event Info -->
		<div class="flex items-start gap-4">
			<!-- Event Logo/Icon -->
			<div class="shrink-0">
				{#if rsvp.event.logo}
					<img
						src={getImageUrl(rsvp.event.logo)}
						alt=""
						class="h-16 w-16 rounded-lg border object-cover"
					/>
				{:else if rsvp.event.cover_art}
					<img
						src={getImageUrl(rsvp.event.cover_art)}
						alt=""
						class="h-16 w-16 rounded-lg border object-cover"
					/>
				{:else}
					<div
						class="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary"
					>
						<svelte:component this={statusInfo.icon} class="h-8 w-8" aria-hidden="true" />
					</div>
				{/if}
			</div>

			<!-- Event Details -->
			<div class="min-w-0 flex-1">
				<div class="mb-2">
					<h3 class="text-lg font-semibold">
						<a
							href="/events/{rsvp.event.id}"
							class="hover:underline focus:underline focus:outline-none"
						>
							{rsvp.event.name}
						</a>
					</h3>
					<div
						class="mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {statusInfo.colorClass}"
					>
						<svelte:component this={statusInfo.icon} class="h-3 w-3" aria-hidden="true" />
						{statusInfo.label}
					</div>
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
				</dl>
			</div>
		</div>

		<!-- Footer -->
		<div
			class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm"
		>
			<div class="text-muted-foreground">
				<span class="font-medium">{m['rsvpCard.rsvpd']()}</span>
				{createdDate}
			</div>

			<a
				href="/events/{rsvp.event.id}"
				class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				View Event
			</a>
		</div>
	</div>
</Card>
