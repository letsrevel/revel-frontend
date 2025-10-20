<script lang="ts">
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminCreateEvent,
		eventadminUpdateEvent,
		eventadminUploadLogo,
		eventadminUploadCoverArt,
		eventadminDeleteLogo,
		eventadminDeleteCoverArt
	} from '$lib/api/generated/sdk.gen';
	import type {
		EventCreateSchema,
		EventEditSchema,
		EventDetailSchema,
		CitySchema,
		EventSeriesRetrieveSchema,
		QuestionnaireSchema,
		OrganizationRetrieveSchema
	} from '$lib/api/generated/types.gen';
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils/cn';
	import EssentialsStep from './EssentialsStep.svelte';
	import DetailsStep from './DetailsStep.svelte';
	import { ChevronLeft, Save } from 'lucide-svelte';

	interface Props {
		organization: OrganizationRetrieveSchema;
		existingEvent?: EventDetailSchema;
		userCity?: CitySchema | null;
		orgCity?: CitySchema | null;
		// Event series and questionnaires can be any objects with id - types will be fixed when backend API is correct
		eventSeries?: Array<{ id: string; [key: string]: unknown }>;
		questionnaires?: Array<{ id: string; [key: string]: unknown }>;
	}

	let {
		organization,
		existingEvent,
		userCity,
		orgCity,
		eventSeries = [],
		questionnaires = []
	}: Props = $props();

	const queryClient = useQueryClient();

	// State management
	let currentStep = $state<1 | 2>(1);
	let eventId = $state<string | null>(existingEvent?.id || null);
	let isSaving = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	/**
	 * Convert ISO datetime to datetime-local format (YYYY-MM-DDTHH:mm)
	 */
	function toDateTimeLocal(isoString: string | null | undefined): string {
		if (!isoString) return '';
		// Remove seconds and timezone info for datetime-local input
		return isoString.slice(0, 16);
	}

	/**
	 * Convert datetime-local format to ISO string with timezone
	 */
	function toISOString(datetimeLocal: string | null | undefined): string | null {
		if (!datetimeLocal) return null;
		// Parse as local time and convert to ISO string with timezone
		const date = new Date(datetimeLocal);
		return date.toISOString();
	}

	// Form data state (matches EventCreateSchema + additional image URLs)
	let formData = $state<
		Partial<EventCreateSchema> & {
			tags?: string[];
			logo?: string;
			cover_art?: string;
			organization_logo?: string;
			organization_cover_art?: string;
		}
	>({
		name: existingEvent?.name || '',
		start: toDateTimeLocal(existingEvent?.start) || '',
		end: toDateTimeLocal(existingEvent?.end) || '',
		city_id: existingEvent?.city?.id || orgCity?.id || userCity?.id || null,
		visibility: existingEvent?.visibility || 'public',
		event_type: existingEvent?.event_type || 'public',
		requires_ticket: existingEvent?.requires_ticket || false,
		description: existingEvent?.description || '',
		address: existingEvent?.address || '',
		rsvp_before: toDateTimeLocal(existingEvent?.rsvp_before) || null,
		free_for_members: existingEvent?.free_for_members || false,
		free_for_staff: existingEvent?.free_for_staff || false,
		max_attendees: existingEvent?.max_attendees || undefined,
		waitlist_open: existingEvent?.waitlist_open || false,
		invitation_message: existingEvent?.invitation_message || '',
		check_in_starts_at: toDateTimeLocal(existingEvent?.check_in_starts_at) || null,
		check_in_ends_at: toDateTimeLocal(existingEvent?.check_in_ends_at) || null,
		potluck_open: existingEvent?.potluck_open || false,
		event_series_id: existingEvent?.event_series?.id || null,
		tags: existingEvent?.tags || [],
		logo: existingEvent?.logo || undefined,
		cover_art: existingEvent?.cover_art || undefined,
		organization_logo: organization.logo || undefined,
		organization_cover_art: organization.cover_art || undefined
	});

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
			const response = await organizationadminCreateEvent({
				path: { slug: organization.slug },
				body: data
			});

			if (!response.data) {
				throw new Error('Failed to create event');
			}

			return response.data;
		},
		onSuccess: (data) => {
			eventId = data.id;
			successMessage = 'Event created successfully!';
			setTimeout(() => {
				successMessage = null;
			}, 3000);
		},
		onError: (error: Error) => {
			errorMessage = error.message || 'Failed to create event';
		}
	}));

	// Update event mutation
	const updateEventMutation = createMutation(() => ({
		mutationFn: async ({ id, data }: { id: string; data: Partial<EventEditSchema> }) => {
			const response = await eventadminUpdateEvent({
				path: { event_id: id },
				body: data as EventEditSchema
			});

			if (!response.data) {
				throw new Error('Failed to update event');
			}

			return response.data;
		},
		onSuccess: () => {
			successMessage = 'Event updated successfully!';
			setTimeout(() => {
				successMessage = null;
			}, 3000);
		},
		onError: (error: Error) => {
			errorMessage = error.message || 'Failed to update event';
		}
	}));

	// Upload logo mutation
	const uploadLogoMutation = createMutation(() => ({
		mutationFn: async ({ id, file }: { id: string; file: File }) => {
			const response = await eventadminUploadLogo({
				path: { event_id: id },
				body: { logo: file }
			});

			if (!response.data) {
				throw new Error('Failed to upload logo');
			}

			return response.data;
		}
	}));

	// Upload cover art mutation
	const uploadCoverArtMutation = createMutation(() => ({
		mutationFn: async ({ id, file }: { id: string; file: File }) => {
			const response = await eventadminUploadCoverArt({
				path: { event_id: id },
				body: { cover_art: file }
			});

			if (!response.data) {
				throw new Error('Failed to upload cover art');
			}

			return response.data;
		}
	}));

	// Delete logo mutation
	const deleteLogoMutation = createMutation(() => ({
		mutationFn: async (id: string) => {
			const response = await eventadminDeleteLogo({
				path: { event_id: id }
			});

			if (response.error) {
				throw new Error('Failed to delete logo');
			}

			return response.data;
		}
	}));

	// Delete cover art mutation
	const deleteCoverArtMutation = createMutation(() => ({
		mutationFn: async (id: string) => {
			const response = await eventadminDeleteCoverArt({
				path: { event_id: id }
			});

			if (response.error) {
				throw new Error('Failed to delete cover art');
			}

			return response.data;
		}
	}));

	/**
	 * Validate Step 1 (Essentials)
	 */
	function validateStep1(): boolean {
		const errors: Record<string, string> = {};

		if (!formData.name || formData.name.trim().length < 3) {
			errors.name = 'Event name must be at least 3 characters';
		}

		if (!formData.start) {
			errors.start = 'Start date and time is required';
		} else {
			const startDate = new Date(formData.start);
			if (startDate <= new Date()) {
				errors.start = 'Start date must be in the future';
			}
		}

		if (!formData.city_id) {
			errors.city_id = 'City is required';
		}

		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	/**
	 * Handle Step 1 submission (Create Event)
	 */
	async function handleStep1Submit(): Promise<void> {
		if (!validateStep1()) {
			errorMessage = 'Please fix the validation errors';
			return;
		}

		errorMessage = null;
		isSaving = true;

		try {
			// Prepare data for API - convert datetime-local to ISO with timezone
			const createData: EventCreateSchema = {
				name: formData.name!,
				start: toISOString(formData.start)!,
				city_id: formData.city_id!,
				visibility: formData.visibility || 'public',
				event_type: formData.event_type || 'public',
				requires_ticket: formData.requires_ticket || false,
				status: 'draft' // Create as draft by default
			};

			if (eventId) {
				// Update existing event
				await updateEventMutation.mutateAsync({ id: eventId, data: createData });
			} else {
				// Create new event
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
		if (!eventId) {
			errorMessage = 'Event ID not found. Please go back to Step 1.';
			return;
		}

		errorMessage = null;
		isSaving = true;

		try {
			// Update event with all details - convert datetime-local to ISO with timezone
			const updateData: Partial<EventEditSchema> = {
				description: formData.description || null,
				end: toISOString(formData.end),
				address: formData.address || null,
				rsvp_before: toISOString(formData.rsvp_before),
				free_for_members: formData.free_for_members || false,
				free_for_staff: formData.free_for_staff || false,
				max_attendees: formData.max_attendees || undefined,
				waitlist_open: formData.waitlist_open || false,
				invitation_message: formData.invitation_message || null,
				check_in_starts_at: toISOString(formData.check_in_starts_at),
				check_in_ends_at: toISOString(formData.check_in_ends_at),
				potluck_open: formData.potluck_open || false,
				event_series_id: formData.event_series_id || null
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

			// Invalidate queries
			queryClient.invalidateQueries({ queryKey: ['events'] });
			queryClient.invalidateQueries({ queryKey: ['event', eventId] });

			// Redirect to events list
			goto(`/org/${organization.slug}/admin/events`);
		} catch (error) {
			console.error('Step 2 submission error:', error);
			errorMessage = 'Failed to save event details. Please try again.';
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
			{isEditMode ? 'Edit Event' : 'Create New Event'}
		</h1>
		<p class="text-muted-foreground">
			{currentStep === 1
				? 'Start with the essentials - you can add more details in the next step'
				: 'Add additional details to make your event stand out'}
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
					: 'border-border bg-background text-muted-foreground'
			)}
			aria-current={currentStep === 2 ? 'step' : undefined}
		>
			2
		</div>
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
			<p class="font-semibold">Error</p>
			<p class="mt-1 text-sm">{errorMessage}</p>
		</div>
	{/if}

	<!-- Step content -->
	{#if currentStep === 1}
		<EssentialsStep
			{formData}
			{validationErrors}
			{orgCity}
			{userCity}
			eventCity={existingEvent?.city}
			{isEditMode}
			onUpdate={updateFormData}
			onSubmit={handleStep1Submit}
			{isSaving}
		/>
	{:else}
		<div class="space-y-6">
			<!-- Back button -->
			<button
				type="button"
				onclick={handleBackToStep1}
				class="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<ChevronLeft class="h-4 w-4" aria-hidden="true" />
				Back to essentials
			</button>

			<DetailsStep
				{formData}
				{eventSeries}
				{questionnaires}
				onUpdate={updateFormData}
				onUpdateImages={updateImages}
			/>

			<!-- Save & Exit button -->
			<div class="flex justify-end">
				<button
					type="button"
					onclick={handleStep2Submit}
					disabled={isSaving}
					class={cn(
						'inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						isSaving && 'cursor-not-allowed opacity-50'
					)}
				>
					<Save class="h-5 w-5" aria-hidden="true" />
					{isSaving ? 'Saving...' : 'Save & Exit'}
				</button>
			</div>
		</div>
	{/if}
</div>
