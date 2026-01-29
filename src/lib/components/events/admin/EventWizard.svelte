<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadmincoreCreateEvent,
		eventadmincoreUpdateEvent,
		eventadmincoreUploadLogo,
		eventadmincoreUploadCoverArt,
		eventadmincoreDeleteLogo,
		eventadmincoreDeleteCoverArt,
		eventpublicdetailsListResources,
		organizationadminresourcesGetResource,
		organizationadminresourcesUpdateResource,
		questionnaireListOrgQuestionnaires,
		eventadmincoreAddTags,
		eventadmincoreRemoveTags
	} from '$lib/api/generated/sdk.gen';
	import { toDateTimeLocal, toISOString } from '$lib/utils/datetime';
	import type {
		EventCreateSchema,
		EventEditSchema,
		EventDetailSchema,
		CitySchema,
		VenueDetailSchema,
		OrganizationRetrieveSchema,
		OrganizationQuestionnaireInListSchema,
		ResourceVisibility
	} from '$lib/api/generated/types.gen';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { cn } from '$lib/utils/cn';
	import EssentialsStep from './EssentialsStep.svelte';
	import DetailsStep from './DetailsStep.svelte';
	import EventResources from './EventResources.svelte';
	import TicketingStep from './TicketingStep.svelte';
	import { Save } from 'lucide-svelte';

	interface Props {
		organization: OrganizationRetrieveSchema;
		existingEvent?: EventDetailSchema;
		userCity?: CitySchema | null;
		orgCity?: CitySchema | null;
		// Event series and questionnaires can be any objects with id - types will be fixed when backend API is correct
		eventSeries?: Array<{ id: string; [key: string]: unknown }>;
		questionnaires?: Array<{ id: string; [key: string]: unknown }>;
	}

	let { organization, existingEvent, userCity, orgCity, eventSeries = [] }: Props = $props();
	// questionnaires prop exists but is not currently used

	const queryClient = useQueryClient();

	// State management
	let currentStep = $state<1 | 2 | 3 | 4>(1);
	let eventId = $state<string | null>(existingEvent?.id || null);
	let isSaving = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let selectedResourceIds = $state<string[]>([]);
	let initialResourceIds = $state<string[]>([]); // Track initial state for comparison
	let assignedQuestionnaires = $state<OrganizationQuestionnaireInListSchema[]>([]);
	let initialTags = $state<string[]>(existingEvent?.tags || []); // Track initial tags for comparison

	// Auto-scroll to top when step changes
	$effect(() => {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	});

	// Fetch and pre-select resources and questionnaires when editing an existing event
	$effect(() => {
		if (existingEvent?.id) {
			// Fetch resources for this event
			eventpublicdetailsListResources({
				path: {
					event_id: existingEvent.id
				}
			}).then((response) => {
				if (response.data?.results) {
					// Extract resource IDs and set them as selected (filter out null/undefined)
					const resourceIds = response.data.results
						.map((resource) => resource.id)
						.filter((id): id is string => id != null);
					selectedResourceIds = resourceIds;
					initialResourceIds = [...resourceIds]; // Store initial state
				}
			});

			// Fetch questionnaires assigned to this event
			questionnaireListOrgQuestionnaires({
				query: {
					organization_id: organization.id,
					event_id: existingEvent.id
				}
			}).then((response) => {
				if (response.data?.results) {
					assignedQuestionnaires = response.data.results;
				}
			});
		}
	});

	// Note: Using shared utility functions toDateTimeLocal and toISOString from $lib/utils/datetime
	// These functions handle timezone conversions properly

	// Form data state (matches EventCreateSchema + additional image URLs)
	// Note: requires_ticket is not in EventCreateSchema but exists on EventDetailSchema
	let formData = $state<
		Partial<EventCreateSchema> & {
			tags?: string[];
			logo?: string;
			cover_art?: string;
			organization_logo?: string;
			organization_cover_art?: string;
			requires_ticket?: boolean; // Not in API schema yet, but used in UI
			address_visibility?: ResourceVisibility;
			venue_id?: string | null;
			location_maps_url?: string | null;
			location_maps_embed?: string | null;
		}
	>({
		name: existingEvent?.name || '',
		start: toDateTimeLocal(existingEvent?.start) || '',
		end: toDateTimeLocal(existingEvent?.end) || '',
		city_id: existingEvent?.city?.id || orgCity?.id || userCity?.id || null,
		visibility: existingEvent?.visibility || 'public',
		event_type: (existingEvent?.event_type as any) || ('public' as any), // Backend API has wrong enum type
		requires_ticket: (existingEvent as any)?.requires_ticket || false,
		description: existingEvent?.description || '',
		address: existingEvent?.address || '',
		address_visibility: (existingEvent as any)?.address_visibility || 'public',
		rsvp_before: toDateTimeLocal(existingEvent?.rsvp_before) || null,
		max_attendees: existingEvent?.max_attendees || undefined,
		max_tickets_per_user: (existingEvent as any)?.max_tickets_per_user ?? 1,
		waitlist_open: existingEvent?.waitlist_open || false,
		invitation_message: existingEvent?.invitation_message || '',
		check_in_starts_at: toDateTimeLocal((existingEvent as any)?.check_in_starts_at) || null,
		check_in_ends_at: toDateTimeLocal((existingEvent as any)?.check_in_ends_at) || null,
		potluck_open: existingEvent?.potluck_open || false,
		accept_invitation_requests: existingEvent?.accept_invitation_requests || false,
		apply_before: toDateTimeLocal((existingEvent as any)?.apply_before) || null,
		can_attend_without_login: existingEvent?.can_attend_without_login || false,
		requires_full_profile: (existingEvent as any)?.requires_full_profile || false,
		event_series_id: existingEvent?.event_series?.id || null,
		venue_id: existingEvent?.venue?.id || null,
		tags: existingEvent?.tags || [],
		logo: existingEvent?.logo || undefined,
		cover_art: existingEvent?.cover_art || undefined,
		organization_logo: organization.logo || undefined,
		organization_cover_art: organization.cover_art || undefined,
		location_maps_url: (existingEvent as any)?.location_maps_url || null,
		location_maps_embed: (existingEvent as any)?.location_maps_embed || null
	});

	// Location selection state (for Step 2)
	let selectedCity = $state<CitySchema | null>(existingEvent?.city || orgCity || userCity || null);
	let selectedVenue = $state<VenueDetailSchema | null>(
		existingEvent?.venue ? (existingEvent.venue as VenueDetailSchema) : null
	);

	/**
	 * Handle city selection in Step 2
	 */
	function handleCitySelect(city: CitySchema | null): void {
		selectedCity = city;
		formData = { ...formData, city_id: city?.id || null };
	}

	/**
	 * Handle venue selection in Step 2
	 */
	function handleVenueSelect(venue: VenueDetailSchema | null): void {
		selectedVenue = venue;
		if (venue) {
			// Auto-populate city from venue
			if (venue.city) {
				selectedCity = venue.city;
				formData = {
					...formData,
					venue_id: venue.id,
					city_id: venue.city.id,
					address: venue.address || null
				};
			} else {
				formData = {
					...formData,
					venue_id: venue.id,
					address: venue.address || null
				};
			}
		} else {
			formData = { ...formData, venue_id: null };
		}
	}

	// Image uploads (separate from form data)
	let logoFile = $state<File | null>(null);
	let coverArtFile = $state<File | null>(null);
	let deleteLogo = $state(false);
	let deleteCoverArt = $state(false);

	// Validation errors
	let validationErrors = $state<Record<string, string>>({});

	// Create event mutation
	const createEventMutation = createMutation(() => ({
		mutationFn: async (data: EventCreateSchema) => {
			const response = await organizationadmincoreCreateEvent({
				path: { slug: organization.slug },
				body: data
			});

			if (!response.data) {
				throw new Error(m['eventWizard.error_failedToCreate']());
			}

			return response.data;
		},
		onSuccess: (data) => {
			eventId = data.id;
			successMessage = m['eventWizard.eventCreatedSuccess']();
			setTimeout(() => {
				successMessage = null;
			}, 3000);
		},
		onError: (error: Error) => {
			errorMessage = error.message || m['eventWizard.error_failedToCreate']();
		}
	}));

	// Update event mutation
	const updateEventMutation = createMutation(() => ({
		mutationFn: async ({ id, data }: { id: string; data: Partial<EventEditSchema> }) => {
			const response = await eventadmincoreUpdateEvent({
				path: { event_id: id },
				body: data as EventEditSchema
			});

			if (!response.data) {
				throw new Error(m['eventWizard.error_failedToUpdate']());
			}

			return response.data;
		},
		onSuccess: () => {
			successMessage = m['eventWizard.eventUpdatedSuccess']();
			setTimeout(() => {
				successMessage = null;
			}, 3000);
		},
		onError: (error: Error) => {
			errorMessage = error.message || m['eventWizard.error_failedToUpdate']();
		}
	}));

	// Upload logo mutation
	const uploadLogoMutation = createMutation(() => ({
		mutationFn: async ({ id, file }: { id: string; file: File }) => {
			const response = await eventadmincoreUploadLogo({
				path: { event_id: id },
				body: { logo: file }
			});

			if (!response.data) {
				throw new Error(m['eventWizard.error_failedToUploadLogo']());
			}

			return response.data;
		}
	}));

	// Upload cover art mutation
	const uploadCoverArtMutation = createMutation(() => ({
		mutationFn: async ({ id, file }: { id: string; file: File }) => {
			const response = await eventadmincoreUploadCoverArt({
				path: { event_id: id },
				body: { cover_art: file }
			});

			if (!response.data) {
				throw new Error(m['eventWizard.error_failedToUploadCoverArt']());
			}

			return response.data;
		}
	}));

	// Delete logo mutation
	const deleteLogoMutation = createMutation(() => ({
		mutationFn: async (id: string) => {
			const response = await eventadmincoreDeleteLogo({
				path: { event_id: id }
			});

			if (response.error) {
				throw new Error(m['eventWizard.error_failedToDeleteLogo']());
			}

			return response.data;
		}
	}));

	// Delete cover art mutation
	const deleteCoverArtMutation = createMutation(() => ({
		mutationFn: async (id: string) => {
			const response = await eventadmincoreDeleteCoverArt({
				path: { event_id: id }
			});

			if (response.error) {
				throw new Error(m['eventWizard.error_failedToDeleteCoverArt']());
			}

			return response.data;
		}
	}));

	/**
	 * Save resource associations for the event
	 * Updates resources to add/remove the event ID from their event_ids array
	 */
	async function saveResourceAssociations(currentEventId: string): Promise<void> {
		// Determine which resources were added and removed
		const addedResourceIds = selectedResourceIds.filter((id) => !initialResourceIds.includes(id));
		const removedResourceIds = initialResourceIds.filter((id) => !selectedResourceIds.includes(id));

		// Update all affected resources
		const updatePromises: Promise<unknown>[] = [];

		// Add event to newly selected resources
		for (const resourceId of addedResourceIds) {
			const promise = (async () => {
				// Fetch current resource state
				const resourceResponse = await organizationadminresourcesGetResource({
					path: {
						slug: organization.slug,
						resource_id: resourceId
					}
				});

				if (resourceResponse.data) {
					const currentEventIds = resourceResponse.data.event_ids || [];
					// Add this event if not already present
					if (!currentEventIds.includes(currentEventId)) {
						await organizationadminresourcesUpdateResource({
							path: {
								slug: organization.slug,
								resource_id: resourceId
							},
							body: {
								event_ids: [...currentEventIds, currentEventId]
							}
						});
					}
				}
			})();
			updatePromises.push(promise);
		}

		// Remove event from deselected resources
		for (const resourceId of removedResourceIds) {
			const promise = (async () => {
				// Fetch current resource state
				const resourceResponse = await organizationadminresourcesGetResource({
					path: {
						slug: organization.slug,
						resource_id: resourceId
					}
				});

				if (resourceResponse.data) {
					const currentEventIds = resourceResponse.data.event_ids || [];
					// Remove this event
					await organizationadminresourcesUpdateResource({
						path: {
							slug: organization.slug,
							resource_id: resourceId
						},
						body: {
							event_ids: currentEventIds.filter((id) => id !== currentEventId)
						}
					});
				}
			})();
			updatePromises.push(promise);
		}

		// Wait for all updates to complete
		await Promise.all(updatePromises);
	}

	/**
	 * Save tag associations (add/remove tags)
	 */
	async function saveTagAssociations(currentEventId: string): Promise<void> {
		const currentTags = formData.tags || [];

		// Determine which tags were added and removed
		const addedTags = currentTags.filter((tag) => !initialTags.includes(tag));
		const removedTags = initialTags.filter((tag) => !currentTags.includes(tag));

		// Add new tags
		if (addedTags.length > 0) {
			await eventadmincoreAddTags({
				path: { event_id: currentEventId },
				body: { tags: addedTags }
			});
		}

		// Remove deleted tags
		if (removedTags.length > 0) {
			await eventadmincoreRemoveTags({
				path: { event_id: currentEventId },
				body: { tags: removedTags }
			});
		}

		// Update initialTags to current state for future comparisons
		initialTags = [...currentTags];
	}

	/**
	 * Validate Step 1 (Essentials)
	 */
	function validateStep1(): boolean {
		const errors: Record<string, string> = {};

		if (!formData.name || formData.name.trim().length < 3) {
			errors.name = m['eventWizard.error_nameRequired']();
		}

		if (!formData.start) {
			errors.start = m['eventWizard.error_startRequired']();
		} else {
			const startDate = new Date(formData.start);
			if (startDate <= new Date()) {
				errors.start = m['eventWizard.error_startFuture']();
			}
		}

		// Note: city_id validation moved to Step 2 (LocationSection)

		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	/**
	 * Validate Step 2 (Details) - validates city is selected
	 */
	function validateStep2(): boolean {
		const errors: Record<string, string> = {};

		if (!formData.city_id) {
			errors.city_id = m['eventWizard.error_cityRequired']();
		}

		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	/**
	 * Handle Step 1 submission (Create Event)
	 */
	async function handleStep1Submit(): Promise<void> {
		if (!validateStep1()) {
			errorMessage = m['eventWizard.error_fixValidation']();
			return;
		}

		errorMessage = null;
		isSaving = true;

		try {
			// Prepare data for API - convert datetime-local to ISO with timezone
			// Note: Backend API has incorrect enum types, using type assertions as workaround

			if (eventId) {
				// Update existing event - MUST include ALL fields because backend uses PUT (full replacement)
				const updateData: Partial<EventEditSchema> = {
					name: formData.name!,
					start: toISOString(formData.start)!,
					city_id: formData.city_id!,
					visibility: formData.visibility || 'public',
					event_type: (formData.event_type || 'public') as any,
					// Include all other fields to prevent them from being reset
					description: formData.description || null,
					end: toISOString(formData.end),
					address: formData.address || null,
					address_visibility: formData.address_visibility || 'public',
					rsvp_before: toISOString(formData.rsvp_before),
					max_attendees: formData.max_attendees || undefined,
					max_tickets_per_user: formData.max_tickets_per_user ?? 1,
					waitlist_open: formData.waitlist_open || false,
					invitation_message: formData.invitation_message || null,
					check_in_starts_at: toISOString(formData.check_in_starts_at),
					check_in_ends_at: toISOString(formData.check_in_ends_at),
					potluck_open: formData.potluck_open || false,
					accept_invitation_requests: formData.accept_invitation_requests || false,
					apply_before: toISOString(formData.apply_before),
					can_attend_without_login: formData.can_attend_without_login || false,
					requires_full_profile: formData.requires_full_profile || false,
					event_series_id: formData.event_series_id || null,
					venue_id: formData.venue_id || null,
					location_maps_url: formData.location_maps_url || null,
					location_maps_embed: formData.location_maps_embed || null
				};
				await updateEventMutation.mutateAsync({ id: eventId, data: updateData });
			} else {
				// Create new event - only essential fields needed
				const createData: EventCreateSchema = {
					name: formData.name!,
					start: toISOString(formData.start)!,
					city_id: formData.city_id!,
					visibility: formData.visibility || 'public',
					event_type: (formData.event_type || 'public') as any, // Backend has wrong enum
					status: 'draft' as any, // Create as draft by default
					requires_ticket: formData.requires_ticket || false, // Send explicit false when unchecked
					requires_full_profile: formData.requires_full_profile || false,
					venue_id: formData.venue_id || null
				} as any; // Cast to any because requires_ticket is not yet in backend schema

				const result = await createEventMutation.mutateAsync(createData);
				eventId = result.id;
			}

			// Move to Step 2
			currentStep = 2;

			// Scroll to top for better UX
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} catch (error) {
			console.error('Step 1 submission error:', error);
		} finally {
			isSaving = false;
		}
	}

	/**
	 * Handle Step 2 submission (Save & Exit)
	 */
	async function handleStep2Submit(): Promise<void> {
		// Validate Step 2 (city_id is required)
		if (!validateStep2()) {
			errorMessage = m['eventWizard.error_fixValidation']();
			return;
		}

		if (!eventId) {
			errorMessage = m['eventWizard.error_eventIdNotFound']();
			return;
		}

		errorMessage = null;
		isSaving = true;

		try {
			// Update event with all details - convert datetime-local to ISO with timezone
			const updateData: Partial<EventEditSchema> = {
				city_id: formData.city_id!, // Now required from LocationSection
				description: formData.description || null,
				end: toISOString(formData.end),
				address: formData.address || null,
				address_visibility: formData.address_visibility || 'public',
				rsvp_before: toISOString(formData.rsvp_before),
				max_attendees: formData.max_attendees || undefined,
				max_tickets_per_user: formData.max_tickets_per_user ?? 1,
				waitlist_open: formData.waitlist_open || false,
				invitation_message: formData.invitation_message || null,
				check_in_starts_at: toISOString(formData.check_in_starts_at),
				check_in_ends_at: toISOString(formData.check_in_ends_at),
				potluck_open: formData.potluck_open || false,
				accept_invitation_requests: formData.accept_invitation_requests || false,
				apply_before: toISOString(formData.apply_before),
				can_attend_without_login: formData.can_attend_without_login || false,
				requires_full_profile: formData.requires_full_profile || false,
				event_series_id: formData.event_series_id || null,
				venue_id: formData.venue_id || null,
				location_maps_url: formData.location_maps_url || null,
				location_maps_embed: formData.location_maps_embed || null
			};

			await updateEventMutation.mutateAsync({ id: eventId, data: updateData });

			// Handle logo deletion
			if (deleteLogo) {
				await deleteLogoMutation.mutateAsync(eventId);
			}

			// Handle cover art deletion
			if (deleteCoverArt) {
				await deleteCoverArtMutation.mutateAsync(eventId);
			}

			// Upload images if provided (after deletion to ensure clean state)
			if (logoFile) {
				await uploadLogoMutation.mutateAsync({ id: eventId, file: logoFile });
			}

			if (coverArtFile) {
				await uploadCoverArtMutation.mutateAsync({ id: eventId, file: coverArtFile });
			}

			// Save resource associations
			await saveResourceAssociations(eventId);

			// Save tag associations (add/remove tags)
			await saveTagAssociations(eventId);

			// Invalidate queries
			queryClient.invalidateQueries({ queryKey: ['events'] });
			queryClient.invalidateQueries({ queryKey: ['event', eventId] });

			// Redirect to events list
			goto(`/org/${organization.slug}/admin/events`);
		} catch (error) {
			console.error('Step 2 submission error:', error);
			errorMessage = m['eventWizard.error_failedToSaveDetails']();
		} finally {
			isSaving = false;
		}
	}

	/**
	 * Handle back to Step 1
	 */
	function handleBackToStep1(): void {
		currentStep = 1;
		errorMessage = null;
	}

	/**
	 * Update form data
	 */
	function updateFormData(
		updates: Partial<EventCreateSchema> & {
			tags?: string[];
			logo?: string;
			cover_art?: string;
			organization_logo?: string;
			organization_cover_art?: string;
			address_visibility?: ResourceVisibility;
			venue_id?: string | null;
			location_maps_url?: string | null;
			location_maps_embed?: string | null;
		}
	): void {
		formData = { ...formData, ...updates };
	}

	/**
	 * Update images
	 */
	function updateImages(data: {
		logo?: File | null;
		coverArt?: File | null;
		deleteLogo?: boolean;
		deleteCoverArt?: boolean;
	}): void {
		if (data.logo !== undefined) {
			logoFile = data.logo;
		}
		if (data.coverArt !== undefined) {
			coverArtFile = data.coverArt;
		}
		if (data.deleteLogo !== undefined) {
			deleteLogo = data.deleteLogo;
		}
		if (data.deleteCoverArt !== undefined) {
			deleteCoverArt = data.deleteCoverArt;
		}
	}

	// Derived state
	let isEditMode = $derived(!!existingEvent);
</script>

<div class="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
	<!-- Header -->
	<div class="space-y-2">
		<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
			{isEditMode ? m['eventWizard.titleEdit']() : m['eventWizard.titleCreate']()}
		</h1>
		<p class="text-muted-foreground">
			{currentStep === 1
				? m['eventWizard.step1Description']()
				: m['eventWizard.step2Description']()}
		</p>
	</div>

	<!-- Step indicator -->
	<div class="flex items-center gap-4">
		<div
			class={cn(
				'flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-colors',
				currentStep === 1
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-green-600 bg-green-600 text-white'
			)}
			aria-current={currentStep === 1 ? 'step' : undefined}
		>
			1
		</div>
		<div class="h-0.5 flex-1 bg-border"></div>
		<div
			class={cn(
				'flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-colors',
				currentStep === 2
					? 'border-primary bg-primary text-primary-foreground'
					: currentStep > 2
						? 'border-green-600 bg-green-600 text-white'
						: 'border-border bg-background text-muted-foreground'
			)}
			aria-current={currentStep === 2 ? 'step' : undefined}
		>
			2
		</div>

		{#if formData.requires_ticket && eventId}
			<div class="h-0.5 flex-1 bg-border"></div>
			<div
				class={cn(
					'flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-colors',
					currentStep === 3
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-border bg-background text-muted-foreground'
				)}
				aria-current={currentStep === 3 ? 'step' : undefined}
			>
				3
			</div>
		{/if}
	</div>

	<!-- Success message -->
	{#if successMessage}
		<div
			class="rounded-md bg-green-50 p-4 text-green-900 dark:bg-green-950/50 dark:text-green-100"
			role="status"
			aria-live="polite"
		>
			<p class="font-semibold">{successMessage}</p>
		</div>
	{/if}

	<!-- Error message -->
	{#if errorMessage}
		<div
			class="rounded-md bg-destructive/10 p-4 text-destructive"
			role="alert"
			aria-live="assertive"
		>
			<p class="font-semibold">{m['eventWizard.error']()}</p>
			<p class="mt-1 text-sm">{errorMessage}</p>
		</div>
	{/if}

	<!-- Step content -->
	{#if currentStep === 1}
		<EssentialsStep
			{formData}
			{validationErrors}
			{isEditMode}
			onUpdate={updateFormData}
			onSubmit={handleStep1Submit}
			{isSaving}
			eventId={existingEvent?.id}
			eventSlug={existingEvent?.slug}
			organizationSlug={organization.slug}
		/>
	{:else if currentStep === 2}
		<div class="space-y-6">
			<DetailsStep
				{formData}
				eventSeries={eventSeries as any}
				questionnaires={assignedQuestionnaires}
				{eventId}
				organizationId={organization.id}
				organizationSlug={organization.slug}
				accessToken={$page.data.auth?.accessToken}
				{selectedCity}
				{selectedVenue}
				{validationErrors}
				{isEditMode}
				onCitySelect={handleCitySelect}
				onVenueSelect={handleVenueSelect}
				onUpdate={updateFormData}
				onUpdateImages={updateImages}
			/>

			<!-- Resources (only show if event has been created) -->
			{#if eventId}
				<EventResources
					organizationSlug={organization.slug}
					{eventId}
					{selectedResourceIds}
					onSelectionChange={(ids) => (selectedResourceIds = ids)}
				/>
			{/if}

			<!-- Navigation -->
			<div class="flex justify-between border-t border-border pt-6">
				<button
					type="button"
					onclick={handleBackToStep1}
					class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-6 py-3 font-semibold transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					← {m['eventWizard.buttonBack']()}
				</button>
				<button
					type="button"
					onclick={() => {
						if (formData.requires_ticket && eventId) {
							// Validate step 2 before navigating to ticketing
							if (!validateStep2()) {
								errorMessage = m['eventWizard.error_fixValidation']();
								return;
							}
							errorMessage = null;
							currentStep = 3;
						} else {
							handleStep2Submit();
						}
					}}
					disabled={isSaving}
					class={cn(
						'inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						isSaving && 'cursor-not-allowed opacity-50'
					)}
				>
					{#if formData.requires_ticket && eventId}
						{m['eventWizard.buttonContinueTicketing']()} →
					{:else}
						<Save class="h-5 w-5" aria-hidden="true" />
						{isSaving ? m['eventWizard.buttonSaving']() : m['eventWizard.buttonSaveExit']()}
					{/if}
				</button>
			</div>
		</div>
	{:else if currentStep === 3 && formData.requires_ticket && eventId}
		<TicketingStep
			eventId={eventId!}
			organizationSlug={organization.slug}
			organizationStripeConnected={organization.is_stripe_connected}
			{formData}
			onUpdate={updateFormData}
			onBack={() => {
				currentStep = 2;
			}}
			onNext={handleStep2Submit}
		/>
	{/if}
</div>
