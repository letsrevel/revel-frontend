<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		EventCreateSchema,
		EventSeriesRetrieveSchema,
		ResourceVisibility,
		CitySchema,
		VenueDetailSchema
	} from '$lib/api/generated/types.gen';
	import { formatDateTimeReadback } from '$lib/utils/date';
	import {
		FileText,
		Users,
		Settings,
		ChevronDown,
		ChevronRight,
		CheckSquare,
		AlertTriangle,
		Info,
		ExternalLink
	} from '@lucide/svelte';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import EventQuestionnaireAssignmentModal from './EventQuestionnaireAssignmentModal.svelte';
	import LocationSection from './LocationSection.svelte';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import WaitlistAdvancedSection from './WaitlistAdvancedSection.svelte';
	import AdmissionScreeningSection from './AdmissionScreeningSection.svelte';
	import DetailsStepTagsInput from './DetailsStepTagsInput.svelte';
	import DetailsStepMediaSection from './DetailsStepMediaSection.svelte';
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
			address_visibility?: ResourceVisibility;
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
		onCitySelect?: (city: CitySchema | null) => void;
		onVenueSelect?: (venue: VenueDetailSchema | null) => void;
		onUpdate: (
			data: Partial<EventCreateSchema> & {
				tags?: string[];
				requires_full_profile?: boolean;
				address_visibility?: ResourceVisibility;
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
	const rsvpReadback = $derived(formatDateTimeReadback(formData.rsvp_before));
	const checkInStartReadback = $derived(formatDateTimeReadback(formData.check_in_starts_at));
	const checkInEndReadback = $derived(formatDateTimeReadback(formData.check_in_ends_at));

	// Modal state for questionnaire assignment
	let isQuestionnaireModalOpen = $state(false);

	let waitlistInfoOpen = $state(false);
	let closeWaitlistConfirmOpen = $state(false);

	// If the user closes the waitlist while pending offers are held, defer the
	// change behind a confirm dialog (otherwise revoking those offers is silent).
	function handleWaitlistOpenChange(e: Event & { currentTarget: HTMLInputElement }): void {
		const nextValue = e.currentTarget.checked;
		const wasOpen = formData.waitlist_open === true;
		const seatsHeld = formData.seats_held ?? 0;
		if (wasOpen && !nextValue && seatsHeld > 0) {
			e.currentTarget.checked = true;
			closeWaitlistConfirmOpen = true;
			return;
		}
		onUpdate({ waitlist_open: nextValue });
	}

	function confirmCloseWaitlist(): void {
		closeWaitlistConfirmOpen = false;
		onUpdate({ waitlist_open: false });
	}

	function cancelCloseWaitlist(): void {
		closeWaitlistConfirmOpen = false;
	}

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
			hasScreeningSettings ? 'screening' : null
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
				<div class="space-y-4 p-4">
					<!-- RSVP Deadline -->
					<div class="space-y-2">
						<label for="rsvp-before" class="block text-sm font-medium">
							{m['detailsStep.rsvpDeadline']()}
						</label>
						<input
							id="rsvp-before"
							type="datetime-local"
							value={formData.rsvp_before || ''}
							oninput={(e) => onUpdate({ rsvp_before: e.currentTarget.value })}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						/>
						{#if rsvpReadback}
							<p class="text-xs text-muted-foreground">
								{m['dateTimePicker.selectedDate']({ value: rsvpReadback })}
							</p>
						{/if}
						<p class="text-xs text-muted-foreground">
							{m['detailsStep.rsvpDeadlineHint']({
								timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
							})}
						</p>
					</div>
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
			<div class="space-y-4 p-4">
				<!-- Max Attendees -->
				<div class="space-y-2">
					<label for="max-attendees" class="block text-sm font-medium">
						{m['detailsStep.maxAttendees']()}
					</label>
					<input
						id="max-attendees"
						type="number"
						min="1"
						value={formData.max_attendees || ''}
						oninput={(e) =>
							onUpdate({ max_attendees: parseInt(e.currentTarget.value) || undefined })}
						placeholder={m['detailsStep.unlimited']()}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					/>
					<p class="text-xs text-muted-foreground">{m['detailsStep.unlimitedCapacity']()}</p>

					<!-- Effective Capacity Display -->
					{#if selectedVenue?.capacity}
						{@const venueCapacity = selectedVenue.capacity}
						{@const maxAttendees = formData.max_attendees}
						{@const effectiveCapacity = maxAttendees
							? Math.min(maxAttendees, venueCapacity)
							: venueCapacity}
						<div class="mt-3 rounded-md bg-muted p-3 text-sm">
							<div class="font-medium">
								{m['eventWizard.effectiveCapacity.label']()}: {effectiveCapacity}
							</div>
							{#if maxAttendees && maxAttendees > venueCapacity}
								<p class="mt-1.5 text-amber-600 dark:text-amber-400">
									⚠️ {m['eventWizard.effectiveCapacity.warning']({
										maxAttendees: maxAttendees.toString(),
										venueCapacity: venueCapacity.toString(),
										effectiveCapacity: effectiveCapacity.toString()
									})}
								</p>
							{:else if !maxAttendees}
								<p class="mt-1 text-muted-foreground">
									{m['eventWizard.effectiveCapacity.limitedByVenue']({
										capacity: venueCapacity.toString()
									})}
								</p>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Waitlist Open -->
				<div class="space-y-2">
					<label
						class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
					>
						<input
							type="checkbox"
							checked={formData.waitlist_open || false}
							onchange={handleWaitlistOpenChange}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
						/>
						<div class="flex-1">
							<div class="font-medium">{m['detailsStep.waitlistOpen']()}</div>
							<div class="text-sm text-muted-foreground">
								{m['detailsStep.waitlistHint']()}
							</div>
							<button
								type="button"
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									waitlistInfoOpen = true;
								}}
								class="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
							>
								<Info class="h-3.5 w-3.5" aria-hidden="true" />
								{m['detailsStep.waitlistInfoButton']()}
							</button>
						</div>
					</label>

					<WaitlistAdvancedSection
						{formData}
						{isEditMode}
						confirmCloseOpen={closeWaitlistConfirmOpen}
						onConfirmClose={confirmCloseWaitlist}
						onCancelClose={cancelCloseWaitlist}
						{onUpdate}
					/>
				</div>

				<!-- Invitation Message -->
				<div class="space-y-2">
					<label for="invitation-message" class="block text-sm font-medium">
						{m['detailsStep.invitationMessage']()}
					</label>
					<textarea
						id="invitation-message"
						value={formData.invitation_message || ''}
						oninput={(e) => onUpdate({ invitation_message: e.currentTarget.value })}
						placeholder={m['detailsStep.invitationMessagePlaceholder']()}
						rows={4}
						class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					></textarea>
					<p class="text-xs text-muted-foreground">
						{m['detailsStep.invitationMessageHint']()}
					</p>
				</div>
			</div>
		{/if}
	</div>

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
					<!-- Check-in Starts At (tickets only) -->
					<div class="space-y-2">
						<label for="check-in-starts" class="block text-sm font-medium">
							{m['detailsStep.checkinOpensAt']()}
						</label>
						<input
							id="check-in-starts"
							type="datetime-local"
							value={formData.check_in_starts_at || ''}
							oninput={(e) => onUpdate({ check_in_starts_at: e.currentTarget.value })}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						/>
						{#if checkInStartReadback}
							<p class="text-xs text-muted-foreground">
								{m['dateTimePicker.selectedDate']({ value: checkInStartReadback })}
							</p>
						{/if}
						<p class="text-xs text-muted-foreground">
							{m['detailsStep.checkinOpensAtHint']({
								timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
							})}
						</p>
					</div>

					<!-- Check-in Ends At (tickets only) -->
					<div class="space-y-2">
						<label for="check-in-ends" class="block text-sm font-medium">
							{m['detailsStep.checkinClosesAt']()}
						</label>
						<input
							id="check-in-ends"
							type="datetime-local"
							value={formData.check_in_ends_at || ''}
							oninput={(e) => onUpdate({ check_in_ends_at: e.currentTarget.value })}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						/>
						{#if checkInEndReadback}
							<p class="text-xs text-muted-foreground">
								{m['dateTimePicker.selectedDate']({ value: checkInEndReadback })}
							</p>
						{/if}
						<p class="text-xs text-muted-foreground">
							{m['detailsStep.checkinClosesAtHint']({
								timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
							})}
						</p>
					</div>
				{/if}

				<!-- Potluck Open -->
				<label
					class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
				>
					<input
						type="checkbox"
						checked={formData.potluck_open || false}
						onchange={(e) => onUpdate({ potluck_open: e.currentTarget.checked })}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
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
						checked={formData.public_pronoun_distribution || false}
						onchange={(e) => onUpdate({ public_pronoun_distribution: e.currentTarget.checked })}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
					/>
					<div class="flex-1">
						<div class="font-medium">
							{m['detailsStep.publicPronounDistribution']?.() ?? 'Public pronoun distribution'}
						</div>
						<div class="text-sm text-muted-foreground">
							{m['detailsStep.publicPronounDistributionHint']?.() ??
								'Show pronoun distribution statistics to all attendees, not just staff'}
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
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
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

<!-- Waitlist Info Dialog -->
<Dialog bind:open={waitlistInfoOpen}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['detailsStep.waitlistInfoTitle']()}</DialogTitle>
		</DialogHeader>
		<div class="space-y-3 text-sm text-muted-foreground">
			<p>{m['detailsStep.waitlistInfoBody1']()}</p>
			<p>{m['detailsStep.waitlistInfoBody2']()}</p>
			<p>{m['detailsStep.waitlistInfoBody3']()}</p>
			<a
				href="https://github.com/letsrevel/revel-backend/issues/2"
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-1 text-primary hover:underline"
			>
				{m['detailsStep.waitlistInfoFeedbackCta']()}
				<ExternalLink class="h-3.5 w-3.5" aria-hidden="true" />
				<span class="sr-only">({m['common.opensInNewTab']()})</span>
			</a>
		</div>
	</DialogContent>
</Dialog>
