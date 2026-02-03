<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { VenueDetailSchema, CitySchema } from '$lib/api/generated/types.gen';
	import { MapPin, Users, Edit, Trash2, LayoutGrid } from 'lucide-svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';

	interface Props {
		venue: VenueDetailSchema;
		onEdit: (venue: VenueDetailSchema) => void;
		onDelete: (venueId: string) => void;
		onManageSectors: (venue: VenueDetailSchema) => void;
	}

	let { venue, onEdit, onDelete, onManageSectors }: Props = $props();

	const sectorCount = $derived(venue.sectors?.length ?? 0);

	function formatCity(city: CitySchema): string {
		const parts = [city.name];
		if (city.admin_name) parts.push(city.admin_name);
		parts.push(city.country);
		return parts.join(', ');
	}
</script>

<div
	class="group relative rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
>
	<div class="flex items-start justify-between gap-4">
		<div class="min-w-0 flex-1">
			<h3 class="truncate text-lg font-semibold">{venue.name}</h3>
			{#if venue.description}
				<div class="mt-1 line-clamp-2 text-sm text-muted-foreground">
					<MarkdownContent content={venue.description} inline={true} class="!prose-sm" />
				</div>
			{/if}

			<div class="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
				{#if venue.city || venue.address}
					<span class="inline-flex items-center gap-1">
						<MapPin class="h-4 w-4" aria-hidden="true" />
						{venue.city ? formatCity(venue.city) : venue.address || ''}
					</span>
				{/if}

				<span class="inline-flex items-center gap-1">
					<LayoutGrid class="h-4 w-4" aria-hidden="true" />
					{m['orgAdmin.venues.card.sectors']({ count: sectorCount })}{sectorCount !== 1
						? m['orgAdmin.venues.card.sectors_plural']()
						: ''}
				</span>

				<span class="inline-flex items-center gap-1">
					<Users class="h-4 w-4" aria-hidden="true" />
					{#if venue.capacity}
						{m['orgAdmin.venues.card.capacity']({ capacity: venue.capacity.toString() })}
					{:else}
						{m['orgAdmin.venues.card.noCapacity']()}
					{/if}
				</span>
			</div>
		</div>

		<div class="flex shrink-0 gap-1">
			<button
				type="button"
				onclick={() => onManageSectors(venue)}
				class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={m['orgAdmin.venues.card.manageSectors']()}
				title={m['orgAdmin.venues.card.manageSectors']()}
			>
				<LayoutGrid class="h-4 w-4" />
			</button>
			<button
				type="button"
				onclick={() => onEdit(venue)}
				class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={m['orgAdmin.venues.card.edit']()}
				title={m['orgAdmin.venues.card.edit']()}
			>
				<Edit class="h-4 w-4" />
			</button>
			<button
				type="button"
				onclick={() => venue.id && onDelete(venue.id)}
				class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={m['orgAdmin.venues.card.delete']()}
				title={m['orgAdmin.venues.card.delete']()}
			>
				<Trash2 class="h-4 w-4" />
			</button>
		</div>
	</div>
</div>
