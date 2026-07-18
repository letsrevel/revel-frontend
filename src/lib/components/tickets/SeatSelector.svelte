<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { rowsFromSeatViews, seatAriaLabel, type SeatView } from './seating-view';
	import { Accessibility, EyeOff, Check, X, LoaderCircle } from '@lucide/svelte';

	interface Props {
		seats: SeatView[];
		onToggle: (seatId: string) => void;
		/** Quantity reached: available seats become inert (consumer shows the hint). */
		maxReached?: boolean;
		/** Disable the whole grid (e.g. while confirming the purchase). */
		disabled?: boolean;
	}

	const { seats, onToggle, maxReached = false, disabled = false }: Props = $props();

	const rows = $derived(rowsFromSeatViews(seats));
	const hasMine = $derived(seats.some((seat) => seat.status === 'mine'));

	function isSeatDisabled(seat: SeatView): boolean {
		if (disabled) return true;
		switch (seat.status) {
			case 'mine':
				return false;
			case 'available':
				return maxReached;
			case 'pending':
				// Keep focusable so keyboard focus survives the hold round-trip
				// (a disabled attribute would blur the just-pressed button).
				// Double-toggle is guarded: handleClick ignores non-mine/available
				// statuses and toggleSeat ignores ids already in pendingSeatIds.
				return false;
			default:
				// sold, held, blocked
				return true;
		}
	}

	function seatClasses(seat: SeatView): string {
		switch (seat.status) {
			case 'mine':
				return 'border-primary bg-primary text-primary-foreground shadow-sm';
			case 'pending':
				return 'border-primary/50 bg-primary/10 text-primary';
			case 'available':
				return disabled || maxReached
					? 'cursor-not-allowed border-border bg-background opacity-60'
					: 'border-border bg-background hover:border-primary/50 hover:bg-primary/5';
			default:
				// sold, held, blocked
				return 'cursor-not-allowed border-border/30 bg-muted/30 text-muted-foreground/50';
		}
	}

	function handleClick(seat: SeatView) {
		if (seat.status === 'mine' || seat.status === 'available') {
			onToggle(seat.id);
		}
	}
</script>

<div class="space-y-3">
	<!-- Stage indicator -->
	<div class="flex justify-center">
		<div class="rounded-lg bg-muted px-6 py-1.5 text-xs font-medium text-muted-foreground">
			{m['seatSelector.stage']()}
		</div>
	</div>

	<!-- Seat grid - horizontally scrollable on mobile; height-capped so the
	     hold notice and legend below stay visible on large charts -->
	<div class="max-h-64 overflow-auto">
		<div class="inline-block min-w-full">
			{#each rows as row (row.rowLabel)}
				<div class="flex items-center gap-1 py-0.5">
					<!-- Row label -->
					<div class="w-8 shrink-0 text-center text-xs font-medium text-muted-foreground">
						{row.rowLabel}
					</div>
					<!-- Seats in row -->
					<div class="flex gap-1">
						{#each row.seats as seat (seat.id)}
							<button
								type="button"
								onclick={() => handleClick(seat)}
								disabled={isSeatDisabled(seat)}
								class="relative flex h-9 w-9 flex-col items-center justify-center rounded-md border text-[10px] transition-all [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 {seatClasses(
									seat
								)}"
								aria-pressed={seat.status === 'mine'}
								aria-busy={seat.status === 'pending'}
								aria-disabled={seat.status === 'pending' ? true : undefined}
								aria-label={seatAriaLabel(seat)}
							>
								{#if seat.status === 'mine'}
									<Check class="h-4 w-4" aria-hidden="true" />
								{:else if seat.status === 'pending'}
									<LoaderCircle class="h-4 w-4 animate-spin" aria-hidden="true" />
								{:else if seat.status === 'available'}
									<span class="font-medium">{seat.number ?? seat.label}</span>
								{:else}
									<!-- sold / held / blocked: icon, not color alone -->
									<X class="h-3.5 w-3.5" aria-hidden="true" />
								{/if}
								<!-- Indicator icons -->
								{#if seat.isAccessible || seat.isObstructedView}
									<div class="absolute -bottom-0.5 -right-0.5 flex gap-0.5">
										{#if seat.isAccessible}
											<Accessibility class="h-2.5 w-2.5 text-blue-500" aria-hidden="true" />
										{/if}
										{#if seat.isObstructedView}
											<EyeOff
												class="h-2.5 w-2.5 text-amber-600 dark:text-amber-400"
												aria-hidden="true"
											/>
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

	<!-- Rendered unconditionally so the live region exists before the message
	     appears (regions inserted with their content are often not announced) -->
	<p role="status" class="text-center text-xs text-muted-foreground">
		{#if hasMine}
			{m['seatSelector.heldForTenMinutes']()}
		{/if}
	</p>

	<!-- Legend -->
	<div class="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
		<div class="flex items-center gap-1">
			<div
				class="flex h-3 w-3 items-center justify-center rounded border border-primary bg-primary"
			>
				<Check class="h-2 w-2 text-primary-foreground" aria-hidden="true" />
			</div>
			<span>{m['seatSelector.legendSelected']()}</span>
		</div>
		<div class="flex items-center gap-1">
			<div class="h-3 w-3 rounded border border-border bg-background"></div>
			<span>{m['seatSelector.legendAvailable']()}</span>
		</div>
		<div class="flex items-center gap-1">
			<div
				class="flex h-3 w-3 items-center justify-center rounded border border-border/30 bg-muted/30"
			>
				<X class="h-2 w-2 text-muted-foreground/70" aria-hidden="true" />
			</div>
			<span>{m['seatSelector.legendUnavailable']()}</span>
		</div>
		<div class="flex items-center gap-1">
			<Accessibility class="h-3 w-3 text-blue-500" aria-hidden="true" />
			<span>{m['seatSelector.legendAccessible']()}</span>
		</div>
		<div class="flex items-center gap-1">
			<EyeOff class="h-3 w-3 text-amber-600 dark:text-amber-400" aria-hidden="true" />
			<span>{m['seatSelector.legendObstructed']()}</span>
		</div>
	</div>
</div>
