<script lang="ts">
	/**
	 * The "Adjust seats" mode switch and the single-seat inspector, sitting
	 * directly under the row-geometry panel in the editor's side column.
	 *
	 * The mode is the deliberate FRICTION: only while it is on does a click on
	 * the grid select a seat and a drag move it. Everything here is a dumb view
	 * over `SeatAdjustState` plus one seat's `SeatNudge` — the editor owns the
	 * (rank, adjacency_index) addressing and the undo bookkeeping.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { Move, Plus, RotateCcw, Trash2 } from '@lucide/svelte';
	import { ROW_SHIFT_LIMIT } from './row-layout';
	import {
		NUDGE_STEP,
		ROTATION_STEP,
		type NudgePatch,
		type SeatAdjustState
	} from './seat-adjust-state.svelte';

	interface Props {
		adjust: SeatAdjustState;
		/** Label of the selected seat; `null` when nothing is selected. */
		selectedLabel: string | null;
		/** The selected seat's stored nudge, if it has one. */
		nudge: { dx?: number; dy?: number; rot?: number } | null;
		onNudgeChange: (patch: NudgePatch) => void;
		onResetSeat: () => void;
		onRemoveSeat: () => void;
	}

	const { adjust, selectedLabel, nudge, onNudgeChange, onResetSeat, onRemoveSeat }: Props =
		$props();

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
	<h3 class="mb-1 font-semibold">{m['seatGridEditor.adjust.title']()}</h3>
	<p class="mb-3 text-xs text-muted-foreground">{m['seatGridEditor.adjust.explainer']()}</p>

	<button
		type="button"
		data-testid="adjust-mode-toggle"
		aria-pressed={adjust.active}
		onclick={() => adjust.toggleActive()}
		class="inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {adjust.active
			? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
			: 'border-input hover:bg-accent'}"
	>
		<Move class="h-4 w-4" aria-hidden="true" />
		{m['seatGridEditor.adjust.toggle']()}
	</button>

	{#if adjust.active}
		<p class="mt-3 text-xs text-muted-foreground">{m['seatGridEditor.adjust.hintOn']()}</p>

		<div class="mt-3 border-t pt-3">
			<button
				type="button"
				data-testid="adjust-add-seat-toggle"
				aria-pressed={adjust.addArmed}
				onclick={() => adjust.setAddArmed(!adjust.addArmed)}
				class="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {adjust.addArmed
					? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-1'
					: 'border-input hover:bg-accent'}"
			>
				<Plus class="h-4 w-4" aria-hidden="true" />
				{m['seatGridEditor.adjust.addSeat']()}
			</button>
			{#if adjust.addArmed}
				<p class="mt-2 text-xs text-muted-foreground" role="status">
					{m['seatGridEditor.adjust.addSeatHint']()}
				</p>
			{/if}
		</div>

		<div class="mt-3 border-t pt-3">
			{#if selectedLabel === null}
				<p class="text-xs text-muted-foreground">{m['seatGridEditor.adjust.noSelection']()}</p>
			{:else}
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
				</div>
				<p id="adjust-rot-help" class="mt-2 text-xs text-muted-foreground">
					{m['seatGridEditor.adjust.rotHint']()}
				</p>
				<p class="mt-1 text-xs text-muted-foreground">{m['seatGridEditor.adjust.rowNote']()}</p>
				<div class="mt-3 flex flex-wrap gap-2">
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
			{/if}
		</div>
	{/if}
</div>
