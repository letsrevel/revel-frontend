<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventCreateSchema } from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import { formatDateTimeReadback } from '$lib/utils/date';
	import { Calendar, Eye, Users, Ticket, Pencil, Check, X, Link, Loader2 } from 'lucide-svelte';
	import { createMutation } from '@tanstack/svelte-query';
	import { eventadmincoreEditSlug } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';

	interface Props {
		formData: Partial<EventCreateSchema> & { requires_ticket?: boolean; venue_id?: string | null };
		validationErrors: Record<string, string>;
		isEditMode: boolean;
		onUpdate: (
			data: Partial<EventCreateSchema> & { requires_ticket?: boolean; venue_id?: string | null }
		) => void;
		onSubmit: () => void;
		isSaving: boolean;
		/** When true (default), renders with form wrapper and nav buttons. When false, renders as div without nav. */
		standalone?: boolean;
		// Slug editing props (only used in edit mode)
		eventId?: string;
		eventSlug?: string;
		organizationSlug?: string;
		onSlugUpdated?: (newSlug: string) => void;
	}

	const {
		formData,
		validationErrors,
		isEditMode,
		onUpdate,
		onSubmit,
		isSaving,
		standalone = true,
		eventId,
		eventSlug,
		organizationSlug,
		onSlugUpdated
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	// Unambiguous textual readbacks for the native datetime inputs; '' when the
	// value is empty or unparseable, so the hint is gated on the rendered text.
	const startReadback = $derived(formatDateTimeReadback(formData.start));
	const endReadback = $derived(formatDateTimeReadback(formData.end));

	// Slug editing state
	let isEditingSlug = $state(false);
	let editedSlug = $state('');
	let slugError = $state<string | null>(null);

	// Derived current slug (updates when editing is saved)
	let currentSlug = $state(eventSlug || '');

	// Update currentSlug when eventSlug prop changes
	$effect(() => {
		if (eventSlug) {
			currentSlug = eventSlug;
		}
	});

	// Start editing slug
	function startEditingSlug(): void {
		editedSlug = currentSlug;
		slugError = null;
		isEditingSlug = true;
	}

	// Cancel editing slug
	function cancelEditingSlug(): void {
		isEditingSlug = false;
		editedSlug = '';
		slugError = null;
	}

	// Slug update mutation
	const updateSlugMutation = createMutation(() => ({
		mutationFn: async (newSlug: string) => {
			if (!accessToken || !eventId) throw new Error(m['essentialsStep.error_notAuthenticated']());

			const response = await eventadmincoreEditSlug({
				path: { event_id: eventId },
				body: { slug: newSlug },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				const errorDetail =
					typeof response.error === 'object' &&
					response.error !== null &&
					'detail' in response.error
						? (response.error.detail as string)
						: m['essentialsStep.error_slugUpdateFailed']();
				throw new Error(errorDetail);
			}

			if (!response.data) {
				throw new Error(m['essentialsStep.error_slugUpdateFailed']());
			}

			return response.data;
		},
		onSuccess: (data) => {
			currentSlug = data.slug;
			isEditingSlug = false;
			editedSlug = '';
			slugError = null;
			onSlugUpdated?.(data.slug);
		},
		onError: (error: Error) => {
			// Check for slug collision error
			if (error.message.includes('already exists')) {
				slugError = m['essentialsStep.error_slugExists']();
			} else {
				slugError = error.message;
			}
		}
	}));

	// Save slug
	function saveSlug(): void {
		slugError = null;

		// Validate slug format
		const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
		if (!editedSlug.trim()) {
			slugError = m['essentialsStep.error_slugRequired']();
			return;
		}

		if (!slugPattern.test(editedSlug.trim())) {
			slugError = m['essentialsStep.error_slugFormat']();
			return;
		}

		// No change
		if (editedSlug.trim() === currentSlug) {
			isEditingSlug = false;
			return;
		}

		updateSlugMutation.mutate(editedSlug.trim());
	}

	// Generate event URL preview
	const eventUrlPreview = $derived.by(() => {
		if (!organizationSlug) return '';
		const slug = isEditingSlug ? editedSlug : currentSlug;
		return `/events/${organizationSlug}/${slug || 'your-event-slug'}`;
	});

	/**
	 * Handle form submission
	 */
	function handleSubmit(e: Event): void {
		e.preventDefault();
		onSubmit();
	}

	/**
	 * Get explanation for current visibility + event_type combination
	 */
	const combinationExplanation = $derived.by(() => {
		const visibility = formData.visibility || 'public';
		const eventType = (formData.event_type as string) || 'public';

		// Define who can see
		const whoCanSee =
			visibility === 'public'
				? m['essentialsStep.whoCanSee_everyone']()
				: visibility === 'unlisted'
					? m['essentialsStep.whoCanSee_directLink']()
					: visibility === 'members-only'
						? m['essentialsStep.whoCanSee_members']()
						: visibility === 'staff-only'
							? m['essentialsStep.whoCanSee_staff']()
							: m['essentialsStep.whoCanSee_invited'](); // private

		// Define who can attend
		const whoCanAttend =
			eventType === 'public'
				? m['essentialsStep.whoCanAttend_anyone']()
				: eventType === 'members-only'
					? m['essentialsStep.whoCanAttend_members']()
					: m['essentialsStep.whoCanAttend_invited'](); // private

		// Special case: public visibility + members-only type → join org CTA
		const showJoinOrgHint = visibility === 'public' && eventType === 'members-only';

		// Build the full "who can view" sentence
		const viewDescription =
			visibility === 'unlisted'
				? m['essentialsStep.viewDescription_unlisted']()
				: m['essentialsStep.viewDescription_default']({ who: whoCanSee });

		return {
			whoCanSee,
			viewDescription,
			whoCanAttend,
			showJoinOrgHint
		};
	});
</script>

{#snippet fields()}
	<!-- Event Name -->
	<div class="space-y-2">
		<label for="event-name" class="block text-sm font-medium">
			{m['essentialsStep.eventNameLabel']()} <span class="text-destructive">*</span>
		</label>
		<input
			id="event-name"
			type="text"
			value={formData.name || ''}
			oninput={(e) => onUpdate({ name: e.currentTarget.value })}
			placeholder={m['essentialsStep.eventNamePlaceholder']()}
			required
			aria-invalid={!!validationErrors.name}
			aria-describedby={validationErrors.name ? 'event-name-error' : undefined}
			class={cn(
				'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
				validationErrors.name && 'border-destructive'
			)}
		/>
		{#if validationErrors.name}
			<p id="event-name-error" class="text-sm text-destructive" role="alert">
				{validationErrors.name}
			</p>
		{/if}
		<p class="text-xs text-muted-foreground">{m['SFwESEssentialsStep.clearDescriptiveName']()}</p>
	</div>

	<!-- Event Slug (only in edit mode) -->
	{#if isEditMode && eventId && organizationSlug}
		<div class="space-y-2">
			<label for="event-slug" class="block text-sm font-medium">
				<span class="flex items-center gap-2">
					<Link class="h-4 w-4" aria-hidden="true" />
					{m['essentialsStep.slugLabel']()}
				</span>
			</label>

			{#if isEditingSlug}
				<!-- Editing mode -->
				<div class="flex gap-2">
					<input
						id="event-slug"
						type="text"
						bind:value={editedSlug}
						placeholder={m['essentialsStep.slugPlaceholder']()}
						disabled={updateSlugMutation.isPending}
						aria-invalid={!!slugError}
						aria-describedby={slugError ? 'event-slug-error' : 'event-slug-hint'}
						class={cn(
							'flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
							slugError && 'border-destructive'
						)}
					/>
					<button
						type="button"
						onclick={saveSlug}
						disabled={updateSlugMutation.isPending}
						class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
						aria-label={m['essentialsStep.saveSlug']()}
					>
						{#if updateSlugMutation.isPending}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
						{:else}
							<Check class="h-4 w-4" aria-hidden="true" />
						{/if}
					</button>
					<button
						type="button"
						onclick={cancelEditingSlug}
						disabled={updateSlugMutation.isPending}
						class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
						aria-label={m['essentialsStep.cancelSlugEdit']()}
					>
						<X class="h-4 w-4" aria-hidden="true" />
					</button>
				</div>
			{:else}
				<!-- Read-only mode -->
				<div class="flex gap-2">
					<div
						class="flex h-10 flex-1 items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
					>
						{currentSlug || m['essentialsStep.noSlug']()}
					</div>
					<button
						type="button"
						onclick={startEditingSlug}
						class="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label={m['essentialsStep.editSlug']()}
					>
						<Pencil class="h-4 w-4" aria-hidden="true" />
						{m['essentialsStep.edit']()}
					</button>
				</div>
			{/if}

			{#if slugError}
				<p id="event-slug-error" class="text-sm text-destructive" role="alert">
					{slugError}
				</p>
			{/if}

			<!-- URL Preview -->
			<p id="event-slug-hint" class="text-xs text-muted-foreground">
				{m['essentialsStep.urlPreview']()}
				<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
					{eventUrlPreview}
				</code>
			</p>
		</div>
	{/if}

	<!-- Start Date/Time -->
	<div class="space-y-2">
		<label for="event-start" class="block text-sm font-medium">
			<span class="flex items-center gap-2">
				<Calendar class="h-4 w-4" aria-hidden="true" />
				{m['essentialsStep.startDateTime']()} <span class="text-destructive">*</span>
			</span>
		</label>
		<input
			id="event-start"
			type="datetime-local"
			value={formData.start || ''}
			oninput={(e) => onUpdate({ start: e.currentTarget.value })}
			required
			aria-invalid={!!validationErrors.start}
			aria-describedby={validationErrors.start ? 'event-start-error' : undefined}
			class={cn(
				'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
				validationErrors.start && 'border-destructive'
			)}
		/>
		{#if validationErrors.start}
			<p id="event-start-error" class="text-sm text-destructive" role="alert">
				{validationErrors.start}
			</p>
		{/if}
		{#if startReadback}
			<p class="text-xs text-muted-foreground">
				{m['dateTimePicker.selectedDate']({ value: startReadback })}
			</p>
		{/if}
		<p class="text-xs text-muted-foreground">
			{m['essentialsStep.localTimezoneHint']({
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
			})}
		</p>
	</div>

	<!-- Open-ended toggle -->
	<div class="space-y-2">
		<label class="flex items-center gap-2 text-sm font-medium">
			<input
				type="checkbox"
				checked={formData.is_open_ended ?? false}
				onchange={(e) => onUpdate({ is_open_ended: e.currentTarget.checked })}
				class="h-4 w-4 rounded border-input"
			/>
			{m['essentialsStep.openEndedToggle']()}
		</label>
		<p class="text-xs text-muted-foreground">{m['essentialsStep.openEndedHelp']()}</p>
	</div>

	<!-- End Date/Time (hidden when open-ended) -->
	{#if !formData.is_open_ended}
		<div class="space-y-2">
			<label for="event-end" class="block text-sm font-medium">
				<span class="flex items-center gap-2">
					<Calendar class="h-4 w-4" aria-hidden="true" />
					{m['essentialsStep.endDateTime']()} <span class="text-destructive">*</span>
				</span>
			</label>
			<input
				id="event-end"
				type="datetime-local"
				value={formData.end || ''}
				oninput={(e) => onUpdate({ end: e.currentTarget.value })}
				required
				aria-invalid={!!validationErrors.end}
				aria-describedby={validationErrors.end ? 'event-end-error' : undefined}
				class={cn(
					'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
					validationErrors.end && 'border-destructive'
				)}
			/>
			{#if validationErrors.end}
				<p id="event-end-error" class="text-sm text-destructive" role="alert">
					{validationErrors.end}
				</p>
			{/if}
			{#if endReadback}
				<p class="text-xs text-muted-foreground">
					{m['dateTimePicker.selectedDate']({ value: endReadback })}
				</p>
			{/if}
		</div>
	{/if}

	<!-- Visibility -->
	<div class="space-y-2">
		<label class="block text-sm font-medium">
			<span class="flex items-center gap-2">
				<Eye class="h-4 w-4" aria-hidden="true" />
				{m['SFwESEssentialsStep.visibilityHeading']()}
			</span>
			<span class="mt-0.5 block text-xs font-normal text-muted-foreground">
				{m['SFwESEssentialsStep.visibilitySubLabel']()}
			</span>
		</label>
		<div
			class="space-y-2"
			role="radiogroup"
			aria-label={m['essentialsStep.eventVisibilityAriaLabel']()}
		>
			<label
				class="group flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
			>
				<input
					type="radio"
					name="visibility"
					value="public"
					checked={formData.visibility === 'public'}
					onchange={(e) => onUpdate({ visibility: e.currentTarget.value as 'public' })}
					class="h-4 w-4 border-gray-300 text-primary focus:ring-2 focus:ring-ring"
				/>
				<div class="flex-1">
					<div class="font-medium group-hover:text-accent-foreground">
						{m['SFwESEssentialsStep.public']()}
					</div>
					<div class="text-sm text-muted-foreground group-hover:text-accent-foreground/80">
						{m['SFwESEssentialsStep.anyoneCanSee']()}
					</div>
				</div>
			</label>

			<label
				class="group flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
			>
				<input
					type="radio"
					name="visibility"
					value="unlisted"
					checked={formData.visibility === 'unlisted'}
					onchange={(e) => onUpdate({ visibility: e.currentTarget.value as 'unlisted' })}
					class="h-4 w-4 border-gray-300 text-primary focus:ring-2 focus:ring-ring"
				/>
				<div class="flex-1">
					<div class="font-medium group-hover:text-accent-foreground">
						{m['SFwESEssentialsStep.unlisted']()}
					</div>
					<div class="text-sm text-muted-foreground group-hover:text-accent-foreground/80">
						{m['SFwESEssentialsStep.unlistedDescription']()}
					</div>
				</div>
			</label>

			<label
				class="group flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
			>
				<input
					type="radio"
					name="visibility"
					value="private"
					checked={formData.visibility === 'private'}
					onchange={(e) => onUpdate({ visibility: e.currentTarget.value as 'private' })}
					class="h-4 w-4 border-gray-300 text-primary focus:ring-2 focus:ring-ring"
				/>
				<div class="flex-1">
					<div class="font-medium group-hover:text-accent-foreground">
						{m['SFwESEssentialsStep.private']()}
					</div>
					<div class="text-sm text-muted-foreground group-hover:text-accent-foreground/80">
						{m['SFwESEssentialsStep.onlyInvitedUsers']()}
					</div>
				</div>
			</label>

			<label
				class="group flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
			>
				<input
					type="radio"
					name="visibility"
					value="members-only"
					checked={formData.visibility === 'members-only'}
					onchange={(e) => onUpdate({ visibility: e.currentTarget.value as 'members-only' })}
					class="h-4 w-4 border-gray-300 text-primary focus:ring-2 focus:ring-ring"
				/>
				<div class="flex-1">
					<div class="font-medium group-hover:text-accent-foreground">
						{m['SFwESEssentialsStep.membersOnly']()}
					</div>
					<div class="text-sm text-muted-foreground group-hover:text-accent-foreground/80">
						{m['SFwESEssentialsStep.membersOnlyDescription']()}
					</div>
				</div>
			</label>

			<label
				class="group flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
			>
				<input
					type="radio"
					name="visibility"
					value="staff-only"
					checked={formData.visibility === 'staff-only'}
					onchange={(e) => onUpdate({ visibility: e.currentTarget.value as 'staff-only' })}
					class="h-4 w-4 border-gray-300 text-primary focus:ring-2 focus:ring-ring"
				/>
				<div class="flex-1">
					<div class="font-medium group-hover:text-accent-foreground">
						{m['SFwESEssentialsStep.staffOnly']()}
					</div>
					<div class="text-sm text-muted-foreground group-hover:text-accent-foreground/80">
						{m['SFwESEssentialsStep.staffOnlyDescription']()}
					</div>
				</div>
			</label>
		</div>
	</div>

	<!-- Event Type -->
	<div class="space-y-2">
		<label class="block text-sm font-medium">
			<span class="flex items-center gap-2">
				<Users class="h-4 w-4" aria-hidden="true" />
				{m['SFwESEssentialsStep.eventTypeHeading']()}
			</span>
			<span class="mt-0.5 block text-xs font-normal text-muted-foreground">
				{m['SFwESEssentialsStep.eventTypeSubLabel']()}
			</span>
		</label>

		<!-- Help text explaining Visibility vs Event Type -->
		<div class="rounded-md bg-muted p-3 text-sm">
			<p class="font-medium text-foreground">{m['SFwESEssentialsStep.whatsTheDifference']()}</p>
			<ul class="mt-2 space-y-1.5 text-xs text-muted-foreground">
				<li class="flex gap-2">
					<span class="text-primary">•</span>
					<span
						><strong>{m['SFwESEssentialsStep.visibilityHeading']()}:</strong>
						{m['SFwESEssentialsStep.visibilityExplanation']()}</span
					>
				</li>
				<li class="flex gap-2">
					<span class="text-primary">•</span>
					<span
						><strong>{m['SFwESEssentialsStep.eventTypeHeading']()}:</strong>
						{m['SFwESEssentialsStep.eventTypeExplanation']()}</span
					>
				</li>
			</ul>
		</div>

		<div class="space-y-2" role="radiogroup" aria-label={m['essentialsStep.eventTypeAriaLabel']()}>
			<label
				class="group flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
			>
				<input
					type="radio"
					name="event_type"
					value="public"
					checked={(formData.event_type as any) === 'public'}
					onchange={(e) => onUpdate({ event_type: e.currentTarget.value as any })}
					class="h-4 w-4 border-gray-300 text-primary focus:ring-2 focus:ring-ring"
				/>
				<div class="flex-1">
					<div class="font-medium group-hover:text-accent-foreground">
						{m['SFwESEssentialsStep.public']()}
					</div>
					<div class="text-sm text-muted-foreground group-hover:text-accent-foreground/80">
						{m['SFwESEssentialsStep.everyoneCanAttend']()}
					</div>
				</div>
			</label>

			<label
				class="group flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
			>
				<input
					type="radio"
					name="event_type"
					value="private"
					checked={(formData.event_type as any) === 'private'}
					onchange={(e) => onUpdate({ event_type: e.currentTarget.value as any })}
					class="h-4 w-4 border-gray-300 text-primary focus:ring-2 focus:ring-ring"
				/>
				<div class="flex-1">
					<div class="font-medium group-hover:text-accent-foreground">
						{m['SFwESEssentialsStep.private']()}
					</div>
					<div class="text-sm text-muted-foreground group-hover:text-accent-foreground/80">
						{m['SFwESEssentialsStep.onlyInvitedPeople']()}
					</div>
				</div>
			</label>

			<label
				class="group flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
			>
				<input
					type="radio"
					name="event_type"
					value="members-only"
					checked={(formData.event_type as any) === 'members-only'}
					onchange={(e) => onUpdate({ event_type: e.currentTarget.value as any })}
					class="h-4 w-4 border-gray-300 text-primary focus:ring-2 focus:ring-ring"
				/>
				<div class="flex-1">
					<div class="font-medium group-hover:text-accent-foreground">
						{m['SFwESEssentialsStep.membersOnly']()}
					</div>
					<div class="text-sm text-muted-foreground group-hover:text-accent-foreground/80">
						{m['SFwESEssentialsStep.onlyOrganizationMembers']()}
					</div>
				</div>
			</label>
		</div>

		<!-- Dynamic explanation based on selected combination -->
		<div
			class="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950"
			role="status"
			aria-live="polite"
		>
			<div class="flex items-start gap-3">
				<div class="flex-shrink-0">
					<svg
						class="h-5 w-5 text-blue-600 dark:text-blue-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<div class="flex-1">
					<h4 class="text-sm font-medium text-blue-900 dark:text-blue-100">
						{m['essentialsStep.withTheseSettings']()}
					</h4>
					<div class="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
						<p>
							<strong>{m['essentialsStep.whoCanView']()}</strong>
							{combinationExplanation.viewDescription}
						</p>
						<p>
							<strong>{m['essentialsStep.whoCanAttend']()}</strong>
							{m['essentialsStep.whoCanAttendValue']({
								who:
									combinationExplanation.whoCanAttend.charAt(0).toUpperCase() +
									combinationExplanation.whoCanAttend.slice(1)
							})}
						</p>
						{#if combinationExplanation.showJoinOrgHint}
							<p class="mt-2 rounded-md bg-blue-100 px-2 py-1.5 text-xs dark:bg-blue-900">
								💡 <strong>{m['essentialsStep.tip']()}</strong>
								{m['essentialsStep.joinOrgHint']()}
							</p>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Requires Ticket -->
	<div class="space-y-3">
		<div class="space-y-2">
			<label class="block text-sm font-medium">
				<span class="flex items-center gap-2">
					<Ticket class="h-4 w-4" aria-hidden="true" />
					{m['essentialsStep.ticketing']()}
				</span>
			</label>

			<!-- Immutability warning - Always visible in create mode -->
			{#if !isEditMode}
				<div
					class="rounded-md border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm dark:border-orange-800 dark:bg-orange-950"
					role="alert"
				>
					<div class="flex items-start gap-2">
						<span class="text-orange-600 dark:text-orange-400" aria-hidden="true">⚠️</span>
						<div class="flex-1 text-orange-800 dark:text-orange-100">
							<p class="font-medium">{m['essentialsStep.ticketingImmutableWarning']()}</p>
							<p class="mt-1 text-xs text-orange-700 dark:text-orange-200">
								{m['essentialsStep.ticketingImmutableHint']()}
							</p>
						</div>
					</div>
				</div>
			{/if}

			<!-- Checkbox -->
			<label
				class="flex items-center gap-3 rounded-md border border-input p-3 transition-colors {isEditMode
					? 'cursor-not-allowed opacity-60'
					: 'cursor-pointer hover:bg-accent'}"
			>
				<input
					type="checkbox"
					checked={formData.requires_ticket || false}
					onchange={(e) => onUpdate({ requires_ticket: e.currentTarget.checked })}
					disabled={isEditMode}
					class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
				/>
				<div class="flex-1">
					<div class="font-medium">{m['essentialsStep.requiresTicket']()}</div>
					<div class="text-sm text-muted-foreground">
						{m['essentialsStep.requiresTicketDescription']()}
					</div>
				</div>
			</label>

			<!-- Edit mode warning -->
			{#if isEditMode}
				<div
					class="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100"
					role="alert"
				>
					⚠️ {m['essentialsStep.ticketingImmutableEditWarning']()}
				</div>
			{/if}
		</div>

		<!-- Help text explaining the difference -->
		<div class="rounded-md bg-muted p-3 text-sm">
			<p class="font-medium text-foreground">{m['essentialsStep.whatsTheDifference']()}</p>
			<ul class="mt-2 space-y-1.5 text-xs text-muted-foreground">
				<li class="flex gap-2">
					<span class="text-primary">•</span>
					<span
						><strong>{m['essentialsStep.withTicketsLabel']()}</strong>
						{m['essentialsStep.withTicketsDescription']()}</span
					>
				</li>
				<li class="flex gap-2">
					<span class="text-primary">•</span>
					<span
						><strong>{m['essentialsStep.withoutTicketsLabel']()}</strong>
						{m['essentialsStep.withoutTicketsDescription']()}</span
					>
				</li>
			</ul>
		</div>
	</div>
{/snippet}

{#if standalone}
	<form onsubmit={handleSubmit} novalidate class="space-y-6">
		{@render fields()}

		<!-- Navigation Buttons -->
		<div
			class="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between"
		>
			<a
				href=".."
				class="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-6 py-3 font-semibold transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				{m['essentialsStep.cancel']()}
			</a>
			<button
				type="submit"
				disabled={isSaving}
				class={cn(
					'rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
					isSaving && 'cursor-not-allowed opacity-50'
				)}
			>
				{isSaving
					? m['essentialsStep.creatingEvent']()
					: isEditMode
						? m['essentialsStep.updateAndContinue']()
						: m['essentialsStep.createEvent']()}
			</button>
		</div>
	</form>
{:else}
	<div class="space-y-6">
		{@render fields()}
	</div>
{/if}
