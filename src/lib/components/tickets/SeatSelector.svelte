<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { VenueSeatSchema } from '$lib/api/generated/types.gen';
	import { Armchair, Accessibility, EyeOff, Check } from 'lucide-svelte';

	interface Props {
		seats: VenueSeatSchema[];
		selectedSeatIds: string[];
		maxSelectable: number;
		onToggle: (seatId: string) => void;
	}

	let { seats, selectedSeatIds, maxSelectable, onToggle }: Props = $props();

	// Group seats by row for grid display
	let seatsByRow = $derived(() => {
		const byRow = new Map<string, VenueSeatSchema[]>();
		for (const seat of seats) {
			const row = seat.row || '?';
			if (!byRow.has(row)) {
				byRow.set(row, []);
			}
			byRow.get(row)!.push(seat);
		}
		// Sort seats within each row by number
		for (const [row, rowSeats] of byRow) {
			rowSeats.sort((a, b) => (a.number || 0) - (b.number || 0));
		}
		// Sort rows alphabetically
		return new Map([...byRow.entries()].sort((a, b) => a[0].localeCompare(b[0])));
	});

	function isSelected(seatId: string | null | undefined): boolean {
		if (!seatId) return false;
		return selectedSeatIds.includes(seatId);
	}

	function canSelect(seatId: string | null | undefined): boolean {
		if (!seatId) return false;
		return isSelected(seatId) || selectedSeatIds.length < maxSelectable;
	}

	function handleClick(seat: VenueSeatSchema) {
		if (seat.id && seat.available) {
			onToggle(seat.id);
		}
	}
</script>

<div class="space-y-3">
	<!-- Stage indicator -->
	<div class="flex justify-center">
		<div class="rounded-lg bg-muted px-6 py-1.5 text-xs font-medium text-muted-foreground">
			{m['seatSelector.stage']?.() ?? 'STAGE'}
		</div>
	</div>

	<!-- Seat grid - horizontally scrollable on mobile -->
	<div class="overflow-x-auto">
		<div class="inline-block min-w-full">
			{#each [...seatsByRow()] as [rowLabel, rowSeats] (rowLabel)}
				<div class="flex items-center gap-1 py-0.5">
					<!-- Row label -->
					<div class="w-8 shrink-0 text-center text-xs font-medium text-muted-foreground">
						{rowLabel}
					</div>
					<!-- Seats in row -->
					<div class="flex gap-1">
						{#each rowSeats as seat (seat.id || seat.label)}
							{@const selected = isSelected(seat.id)}
							{@const canClick = seat.available && canSelect(seat.id)}
							<button
								type="button"
								onclick={() => handleClick(seat)}
								disabled={!seat.available || (!selected && !canClick)}
								class="relative flex h-9 w-9 flex-col items-center justify-center rounded-md border text-[10px] transition-all
									{selected
									? 'border-primary bg-primary text-primary-foreground shadow-sm'
									: seat.available && canClick
										? 'border-border bg-background hover:border-primary/50 hover:bg-primary/5'
										: 'cursor-not-allowed border-border/30 bg-muted/30 text-muted-foreground/50'}"
								aria-pressed={selected}
								aria-label="{m['seatSelector.seat']?.() ?? 'Seat'} {seat.label}{seat.is_accessible
									? ', ' + (m['seatSelector.accessible']?.() ?? 'accessible')
									: ''}{seat.is_obstructed_view
									? ', ' + (m['seatSelector.obstructedView']?.() ?? 'obstructed view')
									: ''}{!seat.available
									? ', ' + (m['seatSelector.unavailable']?.() ?? 'unavailable')
									: ''}"
							>
								{#if selected}
									<Check class="h-4 w-4" />
								{:else}
									<span class="font-medium">{seat.number || seat.label}</span>
								{/if}
								<!-- Indicator icons -->
								{#if seat.is_accessible || seat.is_obstructed_view}
									<div class="absolute -bottom-0.5 -right-0.5 flex gap-0.5">
										{#if seat.is_accessible}
											<Accessibility class="h-2.5 w-2.5 text-blue-500" />
										{/if}
										{#if seat.is_obstructed_view}
											<EyeOff class="h-2.5 w-2.5 text-amber-500" />
										{/if}
									</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Legend -->
	<div class="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
		<div class="flex items-center gap-1">
			<div class="h-3 w-3 rounded border border-primary bg-primary"></div>
			<span>{m['seatSelector.legendSelected']?.() ?? 'Selected'}</span>
		</div>
		<div class="flex items-center gap-1">
			<div class="h-3 w-3 rounded border border-border bg-background"></div>
			<span>{m['seatSelector.legendAvailable']?.() ?? 'Available'}</span>
		</div>
		<div class="flex items-center gap-1">
			<div class="h-3 w-3 rounded border border-border/30 bg-muted/30"></div>
			<span>{m['seatSelector.legendUnavailable']?.() ?? 'Unavailable'}</span>
		</div>
		<div class="flex items-center gap-1">
			<Accessibility class="h-3 w-3 text-blue-500" />
			<span>{m['seatSelector.legendAccessible']?.() ?? 'Accessible'}</span>
		</div>
		<div class="flex items-center gap-1">
			<EyeOff class="h-3 w-3 text-amber-500" />
			<span>{m['seatSelector.legendObstructed']?.() ?? 'Obstructed'}</span>
		</div>
	</div>
</div>
