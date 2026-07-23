<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { SvelteSet } from 'svelte/reactivity';
	import {
		seatAriaLabel,
		seatStatusLabel,
		type SeatView
	} from '$lib/components/tickets/seating-view';
	import { selectionStateFor, type SectorSeatGroup } from './seat-override-model';
	import { Accessibility, EyeOff } from '@lucide/svelte';

	interface Props {
		groups: SectorSeatGroup[];
		/** Selected seat ids (SvelteSet so .has() reads are reactive). */
		selected: SvelteSet<string>;
		/** Bulk-set selection for the given seat ids (row/sector/seat toggles). */
		onSetSeats: (seatIds: string[], checked: boolean) => void;
		disabled?: boolean;
	}

	const { groups, selected, onSetSeats, disabled = false }: Props = $props();

	function rowIds(seats: SeatView[]): string[] {
		return seats.map((seat) => seat.id);
	}

	function seatChipClasses(seat: SeatView, isSelected: boolean): string {
		if (isSelected) {
			return 'border-primary bg-primary/10';
		}
		switch (seat.status) {
			case 'blocked':
				return 'border-amber-500/60 bg-amber-50 dark:bg-amber-950/30';
			case 'sold':
			case 'held':
				return 'border-border/50 bg-muted/40';
			default:
				return 'border-border bg-background';
		}
	}
</script>

<div class="space-y-6">
	{#each groups as group (group.id)}
		{@const sectorState = selectionStateFor(selected, group.seatIds)}
		<section aria-label={group.name}>
			<div
				class="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 py-2 backdrop-blur"
			>
				<input
					type="checkbox"
					id={`sector-all-${group.id}`}
					class="h-4 w-4 rounded border-input accent-primary"
					checked={sectorState === 'all'}
					indeterminate={sectorState === 'some'}
					{disabled}
					onchange={(e) => onSetSeats(group.seatIds, e.currentTarget.checked)}
					aria-label={m['orgAdmin.seating.selectAllInSector']({ sector: group.name })}
				/>
				<label for={`sector-all-${group.id}`} class="text-sm font-semibold">
					{group.name}
				</label>
				<span class="text-xs text-muted-foreground">
					{m['orgAdmin.seating.sectorSeatCount']({ count: group.seatIds.length })}
				</span>
			</div>

			<div class="mt-2 space-y-2">
				{#each group.rows as row (row.rowLabel)}
					{@const ids = rowIds(row.seats)}
					{@const rowState = selectionStateFor(selected, ids)}
					<div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
						<div class="flex w-24 shrink-0 items-center gap-2">
							<input
								type="checkbox"
								id={`row-all-${group.id}-${row.rowLabel}`}
								class="h-4 w-4 rounded border-input accent-primary"
								checked={rowState === 'all'}
								indeterminate={rowState === 'some'}
								{disabled}
								onchange={(e) => onSetSeats(ids, e.currentTarget.checked)}
								aria-label={m['orgAdmin.seating.selectAllInRow']({
									row: row.rowLabel,
									sector: group.name
								})}
							/>
							<label
								for={`row-all-${group.id}-${row.rowLabel}`}
								class="text-xs font-medium text-muted-foreground"
							>
								{m['orgAdmin.seating.rowLabel']({ row: row.rowLabel })}
							</label>
						</div>
						<ul class="flex flex-1 flex-wrap gap-1.5" role="list">
							{#each row.seats as seat (seat.id)}
								{@const isSelected = selected.has(seat.id)}
								{@const status = seatStatusLabel(seat)}
								<li>
									<label
										class="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors {seatChipClasses(
											seat,
											isSelected
										)} {disabled ? 'cursor-not-allowed opacity-60' : ''}"
									>
										<input
											type="checkbox"
											class="h-3.5 w-3.5 rounded border-input accent-primary"
											checked={isSelected}
											{disabled}
											onchange={(e) => onSetSeats([seat.id], e.currentTarget.checked)}
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
