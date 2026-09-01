<script lang="ts">
	/**
	 * The seat editor's persistent toolbar — ONE row, fixed height, that never
	 * shifts the canvas below it as state changes. First control is the
	 * "Adjust seats" mode switch, always present; the rest of the row is one of
	 * three mutually exclusive segments occupying the SAME slot:
	 *
	 *  - idle (mode off, nothing selected): nothing else — just the toggle.
	 *  - normal-mode selection (mode off, count > 0): the bulk actions
	 *    (accessible/obstructed flags, paint, delete, clear).
	 *  - adjust mode (mode on): the "Add seat" sub-toggle, plus — once a seat
	 *    is selected — the single-seat inspector INLINE (dx/dy/rot + reset/
	 *    remove), not a second row. Formerly the inspector was a full-width row
	 *    below this bar (SeatAdjustInspector); that made the canvas visibly
	 *    snap down the moment a seat was picked (#852 follow-up). Folding it
	 *    into this same row's selection-slot, at the same fixed control height
	 *    (`h-9` on every button/input here), keeps the bar's height — and the
	 *    canvas's offsetTop below it — IDENTICAL across every state at desktop
	 *    width. Only on narrow viewports may the row wrap internally.
	 *
	 * Selection-dependent bulk actions hide during adjust mode: adjust mode's
	 * own click semantics never add to `selectedCells` (see SeatGrid's
	 * `handleCellClick`), so a bulk-selection left over from before the mode
	 * was switched on would otherwise show stale, inert-looking controls here.
	 *
	 * Explanatory copy (drag/arrow-key hint, "select a seat", rotation
	 * contract, "a seat keeps its row") is preserved for screen readers as
	 * `sr-only` text rather than visible captions — a visible caption is
	 * exactly the kind of variable-height content that reintroduces the snap
	 * this component exists to prevent.
	 *
	 * A dumb view — every mutation, and its undo point, belongs to the editor.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { Accessibility, EyeOff, Move, Paintbrush, Plus, RotateCcw, Trash2 } from '@lucide/svelte';
	import { ROW_SHIFT_LIMIT } from './row-layout';
	import {
		NUDGE_STEP,
		ROTATION_STEP,
		type NudgePatch,
		type SeatAdjustState
	} from './seat-adjust-state.svelte';

	interface Props {
		adjust: SeatAdjustState;
		count: number;
		/** True while a paint chip is armed — only then can the selection be painted. */
		canPaint: boolean;
		onToggleAccessible: () => void;
		onToggleObstructed: () => void;
		onPaint: () => void;
		onDelete: () => void;
		onClear: () => void;
		/** Label of the selected seat; `null` when nothing is selected. */
		selectedLabel: string | null;
		/** The selected seat's stored nudge, if it has one. */
		nudge: { dx?: number; dy?: number; rot?: number } | null;
		onNudgeChange: (patch: NudgePatch) => void;
		onResetSeat: () => void;
		onRemoveSeat: () => void;
	}

	const {
		adjust,
		count,
		canPaint,
		onToggleAccessible,
		onToggleObstructed,
		onPaint,
		onDelete,
		onClear,
		selectedLabel,
		nudge,
		onNudgeChange,
		onResetSeat,
		onRemoveSeat
	}: Props = $props();

	function clamp(value: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, value));
	}

	/**
	 * Guard at the input boundary (WCAG 3.3.1: prevention beats correction), so
	 * an out-of-range typed value never reaches the recipe even transiently. An
	 * emptied field reads as 0 — that IS the "no offset" value here, and the
	 * nudge drops out of the recipe entirely.
	 */
	function readNumber(raw: string, min: number, max: number): number {
		if (raw.trim() === '') return 0;
		const value = Number(raw);
		return Number.isFinite(value) ? clamp(value, min, max) : 0;
	}

	const INPUT_CLASS =
		'h-9 w-16 rounded-md border border-input bg-background px-2 text-sm text-center';
</script>

<div class="min-h-[3.75rem] rounded-lg border bg-card p-3">
	<div class="flex flex-wrap items-center gap-3">
		<button
			type="button"
			data-testid="adjust-mode-toggle"
			aria-pressed={adjust.active}
			onclick={() => adjust.toggleActive()}
			class="inline-flex h-9 items-center gap-1.5 rounded-md border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {adjust.active
				? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
				: 'border-input hover:bg-accent'}"
		>
			<Move class="h-4 w-4" aria-hidden="true" />
			{m['seatGridEditor.adjust.toggle']()}
		</button>

		{#if adjust.active}
			<button
				type="button"
				data-testid="adjust-add-seat-toggle"
				aria-pressed={adjust.addArmed}
				onclick={() => adjust.setAddArmed(!adjust.addArmed)}
				class="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {adjust.addArmed
					? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-1'
					: 'border-input hover:bg-accent'}"
			>
				<Plus class="h-4 w-4" aria-hidden="true" />
				{m['seatGridEditor.adjust.addSeat']()}
			</button>

			{#if selectedLabel !== null}
				<!-- Inline single-seat inspector — same row, same control height. -->
				<span class="text-sm font-semibold" data-testid="adjust-inspector-title">
					{m['seatGridEditor.adjust.inspectorTitle']({ seat: selectedLabel })}
				</span>
				<input
					id="adjust-dx"
					type="number"
					aria-label={m['seatGridEditor.adjust.dxLabel']()}
					step={NUDGE_STEP}
					min={-ROW_SHIFT_LIMIT}
					max={ROW_SHIFT_LIMIT}
					value={nudge?.dx ?? 0}
					oninput={(e) =>
						onNudgeChange({
							dx: readNumber(e.currentTarget.value, -ROW_SHIFT_LIMIT, ROW_SHIFT_LIMIT)
						})}
					class={INPUT_CLASS}
				/>
				<input
					id="adjust-dy"
					type="number"
					aria-label={m['seatGridEditor.adjust.dyLabel']()}
					step={NUDGE_STEP}
					min={-ROW_SHIFT_LIMIT}
					max={ROW_SHIFT_LIMIT}
					value={nudge?.dy ?? 0}
					oninput={(e) =>
						onNudgeChange({
							dy: readNumber(e.currentTarget.value, -ROW_SHIFT_LIMIT, ROW_SHIFT_LIMIT)
						})}
					class={INPUT_CLASS}
				/>
				<input
					id="adjust-rot"
					type="number"
					aria-label={m['seatGridEditor.adjust.rotLabel']()}
					step={ROTATION_STEP}
					min={-180}
					max={179}
					value={nudge?.rot ?? 0}
					aria-describedby="adjust-rot-help"
					oninput={(e) => onNudgeChange({ rot: readNumber(e.currentTarget.value, -360, 360) })}
					class={INPUT_CLASS}
				/>
				<span id="adjust-rot-help" class="sr-only">{m['seatGridEditor.adjust.rotHint']()}</span>
				<button
					type="button"
					onclick={onResetSeat}
					class="inline-flex h-9 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
					{m['seatGridEditor.adjust.resetSeat']()}
				</button>
				<button
					type="button"
					onclick={onRemoveSeat}
					class="inline-flex h-9 items-center gap-1.5 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
					{m['seatGridEditor.adjust.removeSeat']()}
				</button>
				<span class="sr-only">{m['seatGridEditor.adjust.rowNote']()}</span>
			{/if}
		{/if}

		{#if count > 0 && !adjust.active}
			<span class="text-sm font-medium">
				{m['seatGridEditor.seatsSelected']({ count })}
			</span>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={onToggleAccessible}
					class="inline-flex h-9 items-center gap-1.5 rounded-md border border-info/40 bg-info/10 px-3 text-sm font-medium text-info hover:bg-info/20"
				>
					<Accessibility class="h-4 w-4" />
					{m['seatGridEditor.toggleAccessible']()}
				</button>
				<button
					type="button"
					onclick={onToggleObstructed}
					class="inline-flex h-9 items-center gap-1.5 rounded-md border border-highlight/60 bg-highlight/10 px-3 text-sm font-medium text-highlight-foreground hover:bg-highlight/20 dark:text-highlight"
				>
					<EyeOff class="h-4 w-4" />
					{m['seatGridEditor.toggleObstructed']()}
				</button>
				{#if canPaint}
					<button
						type="button"
						onclick={onPaint}
						class="inline-flex h-9 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium hover:bg-accent"
					>
						<Paintbrush class="h-4 w-4" />
						{m['seatGridEditor.paint.applyToSelected']()}
					</button>
				{/if}
				<button
					type="button"
					onclick={onDelete}
					class="inline-flex h-9 items-center rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
				>
					{m['seatGridEditor.deleteSelected']()}
				</button>
				<button
					type="button"
					onclick={onClear}
					class="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm hover:bg-accent"
				>
					{m['seatGridEditor.clearSelection']()}
				</button>
			</div>
		{/if}
	</div>

	{#if adjust.active}
		<span class="sr-only">{m['seatGridEditor.adjust.hintOn']()}</span>
		{#if selectedLabel === null}
			<p class="sr-only" role="status">{m['seatGridEditor.adjust.noSelection']()}</p>
		{/if}
		{#if adjust.addArmed}
			<p class="sr-only" role="status">{m['seatGridEditor.adjust.addSeatHint']()}</p>
		{/if}
	{/if}
</div>
