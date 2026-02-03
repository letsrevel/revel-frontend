<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { VenueSchema } from '$lib/api/generated/types.gen';
	import * as Dialog from '$lib/components/ui/dialog';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import { ExternalLink, MapPin, Users } from 'lucide-svelte';

	interface Props {
		open: boolean;
		venue: VenueSchema;
		onClose: () => void;
	}

	let { open = $bindable(), venue, onClose }: Props = $props();

	// Build the full address display
	let fullAddress = $derived.by(() => {
		const parts: string[] = [];

		if (venue.address) {
			parts.push(venue.address);
		}

		if (venue.city) {
			const cityPart = venue.city.country
				? `${venue.city.name}, ${venue.city.country}`
				: venue.city.name;
			parts.push(cityPart);
		}

		return parts.join(', ');
	});

	// Check if venue has meaningful additional info
	let hasDescription = $derived(!!venue.description?.trim());
	let hasCapacity = $derived(!!venue.capacity && venue.capacity > 0);
	let hasMapEmbed = $derived(!!venue.location_maps_embed);
	let hasMapsUrl = $derived(!!venue.location_maps_url);

	function handleOpenChange(newOpen: boolean) {
		if (!newOpen) {
			onClose();
		}
		open = newOpen;
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{venue.name}</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-4">
			<!-- Address -->
			{#if fullAddress}
				<div class="flex items-start gap-3">
					<MapPin class="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
					<div>
						<p class="text-sm font-medium text-muted-foreground">
							{m['venueInfo.address']()}
						</p>
						<p class="text-sm">{fullAddress}</p>
					</div>
				</div>
			{/if}

			<!-- Capacity -->
			{#if hasCapacity}
				<div class="flex items-start gap-3">
					<Users class="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
					<div>
						<p class="text-sm font-medium text-muted-foreground">
							{m['venueInfo.capacity']()}
						</p>
						<p class="text-sm">
							{m['venueInfo.capacityPeople']({ count: venue.capacity! })}
						</p>
					</div>
				</div>
			{/if}

			<!-- Google Maps Link -->
			{#if hasMapsUrl}
				<a
					href={venue.location_maps_url}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-2 text-sm text-primary hover:underline"
				>
					<ExternalLink class="h-4 w-4" aria-hidden="true" />
					{m['venueInfo.viewOnMaps']()}
				</a>
			{/if}

			<!-- Map Embed -->
			{#if hasMapEmbed}
				<div class="overflow-hidden rounded-lg border">
					<iframe
						src={venue.location_maps_embed}
						width="100%"
						height="200"
						style="border:0;"
						allowfullscreen
						loading="lazy"
						referrerpolicy="no-referrer-when-downgrade"
						title="Map of {venue.name}"
					></iframe>
				</div>
			{/if}

			<!-- Description -->
			{#if hasDescription}
				<div class="border-t pt-4">
					<p class="mb-2 text-sm font-medium text-muted-foreground">
						{m['venueInfo.about']()}
					</p>
					<MarkdownContent content={venue.description} class="text-sm" />
				</div>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
