<script lang="ts">
	/**
	 * The single-seat inspector — a full-width row directly BELOW the seat
	 * editor's toolbar (`SeatSelectionActions`), above the canvas. The caller
	 * renders this only while "Adjust seats" mode is on AND a seat is selected;
	 * the mode switch and the "Add seat" sub-toggle live in the toolbar, not
	 * here (formerly this component owned both, as a side card — see #852).
	 *
	 * A dumb view over one seat's `SeatNudge` — the editor owns the (rank,
	 * adjacency_index) addressing and the undo bookkeeping.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { RotateCcw, Trash2 } from '@lucide/svelte';
	import { ROW_SHIFT_LIMIT } from './row-layout';
	import { NUDGE_STEP, ROTATION_STEP, type NudgePatch } from './seat-adjust-state.svelte';

	interface Props {
		/** Label of the selected seat — the caller only mounts this row once one is picked. */
		selectedLabel: string;
		/** The selected seat's stored nudge, if it has one. */
		nudge: { dx?: number; dy?: number; rot?: number } | null;
		onNudgeChange: (patch: NudgePatch) => void;
		onResetSeat: () => void;
		onRemoveSeat: () => void;
	}

	const { selectedLabel, nudge, onNudgeChange, onResetSeat, onRemoveSeat }: Props = $props();

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
</script>

<div class="rounded-lg border bg-card p-4">
	<h4 class="mb-2 text-sm font-semibold" data-testid="adjust-inspector-title">
		{m['seatGridEditor.adjust.inspectorTitle']({ seat: selectedLabel })}
	</h4>
	<div class="flex flex-wrap items-end gap-3">
		<div>
			<label for="adjust-dx" class="mb-1.5 block text-sm font-medium">
				{m['seatGridEditor.adjust.dxLabel']()}
			</label>
			<input
				id="adjust-dx"
				type="number"
				step={NUDGE_STEP}
				min={-ROW_SHIFT_LIMIT}
				max={ROW_SHIFT_LIMIT}
				value={nudge?.dx ?? 0}
				oninput={(e) =>
					onNudgeChange({
						dx: readNumber(e.currentTarget.value, -ROW_SHIFT_LIMIT, ROW_SHIFT_LIMIT)
					})}
				class="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
			/>
		</div>
		<div>
			<label for="adjust-dy" class="mb-1.5 block text-sm font-medium">
				{m['seatGridEditor.adjust.dyLabel']()}
			</label>
			<input
				id="adjust-dy"
				type="number"
				step={NUDGE_STEP}
				min={-ROW_SHIFT_LIMIT}
				max={ROW_SHIFT_LIMIT}
				value={nudge?.dy ?? 0}
				oninput={(e) =>
					onNudgeChange({
						dy: readNumber(e.currentTarget.value, -ROW_SHIFT_LIMIT, ROW_SHIFT_LIMIT)
					})}
				class="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
			/>
		</div>
		<div>
			<label for="adjust-rot" class="mb-1.5 block text-sm font-medium">
				{m['seatGridEditor.adjust.rotLabel']()}
			</label>
			<input
				id="adjust-rot"
				type="number"
				step={ROTATION_STEP}
				min={-180}
				max={179}
				value={nudge?.rot ?? 0}
				aria-describedby="adjust-rot-help"
				oninput={(e) => onNudgeChange({ rot: readNumber(e.currentTarget.value, -360, 360) })}
				class="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
			/>
		</div>
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				onclick={onResetSeat}
				class="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
				{m['seatGridEditor.adjust.resetSeat']()}
			</button>
			<button
				type="button"
				onclick={onRemoveSeat}
				class="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
				{m['seatGridEditor.adjust.removeSeat']()}
			</button>
		</div>
	</div>
	<p id="adjust-rot-help" class="mt-2 text-xs text-muted-foreground">
		{m['seatGridEditor.adjust.rotHint']()}
	</p>
	<p class="mt-1 text-xs text-muted-foreground">{m['seatGridEditor.adjust.rowNote']()}</p>
</div>
