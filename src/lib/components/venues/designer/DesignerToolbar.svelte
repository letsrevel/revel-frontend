<script lang="ts">
	/**
	 * Toolbar for the freeform seat-map designer: tool + snap toggles, sector
	 * picker with shape-mode controls, selection summary and the Save button.
	 * Pure presentation — all state lives in SeatMapDesigner.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { Hand, Magnet, MousePointer } from '@lucide/svelte';

	interface SectorOption {
		id: string;
		name: string;
	}

	interface Props {
		sectors: SectorOption[];
		tool: 'select' | 'pan';
		snapOn: boolean;
		activeSectorId: string | null;
		shapeMode: boolean;
		hasShape: boolean;
		shapeInvalid: boolean;
		selectionCount: number;
		dirty: boolean;
		isSaving: boolean;
		sectorEditorHref: (sectorId: string) => string;
		onToolChange: (tool: 'select' | 'pan') => void;
		onSnapToggle: () => void;
		onSectorChange: (sectorId: string | null) => void;
		onEnterShapeMode: () => void;
		onExitShapeMode: () => void;
		onClearShape: () => void;
		onClearSelection: () => void;
		onSave: () => void;
	}

	const {
		sectors,
		tool,
		snapOn,
		activeSectorId,
		shapeMode,
		hasShape,
		shapeInvalid,
		selectionCount,
		dirty,
		isSaving,
		sectorEditorHref,
		onToolChange,
		onSnapToggle,
		onSectorChange,
		onEnterShapeMode,
		onExitShapeMode,
		onClearShape,
		onClearSelection,
		onSave
	}: Props = $props();

	const uid = $props.id();

	const activeSector = $derived(sectors.find((sector) => sector.id === activeSectorId) ?? null);

	const toolButtonClass = (active: boolean) =>
		`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors ` +
		`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
			active
				? 'border-primary bg-primary text-primary-foreground'
				: 'border-input bg-background hover:bg-accent'
		}`;
</script>

<div class="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
	<div class="flex items-center gap-1" role="group" aria-label={m['seatDesigner.tools']()}>
		<button
			type="button"
			class={toolButtonClass(tool === 'select')}
			aria-pressed={tool === 'select'}
			onclick={() => onToolChange('select')}
		>
			<MousePointer class="h-4 w-4" aria-hidden="true" />
			{m['seatDesigner.select']()}
		</button>
		<button
			type="button"
			class={toolButtonClass(tool === 'pan')}
			aria-pressed={tool === 'pan'}
			onclick={() => onToolChange('pan')}
		>
			<Hand class="h-4 w-4" aria-hidden="true" />
			{m['seatDesigner.pan']()}
		</button>
		<button
			type="button"
			class={toolButtonClass(snapOn)}
			aria-pressed={snapOn}
			onclick={onSnapToggle}
		>
			<Magnet class="h-4 w-4" aria-hidden="true" />
			{m['seatDesigner.snap']()}
		</button>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<label class="flex items-center gap-2 text-sm" for="{uid}-sector">
			<span class="font-medium">{m['seatDesigner.sector']()}</span>
			<select
				id="{uid}-sector"
				class="h-9 rounded-md border border-input bg-background px-2 text-sm"
				value={activeSectorId ?? ''}
				onchange={(event) => onSectorChange(event.currentTarget.value || null)}
			>
				{#each sectors as sector (sector.id)}
					<option value={sector.id}>{sector.name}</option>
				{/each}
			</select>
		</label>
		{#if activeSector}
			{#if shapeMode}
				<button
					type="button"
					class={toolButtonClass(true)}
					onclick={onExitShapeMode}
					disabled={shapeInvalid}
				>
					{m['seatDesigner.doneShape']()}
				</button>
			{:else}
				<button type="button" class={toolButtonClass(false)} onclick={onEnterShapeMode}>
					{m['seatDesigner.editShape']()}
				</button>
			{/if}
			{#if hasShape}
				<button type="button" class={toolButtonClass(false)} onclick={onClearShape}>
					{m['seatDesigner.removeShape']()}
				</button>
			{/if}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- opaque href prop: the route passes a resolve()d sector-editor path -->
			<a
				href={sectorEditorHref(activeSector.id)}
				class="text-sm font-medium text-primary underline-offset-4 hover:underline"
			>
				{m['seatDesigner.gridEditor']()}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
	</div>

	<div class="ms-auto flex items-center gap-3">
		{#if selectionCount > 0}
			<span class="text-sm text-muted-foreground" aria-live="polite">
				{m['seatDesigner.selectedCount']({ count: selectionCount })}
			</span>
			<button
				type="button"
				class="text-sm underline-offset-4 hover:underline"
				onclick={onClearSelection}
			>
				{m['seatDesigner.clearSelection']()}
			</button>
		{/if}
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
