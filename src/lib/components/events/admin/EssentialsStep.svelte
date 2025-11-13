<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventCreateSchema, CitySchema } from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import CityAutocomplete from '$lib/components/forms/CityAutocomplete.svelte';
	import { Calendar, Eye, Users, Ticket } from 'lucide-svelte';

	interface Props {
		formData: Partial<EventCreateSchema> & { requires_ticket?: boolean };
		validationErrors: Record<string, string>;
		orgCity?: CitySchema | null;
		userCity?: CitySchema | null;
		eventCity?: CitySchema | null;
		isEditMode: boolean;
		onUpdate: (data: Partial<EventCreateSchema> & { requires_ticket?: boolean }) => void;
		onSubmit: () => void;
		isSaving: boolean;
	}

	let {
		formData,
		validationErrors,
		orgCity,
		userCity,
		eventCity,
		isEditMode,
		onUpdate,
		onSubmit,
		isSaving
	}: Props = $props();

	// Local state for city selection
	let selectedCity = $state<CitySchema | null>(null);

	// Initialize selected city from form data
	$effect(() => {
		if (formData.city_id && !selectedCity) {
			// If editing, prioritize the event's city
			if (eventCity && eventCity.id === formData.city_id) {
				selectedCity = eventCity;
			}
			// Otherwise check org or user city
			else if (orgCity && orgCity.id === formData.city_id) {
				selectedCity = orgCity;
			} else if (userCity && userCity.id === formData.city_id) {
				selectedCity = userCity;
			}
		}
	});

	/**
	 * Handle city selection
	 */
	function handleCitySelect(city: CitySchema | null): void {
		selectedCity = city;
		onUpdate({ city_id: city?.id || null });
	}

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
	let combinationExplanation = $derived.by(() => {
		const visibility = formData.visibility || 'public';
		const eventType = (formData.event_type as string) || 'public';

		// Define who can see
		const whoCanSee =
			visibility === 'public'
				? 'Everyone'
				: visibility === 'members-only'
					? 'Only organization members'
					: visibility === 'staff-only'
						? 'Only organization staff'
						: 'Only invited users'; // private

		// Define who can attend
		const whoCanAttend =
			eventType === 'public'
				? 'anyone'
				: eventType === 'members-only'
					? 'only organization members'
					: 'only invited people'; // private

		// Special case: public visibility + members-only type → join org CTA
		const showJoinOrgHint = visibility === 'public' && eventType === 'members-only';

		return {
			whoCanSee,
			whoCanAttend,
			showJoinOrgHint
		};
	});
</script>

<form onsubmit={handleSubmit} class="space-y-6">
	<!-- Event Name -->
	<div class="space-y-2">
		<label for="event-name" class="block text-sm font-medium">
			Event Name <span class="text-destructive">*</span>
		</label>
		<input
			id="event-name"
			type="text"
			value={formData.name || ''}
			oninput={(e) => onUpdate({ name: e.currentTarget.value })}
			placeholder="e.g., Community Potluck Dinner"
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

	<!-- Start Date/Time -->
	<div class="space-y-2">
		<label for="event-start" class="block text-sm font-medium">
			<span class="flex items-center gap-2">
				<Calendar class="h-4 w-4" aria-hidden="true" />
				Start Date & Time <span class="text-destructive">*</span>
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
		<p class="text-xs text-muted-foreground">
			Times are in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone})
		</p>
	</div>

	<!-- End Date/Time -->
	<div class="space-y-2">
		<label for="event-end" class="block text-sm font-medium">
			<span class="flex items-center gap-2">
				<Calendar class="h-4 w-4" aria-hidden="true" />
				End Date & Time
			</span>
		</label>
		<input
			id="event-end"
			type="datetime-local"
			value={formData.end || ''}
			oninput={(e) => onUpdate({ end: e.currentTarget.value })}
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
		<p class="text-xs text-muted-foreground">{m['SFwESEssentialsStep.optionalOpenEnded']()}</p>
	</div>

	<!-- City -->
	<div class="space-y-2">
		<CityAutocomplete
			value={selectedCity}
			onSelect={handleCitySelect}
			error={validationErrors.city_id}
			label="City"
			description=""
		/>
		{#if validationErrors.city_id}
			<p class="text-sm text-destructive" role="alert">
				{validationErrors.city_id}
			</p>
		{/if}
		<p class="text-xs text-muted-foreground">
			{m['SFwESEssentialsStep.whereWillThisEventTakePlace']()}
		</p>
	</div>

	<!-- Visibility -->
	<div class="space-y-2">
		<label class="block text-sm font-medium">
			<span class="flex items-center gap-2">
				<Eye class="h-4 w-4" aria-hidden="true" />
				Visibility
			</span>
		</label>
		<div class="space-y-2" role="radiogroup" aria-label="Event visibility">
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
						Only organization members can see the event
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
						Only org's staff members can see the event
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
				Event Type
			</span>
		</label>
		<div class="space-y-2" role="radiogroup" aria-label="Event type">
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
					<h4 class="text-sm font-medium text-blue-900 dark:text-blue-100">With these settings:</h4>
					<div class="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
						<p>
							<strong>Who can view:</strong>
							{combinationExplanation.whoCanSee} can see this event in search results and listings
						</p>
						<p>
							<strong>Who can attend:</strong>
							{combinationExplanation.whoCanAttend.charAt(0).toUpperCase() +
								combinationExplanation.whoCanAttend.slice(1)} can RSVP or get tickets
						</p>
						{#if combinationExplanation.showJoinOrgHint}
							<p class="mt-2 rounded-md bg-blue-100 px-2 py-1.5 text-xs dark:bg-blue-900">
								💡 <strong>Tip:</strong> Non-members will see a "Join Organization" button to become
								eligible
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
					Ticketing
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
							<p class="font-medium">Important: This setting cannot be changed after creation</p>
							<p class="mt-1 text-xs text-orange-700 dark:text-orange-200">
								Choose carefully whether your event will use tickets or simple RSVPs
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
					<div class="font-medium">Requires Ticket</div>
					<div class="text-sm text-muted-foreground">
						Use paid/free tickets instead of simple RSVPs
					</div>
				</div>
			</label>

			<!-- Edit mode warning -->
			{#if isEditMode}
				<div
					class="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100"
					role="alert"
				>
					⚠️ This setting cannot be changed after the event is created
				</div>
			{/if}
		</div>

		<!-- Help text explaining the difference -->
		<div class="rounded-md bg-muted p-3 text-sm">
			<p class="font-medium text-foreground">What's the difference?</p>
			<ul class="mt-2 space-y-1.5 text-xs text-muted-foreground">
				<li class="flex gap-2">
					<span class="text-primary">•</span>
					<span
						><strong>With Tickets:</strong> Attendees purchase or claim tickets. You can set prices,
						tier limits, and check-in attendees.</span
					>
				</li>
				<li class="flex gap-2">
					<span class="text-primary">•</span>
					<span
						><strong>Without Tickets (RSVP):</strong> Attendees simply RSVP "Yes" or "Maybe". Simpler
						but with fewer management features.</span
					>
				</li>
			</ul>
		</div>
	</div>

	<!-- Navigation Buttons -->
	<div class="flex justify-between border-t border-border pt-6">
		<a
			href=".."
			class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-6 py-3 font-semibold transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			Cancel
		</a>
		<button
			type="submit"
			disabled={isSaving}
			class={cn(
				'rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
				isSaving && 'cursor-not-allowed opacity-50'
			)}
		>
			{isSaving ? 'Creating Event...' : isEditMode ? 'Update & Continue' : 'Create Event'}
		</button>
	</div>
</form>
