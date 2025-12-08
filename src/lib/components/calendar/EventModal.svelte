<script lang="ts">
	import type { EventInListSchema, EventDetailSchema } from '$lib/api/generated/types.gen';
	import { goto } from '$app/navigation';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Calendar, Clock, MapPin, Building2, X } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';
	import { getImageUrl } from '$lib/utils/url';
	import * as m from '$lib/paraglide/messages.js';

	// Accept both list and detail schemas - location info only shown if available (detail schema)
	type EventSchema = EventInListSchema | EventDetailSchema;

	interface Props {
		event: EventSchema | null;
		open: boolean;
		onClose: () => void;
	}

	// Type guard to check if event has location data (EventDetailSchema)
	function hasLocationData(e: EventSchema): e is EventDetailSchema {
		return 'address' in e || 'city' in e;
	}

	let { event, open, onClose }: Props = $props();

	function handleViewDetails() {
		if (event) {
			const slug = event.organization?.slug || '';
			goto(`/events/${slug}/${event.slug}`);
		}
	}

	function handleViewOrganization() {
		if (event?.organization) {
			goto(`/org/${event.organization.slug}`);
		}
	}

	function formatTime(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleTimeString(undefined, {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}
</script>

<Dialog {open} onOpenChange={(isOpen) => !isOpen && onClose()}>
	<DialogContent class="max-h-[90vh] max-w-2xl overflow-y-auto">
		{#if event}
			<DialogHeader>
				<DialogTitle>{event.name}</DialogTitle>
			</DialogHeader>

			<div class="space-y-4">
				<!-- Cover Image -->
				{#if event.cover_art}
					<img
						src={getImageUrl(event.cover_art)}
						alt=""
						class="h-48 w-full rounded-lg object-cover"
					/>
				{/if}

				<!-- Date and Time -->
				<div class="flex items-start gap-3">
					<Calendar class="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
					<div>
						<p class="font-medium">{formatDate(event.start)}</p>
						<p class="text-sm text-muted-foreground">
							{formatTime(event.start)}{#if event.end}
								- {formatTime(event.end)}{/if}
						</p>
					</div>
				</div>

				<!-- Location (only available on EventDetailSchema) -->
				{#if hasLocationData(event) && (event.city || event.address)}
					<div class="flex items-start gap-3">
						<MapPin class="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
						<div>
							{#if event.address}
								<p class="font-medium">{event.address}</p>
							{/if}
							{#if event.city}
								<p class="text-sm text-muted-foreground">
									{event.city.name}, {event.city.country}
								</p>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Organization -->
				{#if event.organization}
					<div class="flex items-start gap-3">
						<Building2 class="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
						<button
							type="button"
							onclick={handleViewOrganization}
							class="text-left font-medium transition-colors hover:text-primary"
						>
							{event.organization.name}
						</button>
					</div>
				{/if}

				<!-- Description -->
				{#if event.description}
					<div>
						<p class="line-clamp-3 text-sm text-muted-foreground">
							{event.description}
						</p>
					</div>
				{/if}

				<!-- Actions -->
				<div class="flex gap-2 pt-4">
					<Button onclick={handleViewDetails} class="flex-1">
						{m['eventCard.viewDetails']()}
					</Button>
				</div>
			</div>
		{/if}
	</DialogContent>
</Dialog>
