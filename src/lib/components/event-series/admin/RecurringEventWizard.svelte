<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { toast } from 'svelte-sonner';
	import { createMutation } from '@tanstack/svelte-query';
	import { Loader2, Save, ChevronDown } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import { toISOString } from '$lib/utils/datetime';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import EssentialsStep from '$lib/components/events/admin/EssentialsStep.svelte';
	import DetailsStep from '$lib/components/events/admin/DetailsStep.svelte';
	import RecurrencePicker from './RecurrencePicker.svelte';
	import RecurrenceSummary from './RecurrenceSummary.svelte';
	import { mutualExclusionGuard } from '$lib/utils/recurrence';
	import { organizationadminrecurringeventsCreateRecurringEvent } from '$lib/api/generated/sdk.gen';
	import type {
		EventCreateSchema,
		CitySchema,
		VenueDetailSchema,
		OrganizationRetrieveSchema,
		OrganizationQuestionnaireInListSchema,
		ResourceVisibility,
		RecurringEventCreateSchema
	} from '$lib/api/generated/types.gen';
	import type { RecurrenceRuleCreate } from '$lib/types/recurrence';

	interface Props {
		organization: OrganizationRetrieveSchema;
		userCity: CitySchema | null;
		orgCity: CitySchema | null;
		questionnaires?: OrganizationQuestionnaireInListSchema[];
	}

	const { organization, userCity, orgCity, questionnaires = [] }: Props = $props();

	type Step = 'event' | 'recurrence';
	let currentStep = $state<Step>('event');

	type TemplateFormData = Partial<EventCreateSchema> & {
		tags?: string[];
		requires_ticket?: boolean;
		requires_full_profile?: boolean;
		address_visibility?: ResourceVisibility;
		venue_id?: string | null;
		city_id?: number | null;
		location_maps_url?: string | null;
		location_maps_embed?: string | null;
		organization_logo?: string;
		organization_cover_art?: string;
	};

	let formData = $state<TemplateFormData>({
		name: '',
		start: '',
		end: '',
		city_id: orgCity?.id ?? userCity?.id ?? null,
		visibility: 'public',
		event_type: 'public',
		requires_ticket: false,
		description: '',
		address: '',
		address_visibility: 'public',
		rsvp_before: null,
		max_attendees: undefined,
		max_tickets_per_user: 1,
		waitlist_open: false,
		invitation_message: '',
		check_in_starts_at: null,
		check_in_ends_at: null,
		potluck_open: false,
		accept_invitation_requests: false,
		apply_before: null,
		can_attend_without_login: false,
		requires_full_profile: false,
		venue_id: null,
		tags: [],
		organization_logo: organization.logo ?? undefined,
		organization_cover_art: organization.cover_art ?? undefined,
		location_maps_url: null,
		location_maps_embed: null
	});

	let selectedCity = $state<CitySchema | null>(orgCity ?? userCity ?? null);
	let selectedVenue = $state<VenueDetailSchema | null>(null);

	function handleCitySelect(city: CitySchema | null): void {
		selectedCity = city;
		formData = { ...formData, city_id: city?.id ?? null };
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
					address: venue.address ?? null
				};
			} else {
				formData = {
					...formData,
					venue_id: venue.id,
					address: venue.address ?? null
				};
			}
		} else {
			formData = { ...formData, venue_id: null };
		}
	}

	function updateFormData(updates: Partial<TemplateFormData>): void {
		formData = { ...formData, ...updates };
	}

	// Wizard does NOT upload images for the template in the create flow. The
	// organiser can set logo / cover art later on the series dashboard.
	function updateImagesNoop(_data: {
		logo?: File | null;
		coverArt?: File | null;
		deleteLogo?: boolean;
		deleteCoverArt?: boolean;
	}): void {
		/* intentionally empty — images are set later on the series dashboard */
	}

	// --- Recurrence + series settings state ------------------------------------

	const browserTimezone =
		typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

	let recurrenceData = $state<Partial<RecurrenceRuleCreate>>({
		frequency: 'weekly',
		interval: 1,
		weekdays: [],
		timezone: browserTimezone
	});

	let seriesName = $state('');
	let seriesDescription = $state('');
	let autoPublish = $state(false);
	let generationWindowWeeks = $state(8);
	let advancedOpen = $state(false);

	// Auto-prefill series name from event name once the user hasn't customized it
	let seriesNameTouched = $state(false);
	$effect(() => {
		if (!seriesNameTouched && formData.name) {
			seriesName = formData.name;
		}
	});

	function handleSeriesNameInput(event: Event): void {
		seriesName = (event.target as HTMLInputElement).value;
		seriesNameTouched = true;
	}

	// Auto-derive weekdays hint when user picks a start and hasn't selected any weekday yet
	$effect(() => {
		if (recurrenceData.frequency !== 'weekly') return;
		const wd = recurrenceData.weekdays ?? [];
		if (wd.length > 0) return;
		if (!formData.start) return;
		const d = new Date(formData.start);
		if (Number.isNaN(d.getTime())) return;
		// JS getDay: 0=Sun..6=Sat → convert to backend 0=Mon..6=Sun
		const backendDay = (d.getDay() + 6) % 7;
		recurrenceData = { ...recurrenceData, weekdays: [backendDay] };
	});

	function handleRecurrenceChange(next: Partial<RecurrenceRuleCreate>): void {
		recurrenceData = next;
	}

	// --- Validation ------------------------------------------------------------

	let validationErrors = $state<Record<string, string>>({});
	let recurrenceErrors = $state<Record<string, string>>({});
	let errorBanner = $state<string | null>(null);

	function validateStepEvent(): boolean {
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
		if (!formData.city_id) {
			errors.city_id = m['eventWizard.error_cityRequired']();
		}
		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	function validateRecurrence(): boolean {
		const errors: Record<string, string> = {};
		if (!recurrenceData.frequency) {
			errors.frequency = m['recurringEvents.picker.validation.weekdaysRequired']();
		}
		if (recurrenceData.frequency === 'weekly') {
			if (!recurrenceData.weekdays || recurrenceData.weekdays.length === 0) {
				errors.weekdays = m['recurringEvents.picker.validation.weekdaysRequired']();
			}
		}
		if (recurrenceData.frequency === 'monthly') {
			if (recurrenceData.monthly_type === 'day') {
				const dom = recurrenceData.day_of_month;
				if (!dom || dom < 1 || dom > 31) {
					errors.day_of_month = m['recurringEvents.picker.validation.dayOfMonthRequired']();
				}
			} else if (recurrenceData.monthly_type === 'weekday') {
				const nth = recurrenceData.nth_weekday;
				const wd = recurrenceData.weekday;
				const validNth = nth === 1 || nth === 2 || nth === 3 || nth === 4 || nth === -1;
				const validWd = typeof wd === 'number' && wd >= 0 && wd <= 6;
				if (!validNth || !validWd) {
					errors.nth_weekday = m['recurringEvents.picker.validation.nthWeekdayRequired']();
				}
			}
		}
		const guard = mutualExclusionGuard({
			until: recurrenceData.until ?? null,
			count: recurrenceData.count ?? null
		});
		if (!guard.ok) {
			if (guard.reason === 'both_set') {
				errors.boundary = m['recurringEvents.picker.validation.boundaryMutex']();
			} else if (guard.reason === 'count_invalid') {
				errors.count = m['recurringEvents.picker.validation.countMin']();
			} else if (guard.reason === 'until_invalid') {
				errors.until = m['recurringEvents.picker.validation.untilAfterStart']();
			}
		}
		if (recurrenceData.until && formData.start) {
			if (new Date(recurrenceData.until) <= new Date(formData.start)) {
				errors.until = m['recurringEvents.picker.validation.untilAfterStart']();
			}
		}
		if (!seriesName.trim()) {
			errors.series_name = m['eventWizard.error_nameRequired']();
		}
		recurrenceErrors = errors;
		return Object.keys(errors).length === 0;
	}

	function goToRecurrenceStep(): void {
		if (!validateStepEvent()) {
			errorBanner = m['eventWizard.error_fixValidation']();
			return;
		}
		errorBanner = null;
		currentStep = 'recurrence';
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function goBackToEvent(): void {
		currentStep = 'event';
		errorBanner = null;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	// --- Submit ----------------------------------------------------------------

	type CreateResponse = Awaited<
		ReturnType<typeof organizationadminrecurringeventsCreateRecurringEvent>
	>['data'];

	const createMutation_ = createMutation(() => ({
		mutationFn: async (): Promise<NonNullable<CreateResponse>> => {
			// These are all guaranteed present by validateStepEvent/validateRecurrence;
			// failing here means the caller misordered operations.
			const name = formData.name?.trim();
			const startIso = toISOString(formData.start);
			const cityId = formData.city_id;
			const freq = recurrenceData.frequency;
			if (!name || !startIso || cityId == null || !freq) {
				throw new Error(m['eventWizard.error_fixValidation']());
			}

			const eventPayload: EventCreateSchema = {
				name,
				start: startIso,
				city_id: cityId,
				visibility: formData.visibility ?? 'public',
				// Backend enum is wider than our generated type — matches EventWizard pattern
				event_type: (formData.event_type ?? 'public') as EventCreateSchema['event_type'],
				end: toISOString(formData.end),
				description: formData.description?.trim() || null,
				address: formData.address?.trim() || null,
				address_visibility: formData.address_visibility ?? 'public',
				rsvp_before: toISOString(formData.rsvp_before),
				max_attendees: formData.max_attendees || undefined,
				max_tickets_per_user: formData.max_tickets_per_user ?? 1,
				waitlist_open: formData.waitlist_open ?? false,
				invitation_message: formData.invitation_message?.trim() || null,
				check_in_starts_at: toISOString(formData.check_in_starts_at),
				check_in_ends_at: toISOString(formData.check_in_ends_at),
				potluck_open: formData.potluck_open ?? false,
				accept_invitation_requests: formData.accept_invitation_requests ?? false,
				apply_before: toISOString(formData.apply_before),
				can_attend_without_login: formData.can_attend_without_login ?? false,
				requires_full_profile: formData.requires_full_profile ?? false,
				venue_id: formData.venue_id ?? null,
				location_maps_url: formData.location_maps_url ?? null,
				location_maps_embed: formData.location_maps_embed ?? null
			};

			const body: RecurringEventCreateSchema = {
				event: eventPayload,
				series_name: seriesName.trim(),
				series_description: seriesDescription.trim() || null,
				auto_publish: autoPublish,
				generation_window_weeks: generationWindowWeeks,
				recurrence: {
					frequency: freq,
					interval: recurrenceData.interval ?? 1,
					weekdays: recurrenceData.weekdays,
					monthly_type: recurrenceData.monthly_type ?? null,
					day_of_month: recurrenceData.day_of_month ?? null,
					nth_weekday: recurrenceData.nth_weekday ?? null,
					weekday: recurrenceData.weekday ?? null,
					dtstart: startIso,
					until: recurrenceData.until ?? null,
					count: recurrenceData.count ?? null,
					timezone: recurrenceData.timezone ?? browserTimezone
				}
			};

			const response = await organizationadminrecurringeventsCreateRecurringEvent({
				path: { slug: organization.slug },
				body
			});

			if (response.error) {
				const errorPayload = response.error as Record<string, unknown>;
				const err = new Error(extractErrorMessage(errorPayload)) as Error & {
					fieldErrors?: Record<string, string>;
				};
				err.fieldErrors = extractFieldErrors(errorPayload);
				throw err;
			}

			if (!response.data) {
				throw new Error(m['recurringEvents.error.422Generic']());
			}

			return response.data;
		},
		onSuccess: (data) => {
			toast.success(m['recurringEvents.wizard.createdToast']({ seriesName: seriesName.trim() }));
			goto(`/org/${organization.slug}/admin/event-series/${data.id}`);
		},
		onError: (error: Error & { fieldErrors?: Record<string, string> }) => {
			if (error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
				// Split field errors into step A (event) vs step B (recurrence)
				const evErrors: Record<string, string> = {};
				const rcErrors: Record<string, string> = {};
				for (const [key, msg] of Object.entries(error.fieldErrors)) {
					if (key.startsWith('event.') || key === 'name' || key === 'start' || key === 'city_id') {
						const trimmed = key.replace(/^event\./, '');
						evErrors[trimmed] = msg;
					} else if (key.startsWith('recurrence.')) {
						rcErrors[key.replace(/^recurrence\./, '')] = msg;
					} else {
						rcErrors[key] = msg;
					}
				}
				if (Object.keys(evErrors).length > 0) {
					validationErrors = evErrors;
					currentStep = 'event';
					scrollToFirstError();
				}
				if (Object.keys(rcErrors).length > 0) {
					recurrenceErrors = rcErrors;
				}
			}
			errorBanner = error.message || m['recurringEvents.error.422Generic']();
			toast.error(errorBanner);
		}
	}));

	function extractErrorMessage(payload: Record<string, unknown>): string {
		if (typeof payload.detail === 'string') return payload.detail;
		if (Array.isArray(payload.errors) && payload.errors.length > 0) {
			const first = payload.errors[0];
			if (first && typeof first === 'object' && 'msg' in first && typeof first.msg === 'string') {
				return first.msg;
			}
		}
		return m['recurringEvents.error.422Generic']();
	}

	function extractFieldErrors(payload: Record<string, unknown>): Record<string, string> {
		const out: Record<string, string> = {};
		if (!Array.isArray(payload.errors)) return out;
		for (const entry of payload.errors) {
			if (!entry || typeof entry !== 'object') continue;
			const loc = (entry as { loc?: unknown }).loc;
			const msg = (entry as { msg?: unknown }).msg;
			if (!Array.isArray(loc) || typeof msg !== 'string') continue;
			const path = loc.filter((p) => p !== 'body').join('.');
			if (path) out[path] = msg;
		}
		return out;
	}

	function scrollToFirstError(): void {
		requestAnimationFrame(() => {
			const el = document.querySelector('[aria-invalid="true"], .text-destructive');
			if (el && 'scrollIntoView' in el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		});
	}

	function submit(): void {
		if (!validateRecurrence()) {
			errorBanner = m['eventWizard.error_fixValidation']();
			return;
		}
		errorBanner = null;
		createMutation_.mutate();
	}

	const isSubmitting = $derived(createMutation_.isPending);

	const hasStart = $derived(Boolean(formData.start));
</script>

<div class="mx-auto max-w-4xl space-y-6">
	<!-- Step indicator -->
	<div class="flex items-center gap-4" aria-label="Wizard progress">
		<div
			class={cn(
				'flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-colors',
				currentStep === 'event'
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-green-600 bg-green-600 text-white'
			)}
			aria-current={currentStep === 'event' ? 'step' : undefined}
		>
			1
		</div>
		<div class="h-0.5 flex-1 bg-border"></div>
		<div
			class={cn(
				'flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-colors',
				currentStep === 'recurrence'
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-border bg-background text-muted-foreground'
			)}
			aria-current={currentStep === 'recurrence' ? 'step' : undefined}
		>
			2
		</div>
	</div>

	<!-- Step heading -->
	<div class="space-y-1">
		<h2 class="text-xl font-semibold">
			{currentStep === 'event'
				? m['recurringEvents.wizard.stepAHeading']()
				: m['recurringEvents.wizard.stepBHeading']()}
		</h2>
	</div>

	{#if errorBanner}
		<div
			class="rounded-md bg-destructive/10 p-4 text-destructive"
			role="alert"
			aria-live="assertive"
		>
			<p class="text-sm font-medium">{errorBanner}</p>
		</div>
	{/if}

	{#if currentStep === 'event'}
		<!-- Step A: template event -->
		<div class="space-y-6">
			<EssentialsStep
				{formData}
				{validationErrors}
				isEditMode={false}
				standalone={false}
				onUpdate={updateFormData}
				onSubmit={goToRecurrenceStep}
				isSaving={isSubmitting}
				organizationSlug={organization.slug}
			/>

			{#if hasStart}
				<p class="text-sm text-muted-foreground">
					{m['recurringEvents.wizard.anchorHelper']()}
				</p>
			{/if}

			<DetailsStep
				{formData}
				{questionnaires}
				organizationId={organization.id}
				organizationSlug={organization.slug}
				accessToken={$page.data.auth?.accessToken}
				{selectedCity}
				{selectedVenue}
				{validationErrors}
				isEditMode={false}
				onCitySelect={handleCitySelect}
				onVenueSelect={handleVenueSelect}
				onUpdate={updateFormData}
				onUpdateImages={updateImagesNoop}
			/>

			<!-- Wizard nav -->
			<div
				class="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end"
			>
				<Button type="button" onclick={goToRecurrenceStep}>
					{m['recurringEvents.wizard.next']()}
				</Button>
			</div>
		</div>
	{:else}
		<!-- Step B: recurrence + series settings -->
		<div class="space-y-8">
			<!-- Series name + description -->
			<div class="space-y-4">
				<div class="space-y-2">
					<Label for="series-name">
						{m['recurringEvents.wizard.seriesNameLabel']()}
						<span class="text-destructive" aria-hidden="true">*</span>
					</Label>
					<Input
						id="series-name"
						type="text"
						value={seriesName}
						oninput={handleSeriesNameInput}
						required
						maxlength={150}
						placeholder={m['recurringEvents.wizard.seriesNamePlaceholder']()}
						aria-invalid={recurrenceErrors.series_name ? 'true' : undefined}
						aria-describedby={recurrenceErrors.series_name ? 'series-name-error' : undefined}
					/>
					{#if recurrenceErrors.series_name}
						<p id="series-name-error" class="text-sm text-destructive">
							{recurrenceErrors.series_name}
						</p>
					{/if}
				</div>
				<div class="space-y-2">
					<Label for="series-description">
						{m['recurringEvents.wizard.seriesDescriptionLabel']()}
					</Label>
					<Textarea
						id="series-description"
						bind:value={seriesDescription}
						rows={3}
						maxlength={500}
					/>
				</div>
			</div>

			<!-- Recurrence picker -->
			<div class="space-y-4">
				<RecurrencePicker
					rule={recurrenceData}
					onChange={handleRecurrenceChange}
					validationErrors={recurrenceErrors}
				/>

				<div class="rounded-md border border-border bg-muted/30 p-3">
					<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						{m['recurringEvents.wizard.stepBHeading']()}
					</p>
					<RecurrenceSummary
						rule={{
							frequency: recurrenceData.frequency ?? 'weekly',
							interval: recurrenceData.interval ?? 1,
							weekdays: recurrenceData.weekdays,
							monthly_type: recurrenceData.monthly_type ?? null,
							day_of_month: recurrenceData.day_of_month ?? null,
							nth_weekday: recurrenceData.nth_weekday ?? null,
							weekday: recurrenceData.weekday ?? null,
							until: recurrenceData.until ?? null,
							count: recurrenceData.count ?? null
						}}
						class="mt-1"
					/>
				</div>
			</div>

			<!-- Timezone (read-only advisory) -->
			<div class="space-y-2">
				<Label for="series-timezone">{m['recurringEvents.wizard.timezoneLabel']()}</Label>
				<Input
					id="series-timezone"
					type="text"
					value={recurrenceData.timezone ?? browserTimezone}
					readonly
					aria-readonly="true"
					class="bg-muted/50"
				/>
				<p class="text-xs text-muted-foreground">
					{m['recurringEvents.wizard.timezoneHelper']()}
				</p>
			</div>

			<!-- Advanced (collapsible) -->
			<div class="rounded-md border border-border">
				<button
					type="button"
					onclick={() => (advancedOpen = !advancedOpen)}
					aria-expanded={advancedOpen}
					class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<span>Advanced</span>
					<ChevronDown
						class={cn('h-4 w-4 transition-transform', advancedOpen && 'rotate-180')}
						aria-hidden="true"
					/>
				</button>
				{#if advancedOpen}
					<div class="space-y-5 border-t border-border px-4 py-4">
						<div class="space-y-2">
							<div class="flex items-start gap-3">
								<Checkbox id="auto-publish" bind:checked={autoPublish} />
								<div class="flex-1 space-y-1">
									<Label for="auto-publish">
										{m['recurringEvents.wizard.autoPublishLabel']()}
									</Label>
									<p class="text-xs text-muted-foreground">
										{autoPublish
											? m['recurringEvents.wizard.autoPublishOnHelper']()
											: m['recurringEvents.wizard.autoPublishOffHelper']()}
									</p>
								</div>
							</div>
						</div>

						<div class="space-y-2">
							<Label for="generation-window">
								{m['recurringEvents.wizard.generationWindowLabel']()}
							</Label>
							<div class="flex items-center gap-3">
								<Input
									id="generation-window"
									type="number"
									min={1}
									max={52}
									value={generationWindowWeeks}
									oninput={(e) => {
										const v = Number((e.target as HTMLInputElement).value);
										if (Number.isFinite(v)) {
											generationWindowWeeks = Math.max(1, Math.min(52, Math.floor(v)));
										}
									}}
									class="w-24"
								/>
								<span class="text-sm text-muted-foreground">weeks</span>
							</div>
							<p class="text-xs text-muted-foreground">
								{m['recurringEvents.wizard.generationWindowHelper']({
									weeks: generationWindowWeeks
								})}
							</p>
						</div>
					</div>
				{/if}
			</div>

			<!-- Wizard nav -->
			<div
				class="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between"
			>
				<Button type="button" variant="outline" onclick={goBackToEvent} disabled={isSubmitting}>
					{m['recurringEvents.wizard.back']()}
				</Button>
				<Button type="button" onclick={submit} disabled={isSubmitting}>
					{#if isSubmitting}
						<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
						{m['recurringEvents.wizard.createPending']()}
					{:else}
						<Save class="h-4 w-4" aria-hidden="true" />
						{m['recurringEvents.wizard.create']()}
					{/if}
				</Button>
			</div>
		</div>
	{/if}
</div>
