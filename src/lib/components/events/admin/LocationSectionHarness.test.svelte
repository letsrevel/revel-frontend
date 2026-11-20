<script lang="ts">
	import { QueryClientProvider, type QueryClient } from '@tanstack/svelte-query';
	import type { CitySchema, VenueDetailSchema } from '$lib/api/generated/types.gen';
	import LocationSection from './LocationSection.svelte';

	// Test-only harness: owns the form state like the real event editor does, so
	// the callbacks really change what LocationSection renders.
	interface Props {
		client: QueryClient;
		initialFormData: Record<string, unknown>;
		initialCity: CitySchema | null;
		initialVenue: VenueDetailSchema | null;
		onUpdate: (data: Record<string, unknown>) => void;
		onCitySelect: (city: CitySchema | null) => void;
		onVenueSelect: (venue: VenueDetailSchema | null) => void;
	}

	const {
		client,
		initialFormData,
		initialCity,
		initialVenue,
		onUpdate,
		onCitySelect,
		onVenueSelect
	}: Props = $props();

	// The initial props seed local state once; later changes come from the callbacks.
	// svelte-ignore state_referenced_locally
	let formData = $state<Record<string, unknown>>({ ...initialFormData });
	// svelte-ignore state_referenced_locally
	let selectedCity = $state<CitySchema | null>(initialCity);
	// svelte-ignore state_referenced_locally
	let selectedVenue = $state<VenueDetailSchema | null>(initialVenue);
</script>

<QueryClientProvider {client}>
	<LocationSection
		{formData}
		{selectedCity}
		{selectedVenue}
		organizationSlug="acme"
		validationErrors={{}}
		onUpdate={(data) => {
			formData = { ...formData, ...data };
			onUpdate(data);
		}}
		onCitySelect={(city) => {
			selectedCity = city;
			onCitySelect(city);
		}}
		onVenueSelect={(venue) => {
			// Only the selection: venue_id changes through onUpdate, as in the editor.
			selectedVenue = venue;
			onVenueSelect(venue);
		}}
	/>
</QueryClientProvider>
