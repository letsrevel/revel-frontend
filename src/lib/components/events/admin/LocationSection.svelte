<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { CitySchema, VenueDetailSchema, ResourceVisibility } from '$lib/api/generated';
	import CityAutocomplete from '$lib/components/forms/CityAutocomplete.svelte';
	import VenueSelector from './VenueSelector.svelte';
	import {
		MapPin,
		Building2,
		Eye,
		Map,
		ChevronDown,
		ChevronRight,
		HelpCircle,
		ArrowLeft
	} from 'lucide-svelte';

	type LocationMode = 'none' | 'address' | 'venue';

	interface Props {
		formData: {
			venue_id?: string | null;
			city_id?: number | null;
			address?: string | null;
			address_visibility?: ResourceVisibility;
			location_maps_url?: string | null;
			location_maps_embed?: string | null;
		};
		selectedCity: CitySchema | null;
		selectedVenue: VenueDetailSchema | null;
		organizationSlug: string;
		validationErrors: Record<string, string>;
		isEditMode: boolean;
		onUpdate: (data: Record<string, unknown>) => void;
		onCitySelect: (city: CitySchema | null) => void;
		onVenueSelect: (venue: VenueDetailSchema | null) => void;
	}

	let {
		formData,
		selectedCity,
		selectedVenue,
		organizationSlug,
		validationErrors,
		isEditMode,
		onUpdate,
		onCitySelect,
		onVenueSelect
	}: Props = $props();

	// Derive the expected mode from formData
	// Note: city_id is not used for detection because it may be inherited from the organization
	let derivedMode = $derived.by((): LocationMode => {
		if (formData.venue_id) return 'venue';
		if (formData.address) return 'address';
		return 'none';
	});

	// Track if user has manually selected a mode (to prevent auto-switching)
	let userSelectedMode = $state<LocationMode | null>(null);

	// Location mode: use user selection if available, otherwise derive from data
	let locationMode = $derived(userSelectedMode ?? derivedMode);

	// Maps section expanded state - derive from whether maps data exists
	let hasMapsData = $derived(!!formData.location_maps_url || !!formData.location_maps_embed);
	let mapsExpanded = $state(false);

	// Auto-expand maps section when data exists
	$effect(() => {
		if (hasMapsData && !mapsExpanded) {
			mapsExpanded = true;
		}
	});

	/**
	 * Set location mode and clear data if switching modes
	 */
	function setMode(mode: LocationMode) {
		// Clear previous data when switching modes
		if (mode === 'address' && locationMode === 'venue') {
			// Switching from venue to address - clear venue data
			onVenueSelect(null);
			onUpdate({ venue_id: null });
		} else if (mode === 'venue' && locationMode === 'address') {
			// Switching from address to venue - clear address data
			onCitySelect(null);
			onUpdate({
				city_id: null,
				address: null,
				address_visibility: 'public',
				location_maps_url: null,
				location_maps_embed: null
			});
		}
		userSelectedMode = mode;
	}

	/**
	 * Handle going back to CTA selection
	 */
	function goBackToSelection() {
		// Clear all location data
		onVenueSelect(null);
		onCitySelect(null);
		onUpdate({
			venue_id: null,
			city_id: null,
			address: null,
			address_visibility: 'public',
			location_maps_url: null,
			location_maps_embed: null
		});
		userSelectedMode = 'none';
	}

	/**
	 * Handle city selection in address mode
	 */
	function handleCitySelect(city: CitySchema | null) {
		onCitySelect(city);
		onUpdate({ city_id: city?.id || null });
	}

	/**
	 * Handle venue selection
	 */
	function handleVenueSelect(venue: VenueDetailSchema | null) {
		onVenueSelect(venue);
		if (venue) {
			// Auto-populate city from venue
			if (venue.city) {
				onCitySelect(venue.city);
				onUpdate({
					venue_id: venue.id,
					city_id: venue.city.id,
					address: venue.address || null
				});
			} else {
				onUpdate({
					venue_id: venue.id,
					address: venue.address || null
				});
			}
		} else {
			onUpdate({ venue_id: null });
		}
	}

	/**
	 * Extract the src URL from an iframe HTML string.
	 */
	function extractEmbedUrl(input: string | null): string | null {
		if (!input) return null;
		const trimmed = input.trim();
		if (!trimmed) return null;

		// If it's already a URL, return as-is
		if (trimmed.startsWith('http')) {
			return trimmed;
		}

		// If it looks like an iframe, extract the src
		if (trimmed.toLowerCase().startsWith('<iframe')) {
			const match = trimmed.match(/src=["']([^"']+)["']/);
			if (match) {
				return match[1];
			}
		}

		return trimmed;
	}

	/**
	 * Handle maps embed input
	 */
	function handleMapsEmbedInput(value: string | null): void {
		const extractedUrl = extractEmbedUrl(value);
		onUpdate({ location_maps_embed: extractedUrl });
	}

	/**
	 * Format city for display
	 */
	function formatCity(city: CitySchema | null): string {
		if (!city) return '';
		const parts = [city.name];
		if (city.admin_name) parts.push(city.admin_name);
		if (city.country) parts.push(city.country);
		return parts.join(', ');
	}
</script>

<div class="space-y-4 rounded-lg border border-border p-4">
	<!-- Section Header -->
	<div class="flex items-center justify-between">
		<h3 class="flex items-center gap-2 font-semibold">
			<MapPin class="h-5 w-5" aria-hidden="true" />
			{m['locationSection.title']?.() ?? 'Location'}
		</h3>
		{#if locationMode !== 'none'}
			<button
				type="button"
				onclick={goBackToSelection}
				class="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				<ArrowLeft class="h-4 w-4" aria-hidden="true" />
				{m['locationSection.changeLocationType']?.() ?? 'Change location type'}
			</button>
		{/if}
	</div>

	<!-- Mode: None - Show CTAs -->
	{#if locationMode === 'none'}
		<div class="grid gap-4 sm:grid-cols-2">
			<!-- Add Address Card -->
			<button
				type="button"
				onclick={() => setMode('address')}
				class="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-input p-6 text-center transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<MapPin class="h-8 w-8 text-muted-foreground" aria-hidden="true" />
				<div>
					<p class="font-medium">{m['locationSection.addAddress']?.() ?? 'Add Address'}</p>
					<p class="text-sm text-muted-foreground">
						{m['locationSection.addAddressHint']?.() ?? 'Enter a custom address for this event'}
					</p>
				</div>
			</button>

			<!-- Select Venue Card -->
			{#if organizationSlug}
				<button
					type="button"
					onclick={() => setMode('venue')}
					class="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-input p-6 text-center transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<Building2 class="h-8 w-8 text-muted-foreground" aria-hidden="true" />
					<div>
						<p class="font-medium">{m['locationSection.selectVenue']?.() ?? 'Select Venue'}</p>
						<p class="text-sm text-muted-foreground">
							{m['locationSection.selectVenueHint']?.() ?? "Choose from your organization's venues"}
						</p>
					</div>
				</button>
			{/if}
		</div>
	{/if}

	<!-- Mode: Address - Manual entry form -->
	{#if locationMode === 'address'}
		<div class="space-y-4">
			<!-- City -->
			<CityAutocomplete
				value={selectedCity}
				onSelect={handleCitySelect}
				error={validationErrors.city_id}
				label={m['locationSection.cityLabel']?.() ?? 'City'}
				description=""
			/>
			{#if validationErrors.city_id}
				<p class="text-sm text-destructive" role="alert">
					{validationErrors.city_id}
				</p>
			{/if}

			<!-- Address -->
			<div class="space-y-2">
				<label for="location-address" class="block text-sm font-medium">
					<span class="flex items-center gap-2">
						<MapPin class="h-4 w-4" aria-hidden="true" />
						{m['locationSection.addressLabel']?.() ?? 'Address'}
					</span>
				</label>
				<input
					id="location-address"
					type="text"
					value={formData.address || ''}
					oninput={(e) => onUpdate({ address: e.currentTarget.value || null })}
					placeholder={m['locationSection.addressPlaceholder']?.() ?? 'Enter the event address'}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				/>
			</div>

			<!-- Address Visibility -->
			<div class="space-y-2">
				<label for="location-address-visibility" class="block text-sm font-medium">
					<span class="flex items-center gap-2">
						<Eye class="h-4 w-4" aria-hidden="true" />
						{m['locationSection.addressVisibility']?.() ?? 'Address Visibility'}
					</span>
				</label>
				<select
					id="location-address-visibility"
					value={formData.address_visibility || 'public'}
					onchange={(e) =>
						onUpdate({ address_visibility: e.currentTarget.value as ResourceVisibility })}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<option value="public">{m['detailsStep.addressVisibilityPublic']?.() ?? 'Public'}</option>
					<option value="members-only"
						>{m['detailsStep.addressVisibilityMembersOnly']?.() ?? 'Members Only'}</option
					>
					<option value="attendees-only"
						>{m['detailsStep.addressVisibilityAttendeesOnly']?.() ?? 'Attendees Only'}</option
					>
					<option value="private"
						>{m['detailsStep.addressVisibilityPrivate']?.() ?? 'Private'}</option
					>
				</select>
				<p class="text-xs text-muted-foreground">
					{m['detailsStep.addressVisibilityHint']?.() ?? 'Control who can see the event address'}
				</p>
			</div>

			<!-- Maps Sub-section (Collapsible) -->
			<div class="rounded-lg border border-border">
				<button
					type="button"
					onclick={() => (mapsExpanded = !mapsExpanded)}
					class="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					aria-expanded={mapsExpanded}
				>
					<div class="flex items-center gap-2 text-sm font-medium">
						<Map class="h-4 w-4" aria-hidden="true" />
						{m['locationSection.mapsSection']?.() ?? 'Maps Integration (optional)'}
					</div>
					{#if mapsExpanded}
						<ChevronDown class="h-4 w-4" aria-hidden="true" />
					{:else}
						<ChevronRight class="h-4 w-4" aria-hidden="true" />
					{/if}
				</button>

				{#if mapsExpanded}
					<div class="space-y-4 border-t p-3">
						<!-- Info Box -->
						<div
							class="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100"
						>
							<HelpCircle class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
							<div class="space-y-2">
								<p class="font-medium">
									{m['detailsStep.mapsHelpTitle']?.() ?? 'How to add a map'}
								</p>
								<ol class="list-inside list-decimal space-y-1 text-xs">
									<li>
										{m['detailsStep.mapsHelpStep1']?.() ??
											'Open your location in Google Maps (or another maps service)'}
									</li>
									<li>{m['detailsStep.mapsHelpStep2']?.() ?? 'Click the "Share" button'}</li>
									<li>
										{m['detailsStep.mapsHelpStep3']?.() ??
											'Copy the link and paste it in the "Maps Link" field below'}
									</li>
									<li>
										{m['detailsStep.mapsHelpStep4']?.() ??
											'For the embedded map: click "Embed a map", copy the entire HTML code, and paste it below'}
									</li>
								</ol>
							</div>
						</div>

						<!-- Maps URL -->
						<div class="space-y-2">
							<label for="location-maps-url" class="block text-sm font-medium">
								{m['locationSection.mapsUrl']?.() ?? 'Maps Link'}
							</label>
							<input
								id="location-maps-url"
								type="url"
								value={formData.location_maps_url || ''}
								oninput={(e) => onUpdate({ location_maps_url: e.currentTarget.value || null })}
								placeholder={m['detailsStep.mapsUrlPlaceholder']?.() ??
									'https://maps.google.com/...'}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
							/>
							<p class="text-xs text-muted-foreground">
								{m['locationSection.mapsUrlHint']?.() ??
									'Shareable link to the location (e.g., Google Maps)'}
							</p>
						</div>

						<!-- Maps Embed -->
						<div class="space-y-2">
							<label for="location-maps-embed" class="block text-sm font-medium">
								{m['locationSection.mapsEmbed']?.() ?? 'Embed Code'}
							</label>
							<textarea
								id="location-maps-embed"
								value={formData.location_maps_embed || ''}
								oninput={(e) => handleMapsEmbedInput(e.currentTarget.value || null)}
								placeholder={m['detailsStep.mapsEmbedPlaceholder']?.() ??
									'<iframe src="https://www.google.com/maps/embed?..." ...></iframe>'}
								rows={3}
								class="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
							></textarea>
							<p class="text-xs text-muted-foreground">
								{m['locationSection.mapsEmbedHint']?.() ?? 'Paste iframe HTML from Google Maps'}
							</p>
						</div>

						<!-- Preview -->
						{#if formData.location_maps_embed}
							<div class="space-y-2">
								<p class="text-sm font-medium">{m['detailsStep.mapsPreview']?.() ?? 'Preview'}</p>
								<div class="overflow-hidden rounded-lg border">
									<iframe
										src={formData.location_maps_embed}
										width="100%"
										height="200"
										style="border:0;"
										allowfullscreen
										loading="lazy"
										referrerpolicy="no-referrer-when-downgrade"
										title={m['detailsStep.mapsPreviewTitle']?.() ?? 'Map preview'}
									></iframe>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Mode: Venue - Venue selection form -->
	{#if locationMode === 'venue'}
		<div class="space-y-4">
			<!-- Venue Selector -->
			<VenueSelector {organizationSlug} {selectedVenue} onSelect={handleVenueSelect} />

			<!-- Read-only City (from venue) -->
			{#if selectedVenue?.city}
				<div class="space-y-2">
					<label class="block text-sm font-medium">
						<span class="flex items-center gap-2">
							<MapPin class="h-4 w-4" aria-hidden="true" />
							{m['locationSection.cityLabel']?.() ?? 'City'}
						</span>
					</label>
					<div
						class="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
					>
						{formatCity(selectedVenue.city)}
					</div>
					<p class="text-xs text-muted-foreground">
						{m['locationSection.cityFromVenue']?.() ?? 'City is set from the selected venue'}
					</p>
				</div>
			{/if}

			<!-- Read-only Address (from venue) -->
			{#if selectedVenue?.address}
				<div class="space-y-2">
					<label class="block text-sm font-medium">
						<span class="flex items-center gap-2">
							<MapPin class="h-4 w-4" aria-hidden="true" />
							{m['locationSection.addressLabel']?.() ?? 'Address'}
						</span>
					</label>
					<div
						class="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
					>
						{selectedVenue.address}
					</div>
					<p class="text-xs text-muted-foreground">
						{m['locationSection.addressFromVenue']?.() ?? 'Address is set from the selected venue'}
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
