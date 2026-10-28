<script lang="ts">
	import type {
		CitySchema,
		EventSeriesRetrieveSchema,
		VenueDetailSchema
	} from '$lib/api/generated/types.gen';
	import type { OrganizationQuestionnaireInListSchema } from '$lib/api/generated';
	import type { ScheduleRow } from '../schedule-rows';
	import BasicsSection from './sections/BasicsSection.svelte';
	import WhenSection from './sections/WhenSection.svelte';
	import WhereSection from './sections/WhereSection.svelte';
	import AccessSection from './sections/AccessSection.svelte';
	import AttendanceSection from './sections/AttendanceSection.svelte';
	import EventPageSection from './sections/EventPageSection.svelte';
	import ExtrasSection from './sections/ExtrasSection.svelte';
	import type { EditorFormData, EditorMode, EditorUpdate, ImageUpdate } from './types';

	interface Props {
		formData: EditorFormData;
		validationErrors: Record<string, string>;
		/**
		 * `create` renders only Basics (name), Date & time (start/end) and Access
		 * (visibility, type, ticketing choice) — the same section components, gated.
		 */
		mode: EditorMode;
		isEditMode: boolean;
		/** Ticketing mode can no longer change (the event exists). */
		ticketingLocked: boolean;
		onUpdate: EditorUpdate;
		onUpdateImages: ImageUpdate;
		eventId: string | null;
		eventSlug?: string;
		organizationId: string;
		organizationSlug: string;
		accessToken?: string;
		eventSeries: EventSeriesRetrieveSchema[];
		questionnaires: OrganizationQuestionnaireInListSchema[];
		selectedCity: CitySchema | null;
		selectedVenue: VenueDetailSchema | null;
		onCitySelect: (city: CitySchema | null) => void;
		onVenueSelect: (venue: VenueDetailSchema | null) => void;
		effectiveVatCountry?: string;
		vatCountryMismatch?: boolean;
		selectedResourceIds: string[];
		onResourcesChange: (ids: string[]) => void;
		scheduleRows: ScheduleRow[];
		disabled: boolean;
	}

	let {
		formData,
		validationErrors,
		mode,
		isEditMode,
		ticketingLocked,
		onUpdate,
		onUpdateImages,
		eventId,
		eventSlug,
		organizationId,
		organizationSlug,
		accessToken,
		eventSeries,
		questionnaires,
		selectedCity,
		selectedVenue,
		onCitySelect,
		onVenueSelect,
		effectiveVatCountry = '',
		vatCountryMismatch = false,
		selectedResourceIds,
		onResourcesChange,
		scheduleRows = $bindable(),
		disabled
	}: Props = $props();
</script>

<!-- Always-expanded sections, in the order of the organizer's questions:
     what is it, when, where, who can come, how many, what the page shows, extras. -->
<div class="space-y-8">
	<BasicsSection
		{formData}
		{validationErrors}
		{mode}
		{onUpdate}
		{onUpdateImages}
		eventId={eventId ?? undefined}
		{eventSlug}
		{organizationSlug}
	/>

	<WhenSection
		{formData}
		{validationErrors}
		{mode}
		{onUpdate}
		{eventId}
		bind:scheduleRows
		{disabled}
	/>

	{#if mode === 'edit'}
		<WhereSection
			{formData}
			{validationErrors}
			{organizationSlug}
			{selectedCity}
			{selectedVenue}
			{onCitySelect}
			{onVenueSelect}
			{onUpdate}
			{effectiveVatCountry}
			{vatCountryMismatch}
		/>
	{/if}

	<AccessSection
		{formData}
		{mode}
		{ticketingLocked}
		{onUpdate}
		{questionnaires}
		{eventId}
		{organizationId}
		{organizationSlug}
		{accessToken}
	/>

	{#if mode === 'edit'}
		<AttendanceSection {formData} {selectedVenue} {isEditMode} {onUpdate} />
		<EventPageSection {formData} {onUpdate} />
		<ExtrasSection
			{formData}
			{eventSeries}
			{onUpdate}
			{eventId}
			{organizationSlug}
			{selectedResourceIds}
			{onResourcesChange}
		/>
	{/if}
</div>
