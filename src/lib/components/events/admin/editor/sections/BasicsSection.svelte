<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import EssentialsStepSlugEditor from '../../EssentialsStepSlugEditor.svelte';
	import DetailsStepMediaSection from '../../DetailsStepMediaSection.svelte';
	import EditorSection from './EditorSection.svelte';
	import EditorSubGroup from './EditorSubGroup.svelte';
	import type { EditorFormData, EditorMode, EditorUpdate, ImageUpdate } from '../types';

	interface Props {
		formData: EditorFormData;
		validationErrors: Record<string, string>;
		/** `create` shows the name only; `edit` adds slug, description and media. */
		mode: EditorMode;
		onUpdate: EditorUpdate;
		onUpdateImages: ImageUpdate;
		eventId?: string;
		eventSlug?: string;
		organizationSlug?: string;
		onSlugUpdated?: (newSlug: string) => void;
	}

	const {
		formData,
		validationErrors,
		mode,
		onUpdate,
		onUpdateImages,
		eventId,
		eventSlug,
		organizationSlug,
		onSlugUpdated
	}: Props = $props();

	// Writable $derived: resynced with formData when it changes externally, but
	// locally reassignable via the editor's bind:value.
	let description = $derived(formData.description || '');

	function handleDescriptionChange(value: string): void {
		description = value;
		onUpdate({ description: value });
	}
</script>

<EditorSection
	id="section-basics"
	title={m['eventEditor.sectionBasics']()}
	subtitle={m['eventEditor.subtitleBasics']()}
>
	<!-- Event Name -->
	<div class="space-y-2">
		<label for="event-name" class="block text-sm font-medium">
			{m['essentialsStep.eventNameLabel']()} <span class="text-destructive">*</span>
		</label>
		<input
			id="event-name"
			type="text"
			value={formData.name || ''}
			oninput={(e) => onUpdate({ name: e.currentTarget.value })}
			placeholder={m['essentialsStep.eventNamePlaceholder']()}
			required
			aria-invalid={!!validationErrors.name}
			aria-describedby={validationErrors.name ? 'event-name-error' : undefined}
			class={cn(
				'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
				validationErrors.name && 'border-destructive'
			)}
		/>
		{#if validationErrors.name}
			<p id="event-name-error" class="text-sm text-destructive" role="alert">
				{validationErrors.name}
			</p>
		{/if}
		<p class="text-xs text-muted-foreground">{m['SFwESEssentialsStep.clearDescriptiveName']()}</p>
	</div>

	{#if mode === 'edit'}
		<!-- Event Slug -->
		{#if eventId && organizationSlug && eventSlug}
			<EssentialsStepSlugEditor {eventId} {eventSlug} {organizationSlug} {onSlugUpdated} />
		{/if}

		<!-- Description -->
		<MarkdownEditor
			bind:value={description}
			id="description"
			label={m['detailsStep.description']()}
			placeholder={m['detailsStep.descriptionPlaceholder']()}
			rows={8}
			onValueChange={handleDescriptionChange}
		/>

		<!-- Cover art + logo -->
		<EditorSubGroup title={m['detailsStep.media']()}>
			<DetailsStepMediaSection
				bare
				logo={formData.logo}
				coverArt={formData.cover_art}
				organizationLogo={formData.organization_logo}
				organizationCoverArt={formData.organization_cover_art}
				{onUpdateImages}
			/>
		</EditorSubGroup>
	{/if}
</EditorSection>
