<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { VenueSectorWithSeatsSchema } from '$lib/api/generated/types.gen';
	import { Users, Edit, Trash2, Grid3X3 } from 'lucide-svelte';

	interface Props {
		sector: VenueSectorWithSeatsSchema;
		onEdit: (sector: VenueSectorWithSeatsSchema) => void;
		onDelete: (sectorId: string) => void;
		onManageSeats: (sector: VenueSectorWithSeatsSchema) => void;
	}

	let { sector, onEdit, onDelete, onManageSeats }: Props = $props();

	const seatCount = $derived(sector.seats?.length ?? 0);
</script>

<div
	class="group relative rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
>
	<div class="flex items-start justify-between gap-4">
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<h3 class="truncate text-lg font-semibold">{sector.name}</h3>
				{#if sector.code}
					<span class="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
						{sector.code}
					</span>
				{/if}
			</div>

			<div class="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
				<span class="inline-flex items-center gap-1">
					<Grid3X3 class="h-4 w-4" aria-hidden="true" />
					{#if seatCount > 0}
						{m['orgAdmin.sectors.card.seats']({ count: seatCount })}{seatCount !== 1
							? m['orgAdmin.sectors.card.seats_plural']()
							: ''}
					{:else}
						{m['orgAdmin.sectors.card.noSeats']()}
					{/if}
				</span>

				{#if sector.capacity}
					<span class="inline-flex items-center gap-1">
						<Users class="h-4 w-4" aria-hidden="true" />
						{m['orgAdmin.sectors.card.capacity']({ capacity: sector.capacity.toString() })}
					</span>
				{/if}
			</div>
		</div>

		<div class="flex shrink-0 gap-1">
			<button
				type="button"
				onclick={() => onManageSeats(sector)}
				class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={m['orgAdmin.sectors.card.manageSeats']()}
				title={m['orgAdmin.sectors.card.manageSeats']()}
			>
				<Grid3X3 class="h-4 w-4" />
			</button>
			<button
				type="button"
				onclick={() => onEdit(sector)}
				class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={m['orgAdmin.sectors.card.edit']()}
				title={m['orgAdmin.sectors.card.edit']()}
			>
				<Edit class="h-4 w-4" />
			</button>
			<button
				type="button"
				onclick={() => sector.id && onDelete(sector.id)}
				class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={m['orgAdmin.sectors.card.delete']()}
				title={m['orgAdmin.sectors.card.delete']()}
			>
				<Trash2 class="h-4 w-4" />
			</button>
		</div>
	</div>
</div>
