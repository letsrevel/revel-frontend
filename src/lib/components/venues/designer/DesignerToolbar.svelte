<script lang="ts">
	/**
	 * Toolbar for the sector-block arranger: a selection picker (stage + every
	 * sector), a grid-snap toggle, per-selection shape controls, the grid-editor
	 * link and the Save button. Pure presentation — all state lives in
	 * SeatMapDesigner.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { LayoutGrid, Magnet, PencilRuler, Trash2 } from '@lucide/svelte';

	interface SectorOption {
		id: string;
		name: string;
	}

	interface Props {
		blocks: SectorOption[];
		/** '' (nothing), 'stage', or a sector id. */
		selectionValue: string;
		selectedSectorId: string | null;
		mode: 'arrange' | 'shape';
		snapOn: boolean;
		selectedHasShape: boolean;
		shapeInvalid: boolean;
		dirty: boolean;
		isSaving: boolean;
		sectorEditorHref: (sectorId: string) => string;
		onSelectChange: (value: string) => void;
		onSnapToggle: () => void;
		onEnterShapeMode: () => void;
		onExitShapeMode: () => void;
		onClearShape: () => void;
		onSave: () => void;
	}

	const {
		blocks,
		selectionValue,
		selectedSectorId,
		mode,
		snapOn,
		selectedHasShape,
		shapeInvalid,
		dirty,
		isSaving,
		sectorEditorHref,
		onSelectChange,
		onSnapToggle,
		onEnterShapeMode,
		onExitShapeMode,
		onClearShape,
		onSave
	}: Props = $props();

	const uid = $props.id();

	const buttonClass = (active: boolean) =>
		`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors ` +
		`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
			active
				? 'border-primary bg-primary text-primary-foreground'
				: 'border-input bg-background hover:bg-accent'
		}`;

	const hasSelection = $derived(selectionValue !== '');
</script>

<div class="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
	<label class="flex items-center gap-2 text-sm" for="{uid}-selection">
		<span class="font-medium">{m['seatDesigner.selectTarget']?.() ?? 'Selection'}</span>
		<select
			id="{uid}-selection"
			class="h-9 rounded-md border border-input bg-background px-2 text-sm"
			value={selectionValue}
			onchange={(event) => onSelectChange(event.currentTarget.value)}
		>
			<option value="">{m['seatDesigner.selectNone']?.() ?? 'None'}</option>
			<option value="stage">{m['seatDesigner.stageName']?.() ?? 'Stage'}</option>
			{#each blocks as block (block.id)}
				<option value={block.id}>{block.name}</option>
			{/each}
		</select>
	</label>

	<button type="button" class={buttonClass(snapOn)} aria-pressed={snapOn} onclick={onSnapToggle}>
		<Magnet class="h-4 w-4" aria-hidden="true" />
		{m['seatDesigner.snap']()}
	</button>

	{#if hasSelection}
		{#if mode === 'shape'}
			<button
				type="button"
				class={buttonClass(true)}
				onclick={onExitShapeMode}
				disabled={shapeInvalid}
			>
				{m['seatDesigner.doneShape']()}
			</button>
		{:else}
			<button type="button" class={buttonClass(false)} onclick={onEnterShapeMode}>
				<PencilRuler class="h-4 w-4" aria-hidden="true" />
				{selectedHasShape
					? m['seatDesigner.editShape']()
					: (m['seatDesigner.drawShape']?.() ?? 'Draw shape')}
			</button>
		{/if}
		{#if selectedHasShape}
			<button type="button" class={buttonClass(false)} onclick={onClearShape}>
				<Trash2 class="h-4 w-4" aria-hidden="true" />
				{m['seatDesigner.removeShape']()}
			</button>
		{/if}
	{/if}

	{#if selectedSectorId}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- opaque href prop: the route passes a resolve()d sector-editor path -->
		<a href={sectorEditorHref(selectedSectorId)} class={buttonClass(false)}>
			<LayoutGrid class="h-4 w-4" aria-hidden="true" />
			{m['seatDesigner.gridEditor']()}
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/if}

	<div class="ms-auto flex items-center gap-3">
		<button
			type="button"
			onclick={onSave}
			disabled={!dirty || isSaving}
			class="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
		>
			{isSaving ? m['seatDesigner.saving']() : m['seatDesigner.save']()}
		</button>
	</div>
</div>
