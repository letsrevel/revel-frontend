<script lang="ts">
	/**
	 * Floor management for the sector-block arranger (#680) — pure presentation
	 * over DesignerFloorState. One chip per floor switches the canvas (each
	 * floor is its own view of the world plane); the active floor can be
	 * renamed, reordered or deleted, and a selected block can be moved to
	 * another floor (the canvas follows it). Deleting a floor that still has
	 * sectors — explicitly or implicitly (unassigned blocks live on the first
	 * floor by convention) — is refused with a deterministic message.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { ChevronLeft, ChevronRight, Layers, Plus, Trash2 } from '@lucide/svelte';
	import type { DesignerFloorState } from './designer-floors.svelte';

	interface Props {
		floorState: DesignerFloorState;
		selectedSectorId: string | null;
		/** Switch the active canvas floor (the parent also fixes the selection). */
		onActivateFloor: (floorId: string) => void;
	}

	const { floorState, selectedSectorId, onActivateFloor }: Props = $props();

	const uid = $props.id();
	let deleteError = $state('');
	/** Polite announcement: the canvas content swaps under AT on a switch. */
	let announcement = $state('');

	const activeIndex = $derived(
		floorState.floors.findIndex((floor) => floor.id === floorState.activeFloorId)
	);

	const chipBase =
		'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ' +
		'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ' +
		'[@media(pointer:coarse)]:py-2.5';
	const chipClass = (active: boolean) =>
		active
			? `${chipBase} bg-background text-foreground shadow-sm`
			: `${chipBase} text-muted-foreground hover:text-foreground`;
	const buttonClass =
		'inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 ' +
		'text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none ' +
		'focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

	function announceFloor(name: string): void {
		announcement = m['seatMap.floorShown']({ name });
	}

	function activate(floorId: string, name: string): void {
		deleteError = '';
		announceFloor(name);
		onActivateFloor(floorId);
	}

	function handleAdd(): void {
		deleteError = '';
		const floor = floorState.addFloor(
			m['seatDesigner.defaultFloorName']({ number: floorState.floors.length + 1 })
		);
		announceFloor(floor.name);
	}

	function handleRename(event: Event & { currentTarget: HTMLInputElement }): void {
		const active = floorState.activeFloor;
		if (!active) return;
		const value = event.currentTarget.value.trim();
		if (value) floorState.renameFloor(active.id, value);
		else event.currentTarget.value = active.name;
	}

	function handleMove(delta: -1 | 1): void {
		if (floorState.activeFloorId) floorState.moveFloor(floorState.activeFloorId, delta);
	}

	function handleDelete(): void {
		const active = floorState.activeFloor;
		if (!active) return;
		const sectors = floorState.sectorNamesOn(active.id);
		if (sectors.length > 0) {
			deleteError = m['seatDesigner.deleteFloorBlocked']({
				name: active.name,
				sectors: sectors.join(', ')
			});
			return;
		}
		deleteError = '';
		floorState.deleteFloor(active.id);
		const next = floorState.activeFloor;
		if (next) announceFloor(next.name);
	}

	/** Move the selected block to another floor; the canvas follows it. */
	function handleMoveBlock(event: Event & { currentTarget: HTMLSelectElement }): void {
		const floorId = event.currentTarget.value;
		const floor = floorState.floors.find((candidate) => candidate.id === floorId);
		if (!selectedSectorId || !floor) return;
		deleteError = '';
		floorState.moveBlockToFloor(selectedSectorId, floor.id);
		announceFloor(floor.name);
		onActivateFloor(floor.id);
	}
</script>

<div class="space-y-2">
	<div class="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
		<span class="flex items-center gap-1.5 text-sm font-medium">
			<Layers class="h-4 w-4" aria-hidden="true" />
			{m['seatDesigner.floorsLabel']()}
		</span>

		{#if floorState.hasFloors}
			<div
				role="group"
				aria-label={m['seatMap.floorSwitcherLabel']()}
				class="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
			>
				{#each floorState.floors as floor (floor.id)}
					<button
						type="button"
						aria-pressed={floor.id === floorState.activeFloorId}
						class={chipClass(floor.id === floorState.activeFloorId)}
						onclick={() => activate(floor.id, floor.name)}
					>
						{floor.name}
					</button>
				{/each}
			</div>
		{:else}
			<span class="text-sm text-muted-foreground">{m['seatDesigner.floorsHint']()}</span>
		{/if}

		<button type="button" class={buttonClass} onclick={handleAdd}>
			<Plus class="h-4 w-4" aria-hidden="true" />
			{m['seatDesigner.addFloor']()}
		</button>

		{#if floorState.activeFloor}
			<div class="ms-auto flex flex-wrap items-center gap-2">
				<label class="flex items-center gap-2 text-sm" for="{uid}-floor-name">
					<span class="sr-only">{m['seatDesigner.floorNameLabel']()}</span>
					<input
						id="{uid}-floor-name"
						type="text"
						class="h-9 w-36 rounded-md border border-input bg-background px-2 text-sm"
						value={floorState.activeFloor.name}
						onchange={handleRename}
					/>
				</label>
				<button
					type="button"
					class={buttonClass}
					aria-label={m['seatDesigner.moveFloorEarlier']()}
					disabled={activeIndex <= 0}
					onclick={() => handleMove(-1)}
				>
					<ChevronLeft class="h-4 w-4" aria-hidden="true" />
				</button>
				<button
					type="button"
					class={buttonClass}
					aria-label={m['seatDesigner.moveFloorLater']()}
					disabled={activeIndex === -1 || activeIndex >= floorState.floors.length - 1}
					onclick={() => handleMove(1)}
				>
					<ChevronRight class="h-4 w-4" aria-hidden="true" />
				</button>
				<button type="button" class={buttonClass} onclick={handleDelete}>
					<Trash2 class="h-4 w-4" aria-hidden="true" />
					{m['seatDesigner.deleteFloor']()}
				</button>
			</div>
		{/if}

		{#if selectedSectorId && floorState.hasFloors}
			<label class="flex items-center gap-2 text-sm" for="{uid}-move-block">
				<span class="font-medium">{m['seatDesigner.moveBlockToFloor']()}</span>
				<select
					id="{uid}-move-block"
					class="h-9 rounded-md border border-input bg-background px-2 text-sm"
					value={floorState.effectiveFloorOf(selectedSectorId) ?? ''}
					onchange={handleMoveBlock}
				>
					{#each floorState.floors as floor (floor.id)}
						<option value={floor.id}>{floor.name}</option>
					{/each}
				</select>
			</label>
		{/if}
	</div>

	{#if deleteError}
		<p class="text-sm font-medium text-destructive" role="alert">{deleteError}</p>
	{/if}

	<span class="sr-only" aria-live="polite">{announcement}</span>
</div>
