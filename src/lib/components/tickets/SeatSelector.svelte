<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { TierSeatPricingSchema } from '$lib/api/generated/types.gen';
	import { formatMoney } from '$lib/utils/format';
	import { resolveSeatPrice } from './seat-pricing';
	import { rowsFromSeatViews, seatAriaLabel, type SeatView } from './seating-view';
	import { Accessibility, EyeOff, Check, X, LoaderCircle } from '@lucide/svelte';

	interface Props {
		seats: SeatView[];
		onToggle: (seatId: string) => void;
		/** Quantity reached: available seats become inert (consumer shows the hint). */
		maxReached?: boolean;
		/** Disable the whole grid (e.g. while confirming the purchase). */
		disabled?: boolean;
		/** Server-resolved per-category prices (user_choice tiers, #668). */
		seatPricing?: TierSeatPricingSchema | null;
		/** Tier currency for price display (seat_pricing carries bare decimals). */
		currency?: string | null;
	}

	const {
		seats,
		onToggle,
		maxReached = false,
		disabled = false,
		seatPricing = null,
		currency = null
	}: Props = $props();

	/** Shared accessible name + per-seat price (dumb server-resolved lookup). */
	function seatLabelWithPrice(seat: SeatView): string {
		const base = seatAriaLabel(seat);
		const info = resolveSeatPrice(seatPricing, seat.priceCategoryId);
		if (info?.available && info.price != null) {
			return `${base}, ${formatMoney(info.price, currency)}`;
		}
		return base;
	}

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

	/**
	 * Seat look on the INK stage panel (uplift prototype — see the panel comment
	 * in the markup for why this surface is mode-inert).
	 *
	 * Every pair here is hand-verified against the fixed poster values, because
	 * a poster-palette pair is invisible to scripts/audit-brand-themes.py, and
	 * every status is carried by a GLYPH as well as a fill (check / spinner /
	 * number / ✕), so nothing is encoded by colour alone. Ratios below are the
	 * audit script's own numbers for the HSL tokens (`poster-white on
	 * poster-ink` prints 17.40; the literal #0D1E1C hex is 17.22):
	 *   white  #FFFFFF on ink → 17.40:1  (available seat, ink number)
	 *   purple #8C3CDD on ink →  3.15:1  (selected seat; non-text, ≥3:1 — and
	 *                                     only just, so it stays glyph-carried)
	 *   white  #FFFFFF on purple → 5.52:1 (the check glyph on it)
	 * The unavailable fill is deliberately faint (white@15): it is inert, its
	 * ✕ is a decorative duplicate of the accessible name (seatAriaLabel already
	 * says "sold"/"held"/"blocked"), so SC 1.4.11 does not bite on it.
	 *
	 * SELECTION USES `ring-*`, NOT `outline-*`, ON PURPOSE. An unconditional
	 * `outline` utility sets outline-style on the button and so SWALLOWS the
	 * UA's :focus-visible ring — a selected seat would have had no visible
	 * keyboard focus indicator at all (WCAG 2.4.7). The app defines no global
	 * focus-visible rule to fall back on, so the shared button class below
	 * carries an explicit amber focus outline for EVERY state (amber on ink is
	 * 9.42:1; the outline sits in the offset gap, i.e. against the ink panel,
	 * not against the seat fill).
	 */
	function seatClasses(seat: SeatView): string {
		switch (seat.status) {
			case 'mine':
				return 'bg-poster-purple text-poster-white ring-2 ring-poster-white ring-offset-2 ring-offset-poster-ink';
			case 'pending':
				return 'bg-poster-white/30 text-poster-white';
			case 'available':
				return disabled || maxReached
					? 'cursor-not-allowed bg-poster-white/40 text-poster-ink'
					: 'bg-poster-white text-poster-ink hover:-translate-y-0.5 hover:ring-2 hover:ring-poster-purple hover:ring-offset-2 hover:ring-offset-poster-ink';
			default:
				// sold, held, blocked
				return 'cursor-not-allowed bg-poster-white/15 text-poster-white/70';
		}
	}

	/**
	 * Shared seat-button chrome. The focus outline is explicit and lives here so
	 * it applies to every status — including `mine`, whose ring would otherwise
	 * be the only thing a keyboard user sees change.
	 */
	const seatButtonClass =
		'relative flex h-9 w-9 flex-col items-center justify-center rounded-full text-[11px] font-extrabold ' +
		'transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
		'focus-visible:outline-poster-amber [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11';

	/**
	 * Indicator-icon colour per status.
	 *
	 * Ink carries the LIGHT fills — white 17.40:1, white@40 (disabled) 3.79:1,
	 * purple 3.15:1 — but on the faint white@15 unavailable fill ink measures
	 * **1.58:1**, i.e. it vanishes. Those seats get white@70 instead, which is
	 * 6.35:1 on that fill. (Pending's white@30 fill is the weakest ink pairing
	 * at 2.70:1; it is a sub-second transient with a spinner already on it, so
	 * it keeps ink rather than flickering colour mid-hold.)
	 *
	 * These icons are decorative duplicates — seatAriaLabel already names
	 * "accessible" / "obstructed view" — so SC 1.4.11 does not bite. That is a
	 * reason not to panic, not a reason to let the cue disappear.
	 */
	function indicatorClass(seat: SeatView): string {
		const unavailable =
			seat.status !== 'mine' && seat.status !== 'pending' && seat.status !== 'available';
		return unavailable ? 'text-poster-white/70' : 'text-poster-ink';
	}

	function handleClick(seat: SeatView) {
		if (seat.status === 'mine' || seat.status === 'available') {
			onToggle(seat.id);
		}
	}

	/** One solid legend chip on the ink panel (the mock's chip legend). */
	const legendChipClass =
		'inline-flex items-center gap-1.5 rounded-full bg-poster-white/[0.12] px-2.5 py-1 text-poster-white';
</script>

<!--
	The landing's SeatMapMock, made real (uplift prototype). The stage panel is a
	mode-INERT ink card in both themes — the one place in the app where that is
	the right call rather than a shortcut: this is a picture of a room, the mock
	draws it exactly this way, and a dark house makes both the seat states and
	the organizer's own price-category colours read at a glance. Its text pairs
	are hand-verified (see seatClasses); everything OUTSIDE the panel — the hold
	notice, the dialog around it — stays on theme tokens.
-->
<div class="space-y-3">
	<div class="rounded-[1.5rem] bg-poster-ink p-4 shadow-poster sm:p-5">
		<!-- Stage indicator: the mock's pill — flat-bottomed, round-topped, wide
		     tracking. white@14 over ink composites to a near-ink strip, so the
		     full-opacity white label on it is 11.42:1 (hand-verified; a composited
		     alpha is invisible to scripts/audit-brand-themes.py). -->
		<p
			class="rounded-b-md rounded-t-full bg-poster-white/[0.14] py-1.5 text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-poster-white"
		>
			{m['seatSelector.stage']()}
		</p>

		<!-- Seat grid - horizontally scrollable on mobile; height-capped so the
		     hold notice and legend below stay visible on large charts -->
		<div class="mt-4 max-h-64 overflow-auto">
			<div class="inline-block min-w-full">
				{#each rows as row (row.rowLabel)}
					<div class="flex items-center gap-1.5 py-1">
						<!-- Row label -->
						<div class="w-8 shrink-0 text-center text-xs font-extrabold text-poster-white/80">
							{row.rowLabel}
						</div>
						<!-- Seats in row -->
						<div class="flex gap-1.5">
							{#each row.seats as seat (seat.id)}
								<button
									type="button"
									onclick={() => handleClick(seat)}
									disabled={isSeatDisabled(seat)}
									class="{seatButtonClass} {seatClasses(seat)}"
									aria-pressed={seat.status === 'mine'}
									aria-busy={seat.status === 'pending'}
									aria-disabled={seat.status === 'pending' ? true : undefined}
									aria-label={seatLabelWithPrice(seat)}
									title={seatLabelWithPrice(seat)}
								>
									{#if seat.status === 'mine'}
										<Check class="h-4 w-4" aria-hidden="true" />
									{:else if seat.status === 'pending'}
										<LoaderCircle class="h-4 w-4 animate-spin" aria-hidden="true" />
									{:else if seat.status === 'available'}
										<span>{seat.number ?? seat.label}</span>
									{:else}
										<!-- sold / held / blocked: icon, not color alone -->
										<X class="h-3.5 w-3.5" aria-hidden="true" />
									{/if}
									<!-- Indicator icons. Decorative duplicates — seatAriaLabel
									     already names "accessible" / "obstructed view", so SC 1.4.11
									     does not bite — and they differ by SHAPE, not colour. Colour
									     per status via indicatorClass (ink on the light fills,
									     white@70 on the faint unavailable one, where ink is 1.58:1
									     and would vanish). These replaced two raw palette hues from
									     the pre-sweep version; the class names are spelled out in
									     the sweep-rule docs rather than here, so Tailwind's source
									     scanner does not emit them as live utilities. -->
									{#if seat.isAccessible || seat.isObstructedView}
										{@const indicator = indicatorClass(seat)}
										<div class="absolute -bottom-0.5 -right-0.5 flex gap-0.5">
											{#if seat.isAccessible}
												<Accessibility class="h-2.5 w-2.5 {indicator}" aria-hidden="true" />
											{/if}
											{#if seat.isObstructedView}
												<EyeOff class="h-2.5 w-2.5 {indicator}" aria-hidden="true" />
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

		<!-- Legend: solid chips on the ink panel, like the mock's. Every swatch is
		     paired with its own label, so no meaning is colour-only — and the
		     swatches are decorative duplicates of that text, which is why the
		     faint "unavailable" chip is allowed to be faint. Full white on the
		     white@12 chip measures 12.23:1 (hand-verified). -->
		<div class="mt-4 flex flex-wrap justify-center gap-1.5 text-[11px] font-bold">
			<span class={legendChipClass}>
				<span
					class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-poster-purple outline outline-1 outline-offset-1 outline-poster-white"
					aria-hidden="true"
				>
					<Check class="h-2 w-2 text-poster-white" />
				</span>
				{m['seatSelector.legendSelected']()}
			</span>
			<span class={legendChipClass}>
				<span class="h-3.5 w-3.5 shrink-0 rounded-full bg-poster-white" aria-hidden="true"></span>
				{m['seatSelector.legendAvailable']()}
			</span>
			<span class={legendChipClass}>
				<span
					class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-poster-white/15"
					aria-hidden="true"
				>
					<X class="h-2 w-2 text-poster-white/70" />
				</span>
				{m['seatSelector.legendUnavailable']()}
			</span>
			<span class={legendChipClass}>
				<Accessibility class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
				{m['seatSelector.legendAccessible']()}
			</span>
			<span class={legendChipClass}>
				<EyeOff class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
				{m['seatSelector.legendObstructed']()}
			</span>
		</div>
	</div>

	<!-- Rendered unconditionally so the live region exists before the message
	     appears (regions inserted with their content are often not announced) -->
	<p role="status" class="text-center text-xs text-muted-foreground">
		{#if hasMine}
			{m['seatSelector.heldForTenMinutes']()}
		{/if}
	</p>
</div>
