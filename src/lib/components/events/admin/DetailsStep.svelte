<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventCreateSchema, EventSeriesRetrieveSchema } from '$lib/api/generated/types.gen';
	import { getBackendUrl } from '$lib/config/api';
	import {
		FileText,
		MapPin,
		Users,
		Settings,
		Image,
		ChevronDown,
		ChevronRight,
		CheckSquare,
		Hash
	} from 'lucide-svelte';
	import ImageUploader from '$lib/components/forms/ImageUploader.svelte';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import EventQuestionnaires from './EventQuestionnaires.svelte';
	import EventQuestionnaireAssignmentModal from './EventQuestionnaireAssignmentModal.svelte';
	import type { OrganizationQuestionnaireInListSchema } from '$lib/api/generated';

	interface Props {
		formData: Partial<EventCreateSchema> & {
			tags?: string[];
			logo?: string;
			cover_art?: string;
			organization_logo?: string;
			organization_cover_art?: string;
			requires_ticket?: boolean;
		};
		eventSeries?: EventSeriesRetrieveSchema[];
		questionnaires?: OrganizationQuestionnaireInListSchema[];
		eventId?: string | null;
		organizationId?: string;
		organizationSlug?: string;
		accessToken?: string;
		onUpdate: (data: Partial<EventCreateSchema> & { tags?: string[] }) => void;
		onUpdateImages: (data: {
			logo?: File | null;
			coverArt?: File | null;
			deleteLogo?: boolean;
			deleteCoverArt?: boolean;
		}) => void;
	}

	let {
		formData,
		eventSeries = [],
		questionnaires = [],
		eventId = null,
		organizationId = '',
		organizationSlug = '',
		accessToken = '',
		onUpdate,
		onUpdateImages
	}: Props = $props();

	// Modal state for questionnaire assignment
	let isQuestionnaireModalOpen = $state(false);

	// Accordion state
	let openSections = $state<Set<string>>(new Set(['basic']));

	// Tag input state
	let tagInput = $state('');

	// Description state (for MarkdownEditor)
	let description = $state(formData.description || '');

	// Image state
	let logoFile = $state<File | null>(null);
	let coverArtFile = $state<File | null>(null);

	// Sync description with formData when it changes externally
	$effect(() => {
		description = formData.description || '';
	});

	// Helper function to get full image URL
	function getImageUrl(path: string | null | undefined): string | null {
		if (!path) return null;
		return getBackendUrl(path);
	}

	// Compute image URLs with fallback to organization
	const logoUrl = $derived(getImageUrl(formData.logo) || getImageUrl(formData.organization_logo));
	const coverArtUrl = $derived(
		getImageUrl(formData.cover_art) || getImageUrl(formData.organization_cover_art)
	);

	/**
	 * Toggle accordion section
	 */
	function toggleSection(section: string): void {
		const newSections = new Set(openSections);
		if (newSections.has(section)) {
			newSections.delete(section);
		} else {
			newSections.add(section);
		}
		openSections = newSections;
	}

	/**
	 * Handle logo file select
	 */
	function handleLogoFileSelect(file: File | null): void {
		logoFile = file;
		onUpdateImages({ logo: file, deleteLogo: false });
	}

	/**
	 * Handle cover art file select
	 */
	function handleCoverArtFileSelect(file: File | null): void {
		coverArtFile = file;
		onUpdateImages({ coverArt: file, deleteCoverArt: false });
	}

	/**
	 * Handle logo removal
	 */
	function handleRemoveLogo(): void {
		logoFile = null;
		onUpdateImages({ logo: null, deleteLogo: true });
	}

	/**
	 * Handle cover art removal
	 */
	function handleRemoveCoverArt(): void {
		coverArtFile = null;
		onUpdateImages({ coverArt: null, deleteCoverArt: true });
	}

	/**
	 * Handle description changes
	 */
	function handleDescriptionChange(value: string): void {
		description = value;
		onUpdate({ description: value });
	}

	/**
	 * Add tag
	 */
	function addTag(): void {
		const tag = tagInput.trim();
		if (tag && !(formData.tags || []).includes(tag)) {
			onUpdate({ tags: [...(formData.tags || []), tag] });
			tagInput = '';
		}
	}

	/**
	 * Remove tag
	 */
	function removeTag(tag: string): void {
		onUpdate({ tags: (formData.tags || []).filter((t) => t !== tag) });
	}

	/**
	 * Handle tag input keydown
	 */
	function handleTagKeydown(e: KeyboardEvent): void {
		if (e.key === 'Enter') {
			e.preventDefault();
			addTag();
		}
	}

	// Derived state
	let isSectionOpen = (section: string) => openSections.has(section);
</script>

<div class="space-y-4">
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

				<!-- Address -->
				<div class="space-y-2">
					<label for="address" class="block text-sm font-medium">
						<span class="flex items-center gap-2">
							<MapPin class="h-4 w-4" aria-hidden="true" />
							{m['detailsStep.address']()}
						</span>
					</label>
					<input
						id="address"
						type="text"
						value={formData.address || ''}
						oninput={(e) => onUpdate({ address: e.currentTarget.value })}
						placeholder={m['detailsStep.addressPlaceholder']()}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					/>
				</div>
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
				</div>

				<!-- Waitlist Open -->
				<label
					class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
				>
					<input
						type="checkbox"
						checked={formData.waitlist_open || false}
						onchange={(e) => onUpdate({ waitlist_open: e.currentTarget.checked })}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
					/>
					<div class="flex-1">
						<div class="font-medium">{m['detailsStep.waitlistOpen']()}</div>
						<div class="text-sm text-muted-foreground">
							{m['detailsStep.waitlistHint']()}
						</div>
					</div>
				</label>

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
				</div>
			</div>
		{/if}
	</div>

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

				<!-- Accept Invitation Requests -->
				<label
					class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
				>
					<input
						type="checkbox"
						checked={formData.accept_invitation_requests || false}
						onchange={(e) => onUpdate({ accept_invitation_requests: e.currentTarget.checked })}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
					/>
					<div class="flex-1">
						<div class="font-medium">{m['detailsStep.acceptInvitationRequests']()}</div>
						<div class="text-sm text-muted-foreground">
							{m['detailsStep.invitationRequestHint']()}
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

				<!-- Tags -->
				<div class="space-y-2">
					<label for="tags-input" class="block text-sm font-medium">
						<span class="flex items-center gap-2">
							<Hash class="h-4 w-4" aria-hidden="true" />
							{m['detailsStep.tags']()}
						</span>
					</label>
					<div class="flex gap-2">
						<input
							id="tags-input"
							type="text"
							value={tagInput}
							oninput={(e) => (tagInput = e.currentTarget.value)}
							onkeydown={handleTagKeydown}
							placeholder={m['detailsStep.addTagsPlaceholder']()}
							class="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						/>
						<button
							type="button"
							onclick={addTag}
							class="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							{m['detailsStep.add']()}
						</button>
					</div>
					{#if formData.tags && formData.tags.length > 0}
						<div class="flex flex-wrap gap-2">
							{#each formData.tags as tag}
								<span
									class="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
								>
									{tag}
									<button
										type="button"
										onclick={() => removeTag(tag)}
										class="ml-1 rounded-full p-0.5 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										aria-label={m['detailsStep.removeTag']({ tag })}
									>
										<svg
											class="h-3 w-3"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								</span>
							{/each}
						</div>
					{/if}
				</div>

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
							{#each eventSeries as series}
								<option value={series.id}>{series.name}</option>
							{/each}
						</select>
					</div>
				{/if}

				<!-- Questionnaires -->
				{#if eventId && organizationId && accessToken}
					<EventQuestionnaires
						{eventId}
						assignedQuestionnaires={questionnaires}
						{organizationId}
						{accessToken}
						onAssignClick={() => (isQuestionnaireModalOpen = true)}
					/>
				{:else if questionnaires.length > 0}
					<div class="space-y-2">
						<p class="text-sm text-muted-foreground">
							{m['detailsStep.saveToAssignQuestionnaires']()}
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Media Section -->
	<div class="overflow-hidden rounded-lg border border-border">
		<button
			type="button"
			onclick={() => toggleSection('media')}
			class="flex w-full items-center justify-between bg-muted/50 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			aria-expanded={isSectionOpen('media')}
		>
			<div class="flex items-center gap-2 font-semibold">
				<Image class="h-5 w-5" aria-hidden="true" />
				{m['detailsStep.media']()}
			</div>
			{#if isSectionOpen('media')}
				<ChevronDown class="h-5 w-5" aria-hidden="true" />
			{:else}
				<ChevronRight class="h-5 w-5" aria-hidden="true" />
			{/if}
		</button>

		{#if isSectionOpen('media')}
			<div class="space-y-6 p-4">
				<!-- Logo Upload -->
				<ImageUploader
					bind:value={logoFile}
					preview={logoUrl}
					label={m['detailsStep.eventLogo']()}
					aspectRatio="square"
					accept="image/jpeg,image/png,image/webp"
					maxSize={5 * 1024 * 1024}
					onFileSelect={(file) => {
						if (file) handleLogoFileSelect(file);
						else handleRemoveLogo();
					}}
				/>
				<p class="-mt-4 text-xs text-muted-foreground">
					{m['detailsStep.logoHint']()}
				</p>

				<!-- Cover Art Upload -->
				<ImageUploader
					bind:value={coverArtFile}
					preview={coverArtUrl}
					label={m['detailsStep.coverArt']()}
					aspectRatio="wide"
					accept="image/jpeg,image/png,image/webp"
					maxSize={5 * 1024 * 1024}
					onFileSelect={(file) => {
						if (file) handleCoverArtFileSelect(file);
						else handleRemoveCoverArt();
					}}
				/>
				<p class="-mt-4 text-xs text-muted-foreground">
					{m['detailsStep.coverArtHint']()}
				</p>
			</div>
		{/if}
	</div>
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
