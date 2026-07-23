<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		seatAriaLabel,
		seatStatusLabel,
		type SeatView
	} from '$lib/components/tickets/seating-view';
	import type { SectorSeatGroup } from './seat-override-model';
	import { Accessibility, EyeOff } from '@lucide/svelte';

	interface Props {
		groups: SectorSeatGroup[];
		/** Currently chosen seat id (single select). */
		selectedSeatId: string | null;
		/** Which seats may be chosen; others render disabled. */
		isSelectable: (seat: SeatView) => boolean;
		/** Radio group name (must be unique on the page). */
		name: string;
		disabled?: boolean;
	}

	let {
		groups,
		selectedSeatId = $bindable(),
		isSelectable,
		name,
		disabled = false
	}: Props = $props();

	function seatChipClasses(seat: SeatView, selected: boolean, selectable: boolean): string {
		if (selected) return 'border-primary bg-primary/10';
		if (!selectable) return 'border-border/40 bg-muted/40 opacity-60';
		if (seat.status === 'blocked') return 'border-amber-500/60 bg-amber-50 dark:bg-amber-950/30';
		return 'border-border bg-background';
	}
</script>

<div
	class="space-y-6"
	role="radiogroup"
	aria-label={m['orgAdmin.seating.boxOffice.seatPickerLabel']?.() ?? 'Choose a seat'}
>
	{#each groups as group (group.id)}
		<section aria-label={group.name}>
			<div
				class="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 py-2 text-sm font-semibold backdrop-blur"
			>
				{group.name}
				<span class="text-xs font-normal text-muted-foreground">
					{m['orgAdmin.seating.sectorSeatCount']({ count: group.seatIds.length })}
				</span>
			</div>

			<div class="mt-2 space-y-2">
				{#each group.rows as row (row.rowLabel)}
					<div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
						<div class="w-24 shrink-0 pt-1 text-xs font-medium text-muted-foreground">
							{m['orgAdmin.seating.rowLabel']({ row: row.rowLabel })}
						</div>
						<ul class="flex flex-1 flex-wrap gap-1.5" role="list">
							{#each row.seats as seat (seat.id)}
								{@const selectable = isSelectable(seat)}
								{@const selected = selectedSeatId === seat.id}
								{@const status = seatStatusLabel(seat)}
								<li>
									<label
										class="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors {seatChipClasses(
											seat,
											selected,
											selectable
										)} {selectable && !disabled ? 'cursor-pointer' : 'cursor-not-allowed'}"
									>
										<input
											type="radio"
											{name}
											class="h-3.5 w-3.5 accent-primary"
											value={seat.id}
											checked={selected}
											disabled={disabled || !selectable}
											onchange={() => (selectedSeatId = seat.id)}
											aria-label={seatAriaLabel(seat)}
										/>
										<span class="font-medium">{seat.label}</span>
										{#if status}
											<span class="text-muted-foreground">({status})</span>
										{/if}
										{#if seat.isAccessible}
											<Accessibility class="h-3 w-3 text-blue-500" aria-hidden="true" />
										{/if}
										{#if seat.isObstructedView}
											<EyeOff
												class="h-3 w-3 text-amber-600 dark:text-amber-400"
												aria-hidden="true"
											/>
										{/if}
									</label>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		</section>
	{/each}
</div>
