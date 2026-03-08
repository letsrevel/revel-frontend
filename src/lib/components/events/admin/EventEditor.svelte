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
	import EssentialsStep from './EssentialsStep.svelte';
	import DetailsStep from './DetailsStep.svelte';
	import EventResources from './EventResources.svelte';
	import TicketingStep from './TicketingStep.svelte';
	import SaveBar from './SaveBar.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	import { toast } from 'svelte-sonner';

	interface Props {
		organization: OrganizationRetrieveSchema;
		existingEvent?: EventDetailSchema;
		userCity?: CitySchema | null;
		orgCity?: CitySchema | null;
		eventSeries?: Array<{ id: string; [key: string]: unknown }>;
		questionnaires?: Array<{ id: string; [key: string]: unknown }>;
		initialTab?: 'details' | 'ticketing';
	}

	let {
		organization,
		existingEvent,
		userCity,
		orgCity,
		eventSeries = [],
		initialTab
	}: Props = $props();

	const queryClient = useQueryClient();

	// State management
	let eventId = $state<string | null>(existingEvent?.id || null);
	let isSaving = $state(false);
	let errorMessage = $state<string | null>(null);
	let selectedResourceIds = $state<string[]>([]);
	let initialResourceIds = $state<string[]>([]);
	let assignedQuestionnaires = $state<OrganizationQuestionnaireInListSchema[]>([]);
	let initialTags = $state<string[]>(existingEvent?.tags || []);

	// Form data state (must be declared before derived state that references it)
	let formData = $state<
		Partial<EventCreateSchema> & {
			tags?: string[];
			logo?: string;
			cover_art?: string;
			organization_logo?: string;
			organization_cover_art?: string;
			requires_ticket?: boolean;
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
		event_type: (existingEvent?.event_type as any) || ('public' as any),
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

	// Editor state (after formData so derived can reference it)
	let eventCreated = $state(false);
	let activeTab = $state<'details' | 'ticketing'>(initialTab ?? 'details');
	let isEditMode = $derived(!!existingEvent);
	let showTabs = $derived(isEditMode && !!formData.requires_ticket);
	let tabsEl = $state<HTMLDivElement | null>(null);

	// Scroll to tabs when arriving with initialTab from another page
	$effect(() => {
		if (initialTab && tabsEl) {
			// Use tick to ensure DOM is rendered
			requestAnimationFrame(() => {
				tabsEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});
		}
	});

	// Fetch resources and questionnaires for existing events
	$effect(() => {
		if (existingEvent?.id) {
			eventpublicdetailsListResources({
				path: { event_id: existingEvent.id }
			}).then((response) => {
				if (response.data?.results) {
					const resourceIds = response.data.results
						.map((resource) => resource.id)
						.filter((id): id is string => id != null);
					selectedResourceIds = resourceIds;
					initialResourceIds = [...resourceIds];
				}
			});

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

	// Location selection state
	let selectedCity = $state<CitySchema | null>(existingEvent?.city || orgCity || userCity || null);
	let selectedVenue = $state<VenueDetailSchema | null>(
		existingEvent?.venue ? (existingEvent.venue as VenueDetailSchema) : null
	);

	function handleCitySelect(city: CitySchema | null): void {
		selectedCity = city;
		formData = { ...formData, city_id: city?.id || null };
	}

	function handleVenueSelect(venue: VenueDetailSchema | null): void {
		selectedVenue = venue;
		if (venue) {
			if (venue.city) {
				selectedCity = venue.city;
				formData = {
					...formData,
					venue_id: venue.id,
					city_id: venue.city.id,
					address: venue.address || null
				};
			} else {
				formData = { ...formData, venue_id: venue.id, address: venue.address || null };
			}
		} else {
			formData = { ...formData, venue_id: null };
		}
	}

	// Image uploads
	let logoFile = $state<File | null>(null);
	let coverArtFile = $state<File | null>(null);
	let deleteLogo = $state(false);
	let deleteCoverArt = $state(false);

	// Validation errors
	let validationErrors = $state<Record<string, string>>({});

	// --- Mutations ---

	const createEventMutation = createMutation(() => ({
		mutationFn: async (data: EventCreateSchema) => {
			const response = await organizationadmincoreCreateEvent({
				path: { slug: organization.slug },
				body: data
			});
			if (!response.data) throw new Error(m['eventWizard.error_failedToCreate']());
			return response.data;
		},
		onError: (error: Error) => {
			errorMessage = error.message || m['eventWizard.error_failedToCreate']();
		}
	}));

	const updateEventMutation = createMutation(() => ({
		mutationFn: async ({ id, data }: { id: string; data: Partial<EventEditSchema> }) => {
			const response = await eventadmincoreUpdateEvent({
				path: { event_id: id },
				body: data as EventEditSchema
			});
			if (!response.data) throw new Error(m['eventWizard.error_failedToUpdate']());
			return response.data;
		},
		onError: (error: Error) => {
			errorMessage = error.message || m['eventWizard.error_failedToUpdate']();
		}
	}));

	const uploadLogoMutation = createMutation(() => ({
		mutationFn: async ({ id, file }: { id: string; file: File }) => {
			const response = await eventadmincoreUploadLogo({
				path: { event_id: id },
				body: { logo: file }
			});
			if (!response.data) throw new Error(m['eventWizard.error_failedToUploadLogo']());
			return response.data;
		}
	}));

	const uploadCoverArtMutation = createMutation(() => ({
		mutationFn: async ({ id, file }: { id: string; file: File }) => {
			const response = await eventadmincoreUploadCoverArt({
				path: { event_id: id },
				body: { cover_art: file }
			});
			if (!response.data) throw new Error(m['eventWizard.error_failedToUploadCoverArt']());
			return response.data;
		}
	}));

	const deleteLogoMutation = createMutation(() => ({
		mutationFn: async (id: string) => {
			const response = await eventadmincoreDeleteLogo({ path: { event_id: id } });
			if (response.error) throw new Error(m['eventWizard.error_failedToDeleteLogo']());
			return response.data;
		}
	}));

	const deleteCoverArtMutation = createMutation(() => ({
		mutationFn: async (id: string) => {
			const response = await eventadmincoreDeleteCoverArt({ path: { event_id: id } });
			if (response.error) throw new Error(m['eventWizard.error_failedToDeleteCoverArt']());
			return response.data;
		}
	}));

	// --- Resource & Tag Associations ---

	async function saveResourceAssociations(currentEventId: string): Promise<void> {
		const addedResourceIds = selectedResourceIds.filter((id) => !initialResourceIds.includes(id));
		const removedResourceIds = initialResourceIds.filter((id) => !selectedResourceIds.includes(id));

		const updatePromises: Promise<unknown>[] = [];

		for (const resourceId of addedResourceIds) {
			const promise = (async () => {
				const resourceResponse = await organizationadminresourcesGetResource({
					path: { slug: organization.slug, resource_id: resourceId }
				});
				if (resourceResponse.data) {
					const currentEventIds = resourceResponse.data.event_ids || [];
					if (!currentEventIds.includes(currentEventId)) {
						await organizationadminresourcesUpdateResource({
							path: { slug: organization.slug, resource_id: resourceId },
							body: { event_ids: [...currentEventIds, currentEventId] }
						});
					}
				}
			})();
			updatePromises.push(promise);
		}

		for (const resourceId of removedResourceIds) {
			const promise = (async () => {
				const resourceResponse = await organizationadminresourcesGetResource({
					path: { slug: organization.slug, resource_id: resourceId }
				});
				if (resourceResponse.data) {
					const currentEventIds = resourceResponse.data.event_ids || [];
					await organizationadminresourcesUpdateResource({
						path: { slug: organization.slug, resource_id: resourceId },
						body: { event_ids: currentEventIds.filter((id) => id !== currentEventId) }
					});
				}
			})();
			updatePromises.push(promise);
		}

		await Promise.all(updatePromises);
	}

	async function saveTagAssociations(currentEventId: string): Promise<void> {
		const currentTags = formData.tags || [];
		const addedTags = currentTags.filter((tag) => !initialTags.includes(tag));
		const removedTags = initialTags.filter((tag) => !currentTags.includes(tag));

		if (addedTags.length > 0) {
			await eventadmincoreAddTags({
				path: { event_id: currentEventId },
				body: { tags: addedTags }
			});
		}

		if (removedTags.length > 0) {
			await eventadmincoreRemoveTags({
				path: { event_id: currentEventId },
				body: { tags: removedTags }
			});
		}

		initialTags = [...currentTags];
	}

	// --- Validation ---

	function validateEssentials(): boolean {
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
		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	function validateDetails(): boolean {
		const errors: Record<string, string> = {};
		if (!formData.city_id) {
			errors.city_id = m['eventWizard.error_cityRequired']();
		}
		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	// --- Creation flow: Step 1 submit ---

	async function handleCreateEvent(): Promise<void> {
		if (!validateEssentials()) {
			errorMessage = m['eventWizard.error_fixValidation']();
			return;
		}

		errorMessage = null;
		isSaving = true;

		try {
			const createData: EventCreateSchema = {
				name: formData.name!,
				start: toISOString(formData.start)!,
				city_id: formData.city_id!,
				visibility: formData.visibility || 'public',
				event_type: (formData.event_type || 'public') as any,
				status: 'draft' as any,
				requires_ticket: formData.requires_ticket || false,
				requires_full_profile: formData.requires_full_profile || false,
				venue_id: formData.venue_id || null
			} as any;

			const result = await createEventMutation.mutateAsync(createData);
			eventId = result.id;
			eventCreated = true;
			toast.success(m['eventWizard.eventCreatedSuccess']());
		} catch (error) {
			console.error('Create event error:', error);
		} finally {
			isSaving = false;
		}
	}

	// --- Unified save function ---

	async function handleSave(andExit: boolean): Promise<void> {
		if (!validateEssentials() || !validateDetails()) {
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
			const updateData: Partial<EventEditSchema> = {
				name: formData.name!,
				start: toISOString(formData.start)!,
				city_id: formData.city_id!,
				visibility: formData.visibility || 'public',
				event_type: (formData.event_type || 'public') as any,
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

			// Handle images
			if (deleteLogo) await deleteLogoMutation.mutateAsync(eventId);
			if (deleteCoverArt) await deleteCoverArtMutation.mutateAsync(eventId);
			if (logoFile) await uploadLogoMutation.mutateAsync({ id: eventId, file: logoFile });
			if (coverArtFile)
				await uploadCoverArtMutation.mutateAsync({ id: eventId, file: coverArtFile });

			// Save associations
			await saveResourceAssociations(eventId);
			await saveTagAssociations(eventId);

			// Invalidate queries
			queryClient.invalidateQueries({ queryKey: ['events'] });
			queryClient.invalidateQueries({ queryKey: ['event', eventId] });

			toast.success(m['eventWizard.eventUpdatedSuccess']());

			if (andExit) {
				goto(`/org/${organization.slug}/admin/events`);
			} else if (!isEditMode) {
				// Creation flow: redirect to edit page so user gets tabs & status management
				goto(`/org/${organization.slug}/admin/events/${eventId}/edit`);
			}
		} catch (error) {
			console.error('Save error:', error);
			errorMessage = m['eventWizard.error_failedToSaveDetails']();
		} finally {
			isSaving = false;
		}
	}

	// --- Form data update helpers ---

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

	function updateImages(data: {
		logo?: File | null;
		coverArt?: File | null;
		deleteLogo?: boolean;
		deleteCoverArt?: boolean;
	}): void {
		if (data.logo !== undefined) logoFile = data.logo;
		if (data.coverArt !== undefined) coverArtFile = data.coverArt;
		if (data.deleteLogo !== undefined) deleteLogo = data.deleteLogo;
		if (data.deleteCoverArt !== undefined) deleteCoverArt = data.deleteCoverArt;
	}

	// --- Tab URL sync ---

	function handleTabChange(value: string): void {
		activeTab = value as 'details' | 'ticketing';
		if (isEditMode) {
			const url = new URL(window.location.href);
			if (value === 'details') {
				url.searchParams.delete('tab');
			} else {
				url.searchParams.set('tab', value);
			}
			goto(url.pathname + url.search, { replaceState: true, noScroll: true });
		}
	}
</script>

<div class="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
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

	<!-- CREATION MODE: Show essentials with own form first -->
	{#if !isEditMode && !eventCreated}
		<EssentialsStep
			{formData}
			{validationErrors}
			isEditMode={false}
			onUpdate={updateFormData}
			onSubmit={handleCreateEvent}
			{isSaving}
			standalone={true}
			organizationSlug={organization.slug}
		/>
	{:else}
		<!-- EDIT MODE or POST-CREATION: Save bars + all sections -->
		<SaveBar
			{isSaving}
			onSave={() => handleSave(false)}
			onSaveAndExit={() => handleSave(true)}
			position="top"
		/>

		<!-- Essentials (always visible, no own form) -->
		<EssentialsStep
			{formData}
			{validationErrors}
			{isEditMode}
			onUpdate={updateFormData}
			onSubmit={() => handleSave(false)}
			{isSaving}
			standalone={false}
			eventId={existingEvent?.id ?? eventId ?? undefined}
			eventSlug={existingEvent?.slug}
			organizationSlug={organization.slug}
		/>

		<!-- Tabs (only for ticketed events in edit mode) -->
		{#if showTabs}
			<div bind:this={tabsEl}></div>
			<Tabs.Root value={activeTab} onValueChange={handleTabChange}>
				<Tabs.List class="w-full">
					<Tabs.Trigger value="details" class="flex-1">
						{m['eventEditor.tabDetails']()}
					</Tabs.Trigger>
					<Tabs.Trigger value="ticketing" class="flex-1">
						{m['eventEditor.tabTicketing']()}
					</Tabs.Trigger>
				</Tabs.List>

				<Tabs.Content value="details" class="mt-6 space-y-6">
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

					{#if eventId}
						<EventResources
							organizationSlug={organization.slug}
							{eventId}
							{selectedResourceIds}
							onSelectionChange={(ids) => (selectedResourceIds = ids)}
						/>
					{/if}
				</Tabs.Content>

				<Tabs.Content value="ticketing" class="mt-6">
					{#if eventId}
						<TicketingStep
							{eventId}
							organizationSlug={organization.slug}
							organizationStripeConnected={organization.is_stripe_connected}
							{formData}
							onUpdate={updateFormData}
							onBack={() => handleTabChange('details')}
							onNext={() => handleSave(true)}
							standalone={false}
						/>
					{/if}
				</Tabs.Content>
			</Tabs.Root>
		{:else}
			<!-- Non-ticketed: Details + Resources directly -->
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

				{#if eventId}
					<EventResources
						organizationSlug={organization.slug}
						{eventId}
						{selectedResourceIds}
						onSelectionChange={(ids) => (selectedResourceIds = ids)}
					/>
				{/if}
			</div>
		{/if}

		<SaveBar
			{isSaving}
			onSave={() => handleSave(false)}
			onSaveAndExit={() => handleSave(true)}
			position="bottom"
		/>
	{/if}
</div>
