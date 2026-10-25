<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { CitySchema, VenueDetailSchema } from '$lib/api/generated/types.gen';
	import LocationSection from '../../LocationSection.svelte';
	import EventTaxSection from '../../EventTaxSection.svelte';
	import EditorSection from './EditorSection.svelte';
	import EditorSubGroup from './EditorSubGroup.svelte';
	import type { EditorFormData, EditorUpdate } from '../types';

	interface Props {
		formData: EditorFormData;
		validationErrors: Record<string, string>;
		organizationSlug: string;
		selectedCity: CitySchema | null;
		selectedVenue: VenueDetailSchema | null;
		onCitySelect: (city: CitySchema | null) => void;
		onVenueSelect: (venue: VenueDetailSchema | null) => void;
		onUpdate: EditorUpdate;
		/** Server-derived VAT country readout (edit mode only). */
		effectiveVatCountry?: string;
		/** Server-computed organizer warning (edit mode only, BE #869). */
		vatCountryMismatch?: boolean;
	}

	const {
		formData,
		validationErrors,
		organizationSlug,
		selectedCity,
		selectedVenue,
		onCitySelect,
		onVenueSelect,
		onUpdate,
		effectiveVatCountry = '',
		vatCountryMismatch = false
	}: Props = $props();
</script>

<EditorSection
	id="section-where"
	title={m['eventEditor.sectionWhere']()}
	subtitle={m['eventEditor.subtitleWhere']()}
>
	<LocationSection
		embedded
		{formData}
		{selectedCity}
		{selectedVenue}
		{organizationSlug}
		{validationErrors}
		{onUpdate}
		{onCitySelect}
		{onVenueSelect}
	/>

	<!-- Place of supply: virtual flag + VAT country (BE #869) sits next to the address -->
	<EditorSubGroup title={m['detailsStep.taxes']()}>
		<EventTaxSection bare {formData} {effectiveVatCountry} {vatCountryMismatch} {onUpdate} />
	</EditorSubGroup>
</EditorSection>
