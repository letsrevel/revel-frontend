<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		EventCreateSchema,
		EventSeriesRetrieveSchema,
		CitySchema,
		VenueDetailSchema
	} from '$lib/api/generated/types.gen';
	import {
		FileText,
		Users,
		Settings,
		ChevronDown,
		ChevronRight,
		CheckSquare,
		AlertTriangle
	} from '@lucide/svelte';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import EventQuestionnaireAssignmentModal from './EventQuestionnaireAssignmentModal.svelte';
	import LocationSection from './LocationSection.svelte';
	import RsvpFields from './RsvpFields.svelte';
	import CapacityFields from './CapacityFields.svelte';
	import CheckInFields from './CheckInFields.svelte';
	import AdmissionScreeningSection from './AdmissionScreeningSection.svelte';
	import DetailsStepTagsInput from './DetailsStepTagsInput.svelte';
	import DetailsStepMediaSection from './DetailsStepMediaSection.svelte';
	import EventTaxSection from './EventTaxSection.svelte';
	import EventVisibilitySection from './EventVisibilitySection.svelte';
	import { isNonDefaultVisibility } from '$lib/utils/event-visibility';
	import type { OrganizationQuestionnaireInListSchema } from '$lib/api/generated';
	import { SvelteSet } from 'svelte/reactivity';

	interface Props {
		formData: Partial<EventCreateSchema> & {
			id?: string;
			tags?: string[];
			logo?: string;
			cover_art?: string;
			organization_logo?: string;
			organization_cover_art?: string;
			requires_ticket?: boolean;
			requires_full_profile?: boolean;
			venue_id?: string | null;
			city_id?: number | null;
			location_maps_url?: string | null;
			location_maps_embed?: string | null;
			seats_held?: number;
			waitlist_time_window?: string | null;
			waitlist_batch_size?: number | null;
			waitlist_cutoff_date?: string | null;
			waitlist_lottery_mode?: boolean | null;
		};
		eventSeries?: EventSeriesRetrieveSchema[];
		questionnaires?: OrganizationQuestionnaireInListSchema[];
		eventId?: string | null;
		organizationId?: string;
		organizationSlug?: string;
		accessToken?: string;
		// Location section props
		selectedCity?: CitySchema | null;
		selectedVenue?: VenueDetailSchema | null;
		validationErrors?: Record<string, string>;
		isEditMode?: boolean;
		/** Server-derived VAT country readout (edit mode only). */
		effectiveVatCountry?: string;
		/** Server-computed organizer warning (edit mode only, BE #869). */
		vatCountryMismatch?: boolean;
		onCitySelect?: (city: CitySchema | null) => void;
		onVenueSelect?: (venue: VenueDetailSchema | null) => void;
		onUpdate: (
			data: Partial<EventCreateSchema> & {
				tags?: string[];
				requires_full_profile?: boolean;
				venue_id?: string | null;
				city_id?: number | null;
				location_maps_url?: string | null;
				location_maps_embed?: string | null;
				waitlist_time_window?: string | null;
				waitlist_batch_size?: number | null;
				waitlist_cutoff_date?: string | null;
				waitlist_lottery_mode?: boolean | null;
			}
		) => void;
		onUpdateImages: (data: {
			logo?: File | null;
			coverArt?: File | null;
			deleteLogo?: boolean;
			deleteCoverArt?: boolean;
		}) => void;
	}

	const {
		formData,
		eventSeries = [],
		questionnaires = [],
		eventId = null,
		organizationId = '',
		organizationSlug = '',
		accessToken = '',
		selectedCity = null,
		selectedVenue = null,
		validationErrors = {},
		isEditMode = false,
		effectiveVatCountry = '',
		vatCountryMismatch = false,
		onCitySelect = () => {
			/* noop */
		},
		onVenueSelect = () => {
			/* noop */
		},
		onUpdate,
		onUpdateImages
	}: Props = $props();

	// Unambiguous textual readbacks for the native datetime inputs; '' when the
	// value is empty or unparseable, so each hint is gated on the rendered text.
	// Modal state for questionnaire assignment
	let isQuestionnaireModalOpen = $state(false);

	// Accordion state. "basic" is always open; "advanced" auto-opens when the
	// event already has tags, and "admission & screening" auto-opens when any of
	// its controls is already set, so existing configuration isn't hidden behind
	// a collapsed header on load.
	const hasScreeningSettings =
		!!formData.accept_invitation_requests ||
		!!formData.requires_full_profile ||
		!!formData.apply_before;
	const openSections = new SvelteSet<string>(
		[
			'basic',
			formData.tags && formData.tags.length > 0 ? 'advanced' : null,
			hasScreeningSettings ? 'screening' : null,
			// Never leave a non-default disclosure choice collapsed out of sight.
			isNonDefaultVisibility(formData.visibility_settings) ? 'visibility' : null,
			// Same rule for place-of-supply: a virtual flag, a country override or
			// an active mismatch warning must not hide behind a collapsed section.
			formData.is_virtual || formData.vat_country_code || vatCountryMismatch ? 'taxes' : null
		].filter((s): s is string => s !== null)
	);

	// Tag draft state — owned here (not in DetailsStepTagsInput) so a half-typed
	// tag draft survives collapsing/reopening the Advanced accordion, which
	// unmounts the child. Matches the pre-split top-level $state placement.
	let tagInput = $state('');
	let tagSuggestions = $state<string[]>([]);
	let showSuggestions = $state(false);
	let selectedSuggestionIndex = $state(-1);

	// Description state (for MarkdownEditor). Writable $derived: resynced with
	// formData when it changes externally, but locally reassignable via the
	// editor's bind:value and handleDescriptionChange below.
	let description = $derived(formData.description || '');

	/**
	 * Toggle accordion section
	 */
	function toggleSection(section: string): void {
		if (openSections.has(section)) {
			openSections.delete(section);
		} else {
			openSections.add(section);
		}
	}

	/**
	 * Handle description changes
	 */
	function handleDescriptionChange(value: string): void {
		description = value;
		onUpdate({ description: value });
	}

	// Derived state
	const isSectionOpen = (section: string) => openSections.has(section);
</script>

<div class="space-y-4">
	<!-- Location Section -->
	<LocationSection
		{formData}
		{selectedCity}
		{selectedVenue}
		organizationSlug={organizationSlug || ''}
		{validationErrors}
		{onUpdate}
		{onCitySelect}
		{onVenueSelect}
	/>

	<!-- Taxes Section (place of supply: virtual flag + VAT country, BE #869) -->
	<EventTaxSection
		{formData}
		{effectiveVatCountry}
		{vatCountryMismatch}
		isOpen={isSectionOpen('taxes')}
		onToggle={() => toggleSection('taxes')}
		{onUpdate}
	/>

	<!-- Basic Details Section -->
	<div class="overflow-hidden rounded-lg border border-border">
		<button
			type="button"
			onclick={() => toggleSection('basic')}
			class="flex w-full items-center justify-between bg-muted/50 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			aria-expanded={isSectionOpen('basic')}
		>
			<div class="flex items-center gap-2 font-semibold">
				<FileText class="h-5 w-5" aria-hidden="true" />
				{m['detailsStep.basicDetails']()}
			</div>
			{#if isSectionOpen('basic')}
				<ChevronDown class="h-5 w-5" aria-hidden="true" />
			{:else}
				<ChevronRight class="h-5 w-5" aria-hidden="true" />
			{/if}
		</button>

		{#if isSectionOpen('basic')}
			<div class="space-y-4 p-4">
				<!-- Description -->
				<MarkdownEditor
					bind:value={description}
					id="description"
					label={m['detailsStep.description']()}
					placeholder={m['detailsStep.descriptionPlaceholder']()}
					rows={8}
					expandable
					onValueChange={handleDescriptionChange}
				/>
			</div>
		{/if}
	</div>

	<!-- RSVP Options Section (only for non-ticketed events, ticketing options moved to Step 3) -->
	{#if !formData.requires_ticket}
		<div class="overflow-hidden rounded-lg border border-border">
			<button
				type="button"
				onclick={() => toggleSection('rsvp')}
				class="flex w-full items-center justify-between bg-muted/50 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-expanded={isSectionOpen('rsvp')}
			>
				<div class="flex items-center gap-2 font-semibold">
					<CheckSquare class="h-5 w-5" aria-hidden="true" />
					{m['detailsStep.rsvpOptions']()}
				</div>
				{#if isSectionOpen('rsvp')}
					<ChevronDown class="h-5 w-5" aria-hidden="true" />
				{:else}
					<ChevronRight class="h-5 w-5" aria-hidden="true" />
				{/if}
			</button>

			{#if isSectionOpen('rsvp')}
				<div class="p-4">
					<RsvpFields {formData} {onUpdate} />
				</div>
			{/if}
		</div>
	{/if}

	<!-- Capacity Section -->
	<div class="overflow-hidden rounded-lg border border-border">
		<button
			type="button"
			onclick={() => toggleSection('capacity')}
			class="flex w-full items-center justify-between bg-muted/50 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			aria-expanded={isSectionOpen('capacity')}
		>
			<div class="flex items-center gap-2 font-semibold">
				<Users class="h-5 w-5" aria-hidden="true" />
				{m['detailsStep.capacity']()}
			</div>
			{#if isSectionOpen('capacity')}
				<ChevronDown class="h-5 w-5" aria-hidden="true" />
			{:else}
				<ChevronRight class="h-5 w-5" aria-hidden="true" />
			{/if}
		</button>

		{#if isSectionOpen('capacity')}
			<div class="p-4">
				<CapacityFields {formData} {selectedVenue} {isEditMode} {onUpdate} />
			</div>
		{/if}
	</div>

	<!-- Attendance Visibility Section -->
	<EventVisibilitySection
		settings={formData.visibility_settings}
		isOpen={isSectionOpen('visibility')}
		onToggle={() => toggleSection('visibility')}
		onChange={(next) =>
			onUpdate({ visibility_settings: { ...formData.visibility_settings, ...next } })}
	/>

	<!-- Admission & Screening Section -->
	<AdmissionScreeningSection
		{formData}
		isOpen={isSectionOpen('screening')}
		onToggle={() => toggleSection('screening')}
		{eventId}
		{organizationId}
		{accessToken}
		{questionnaires}
		{onUpdate}
		onAssignQuestionnaire={() => (isQuestionnaireModalOpen = true)}
	/>

	<!-- Advanced Section -->
	<div class="overflow-hidden rounded-lg border border-border">
		<button
			type="button"
			onclick={() => toggleSection('advanced')}
			class="flex w-full items-center justify-between bg-muted/50 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			aria-expanded={isSectionOpen('advanced')}
		>
			<div class="flex items-center gap-2 font-semibold">
				<Settings class="h-5 w-5" aria-hidden="true" />
				{m['detailsStep.advanced']()}
			</div>
			{#if isSectionOpen('advanced')}
				<ChevronDown class="h-5 w-5" aria-hidden="true" />
			{:else}
				<ChevronRight class="h-5 w-5" aria-hidden="true" />
			{/if}
		</button>

		{#if isSectionOpen('advanced')}
			<div class="space-y-4 p-4">
				{#if formData.requires_ticket}
					<CheckInFields {formData} {onUpdate} />
				{/if}

				<!-- Potluck Open -->
				<label
					class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
				>
					<input
						type="checkbox"
						checked={formData.potluck_open || false}
						onchange={(e) => onUpdate({ potluck_open: e.currentTarget.checked })}
						class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
					/>
					<div class="flex-1">
						<div class="font-medium">{m['detailsStep.enablePotluck']()}</div>
						<div class="text-sm text-muted-foreground">
							{m['detailsStep.potluckHint']()}
						</div>
					</div>
				</label>

				<!-- Public Pronoun Distribution -->
				<label
					class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
				>
					<input
						type="checkbox"
						checked={formData.visibility_settings?.show_pronoun_distribution || false}
						onchange={(e) =>
							onUpdate({
								visibility_settings: {
									...formData.visibility_settings,
									show_pronoun_distribution: e.currentTarget.checked
								}
							})}
						class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
					/>
					<div class="flex-1">
						<div class="font-medium">
							{m['detailsStep.publicPronounDistribution']()}
						</div>
						<div class="text-sm text-muted-foreground">
							{m['detailsStep.publicPronounDistributionHint']()}
						</div>
					</div>
				</label>

				<!-- Allow Guest Attendance -->
				<label
					class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
				>
					<input
						type="checkbox"
						checked={formData.can_attend_without_login || false}
						onchange={(e) => onUpdate({ can_attend_without_login: e.currentTarget.checked })}
						class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
					/>
					<div class="flex-1">
						<div class="font-medium">{m['detailsStep.canAttendWithoutLogin']()}</div>
						<div class="text-sm text-muted-foreground">
							{m['detailsStep.canAttendWithoutLoginHint']()}
						</div>
					</div>
				</label>

				{#if formData.can_attend_without_login}
					<div class="rounded-lg border border-destructive bg-destructive/10 p-4" role="alert">
						<div class="flex items-start gap-3">
							<AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
							<div class="flex-1 space-y-1">
								<p class="font-medium text-destructive">
									{m['detailsStep.guestAttendanceWarningTitle']()}
								</p>
								<p class="text-sm text-destructive/90">
									{m['detailsStep.guestAttendanceWarningBody']()}
								</p>
							</div>
						</div>
					</div>
				{/if}

				<!-- Require Ticket Holder Names -->
				{#if formData.requires_ticket}
					<label
						class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
					>
						<input
							type="checkbox"
							checked={formData.require_ticket_names ?? true}
							onchange={(e) => onUpdate({ require_ticket_names: e.currentTarget.checked })}
							class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
						/>
						<div class="flex-1">
							<div class="font-medium">{m['detailsStep.requireTicketNames']()}</div>
							<div class="text-sm text-muted-foreground">
								{m['detailsStep.requireTicketNamesHint']()}
							</div>
						</div>
					</label>
				{/if}

				<!-- Tags -->
				<DetailsStepTagsInput
					tags={formData.tags ?? []}
					bind:tagInput
					bind:tagSuggestions
					bind:showSuggestions
					bind:selectedSuggestionIndex
					{onUpdate}
				/>

				<!-- Event Series -->
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
			</div>
		{/if}
	</div>

	<!-- Media Section -->
	<DetailsStepMediaSection
		logo={formData.logo}
		coverArt={formData.cover_art}
		organizationLogo={formData.organization_logo}
		organizationCoverArt={formData.organization_cover_art}
		isOpen={isSectionOpen('media')}
		onToggle={() => toggleSection('media')}
		{onUpdateImages}
	/>
</div>

<!-- Questionnaire Assignment Modal -->
{#if isQuestionnaireModalOpen && eventId && organizationId && organizationSlug && accessToken}
	<EventQuestionnaireAssignmentModal
		bind:open={isQuestionnaireModalOpen}
		{eventId}
		currentlyAssigned={questionnaires}
		{organizationId}
		{organizationSlug}
		{accessToken}
		onClose={() => (isQuestionnaireModalOpen = false)}
	/>
{/if}
