<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventSeriesRetrieveSchema } from '$lib/api/generated/types.gen';
	import DetailsStepTagsInput from '../../DetailsStepTagsInput.svelte';
	import EventResources from '../../EventResources.svelte';
	import EditorSection from './EditorSection.svelte';
	import EditorSubGroup from './EditorSubGroup.svelte';
	import type { EditorFormData, EditorUpdate } from '../types';

	interface Props {
		formData: EditorFormData;
		eventSeries: EventSeriesRetrieveSchema[];
		onUpdate: EditorUpdate;
		/** Resources attach to a saved event. */
		eventId: string | null;
		organizationSlug: string;
		selectedResourceIds: string[];
		onResourcesChange: (ids: string[]) => void;
	}

	const {
		formData,
		eventSeries,
		onUpdate,
		eventId,
		organizationSlug,
		selectedResourceIds,
		onResourcesChange
	}: Props = $props();

	// Tag draft state is owned here (not in DetailsStepTagsInput) to match the
	// wizard's DetailsStep placement of the same four fields.
	let tagInput = $state('');
	let tagSuggestions = $state<string[]>([]);
	let showSuggestions = $state(false);
	let selectedSuggestionIndex = $state(-1);
</script>

<EditorSection
	id="section-extras"
	title={m['eventEditor.sectionExtras']()}
	subtitle={m['eventEditor.subtitleExtras']()}
>
	<DetailsStepTagsInput
		tags={formData.tags ?? []}
		bind:tagInput
		bind:tagSuggestions
		bind:showSuggestions
		bind:selectedSuggestionIndex
		{onUpdate}
	/>

	{#if eventSeries.length > 0}
		<div class="space-y-2">
			<label for="event-series" class="block text-sm font-medium">
				{m['detailsStep.eventSeries']()}
			</label>
			<select
				id="event-series"
				value={formData.event_series_id || ''}
				onchange={(e) => onUpdate({ event_series_id: e.currentTarget.value || null })}
				class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				<option value="">{m['detailsStep.none']()}</option>
				{#each eventSeries as series (series.id)}
					<option value={series.id}>{series.name}</option>
				{/each}
			</select>
		</div>
	{/if}

	{#if eventId}
		<EditorSubGroup>
			<EventResources
				{organizationSlug}
				{eventId}
				{selectedResourceIds}
				onSelectionChange={onResourcesChange}
			/>
		</EditorSubGroup>
	{/if}
</EditorSection>
