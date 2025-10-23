<script lang="ts">
	import type {
		EventCreateSchema,
		EventSeriesRetrieveSchema,
		QuestionnaireSchema
	} from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import {
		FileText,
		Calendar,
		MapPin,
		Ticket,
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

	// Backend URL for images
	const BACKEND_URL = 'http://localhost:8000';

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
		// If path is already a full URL, return it
		if (path.startsWith('http://') || path.startsWith('https://')) {
			return path;
		}
		// Otherwise, prepend backend URL
		return `${BACKEND_URL}${path}`;
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
				Basic Details
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
					label="Description"
					placeholder="Describe your event in detail..."
					rows={8}
					onValueChange={handleDescriptionChange}
				/>

				<!-- Address -->
				<div class="space-y-2">
					<label for="address" class="block text-sm font-medium">
						<span class="flex items-center gap-2">
							<MapPin class="h-4 w-4" aria-hidden="true" />
							Address
						</span>
					</label>
					<input
						id="address"
						type="text"
						value={formData.address || ''}
						oninput={(e) => onUpdate({ address: e.currentTarget.value })}
						placeholder="123 Main St, Suite 100"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					/>
				</div>
			</div>
		{/if}
	</div>

	<!-- RSVP/Ticketing Section -->
	<div class="overflow-hidden rounded-lg border border-border">
		<button
			type="button"
			onclick={() => toggleSection('rsvp')}
			class="flex w-full items-center justify-between bg-muted/50 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			aria-expanded={isSectionOpen('rsvp')}
		>
			<div class="flex items-center gap-2 font-semibold">
				{#if formData.requires_ticket}
					<Ticket class="h-5 w-5" aria-hidden="true" />
					Ticketing Options
				{:else}
					<CheckSquare class="h-5 w-5" aria-hidden="true" />
					RSVP Options
				{/if}
			</div>
			{#if isSectionOpen('rsvp')}
				<ChevronDown class="h-5 w-5" aria-hidden="true" />
			{:else}
				<ChevronRight class="h-5 w-5" aria-hidden="true" />
			{/if}
		</button>

		{#if isSectionOpen('rsvp')}
			<div class="space-y-4 p-4">
				<!-- RSVP Deadline (for all events) -->
				<div class="space-y-2">
					<label for="rsvp-before" class="block text-sm font-medium">
						{formData.requires_ticket ? 'Ticket Purchase' : 'RSVP'} Deadline
					</label>
					<input
						id="rsvp-before"
						type="datetime-local"
						value={formData.rsvp_before || ''}
						oninput={(e) => onUpdate({ rsvp_before: e.currentTarget.value })}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					/>
					<p class="text-xs text-muted-foreground">
						Last date and time to {formData.requires_ticket ? 'purchase tickets' : 'RSVP'} (timezone:
						{Intl.DateTimeFormat().resolvedOptions().timeZone})
					</p>
				</div>

				{#if formData.requires_ticket}
					<!-- Free for Members (tickets only) -->
					<label
						class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
					>
						<input
							type="checkbox"
							checked={formData.free_for_members || false}
							onchange={(e) => onUpdate({ free_for_members: e.currentTarget.checked })}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
						/>
						<div class="flex-1">
							<div class="font-medium">Free for Members</div>
							<div class="text-sm text-muted-foreground">
								Organization members don't need to pay for tickets
							</div>
						</div>
					</label>

					<!-- Free for Staff (tickets only) -->
					<label
						class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
					>
						<input
							type="checkbox"
							checked={formData.free_for_staff || false}
							onchange={(e) => onUpdate({ free_for_staff: e.currentTarget.checked })}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
						/>
						<div class="flex-1">
							<div class="font-medium">Free for Staff</div>
							<div class="text-sm text-muted-foreground">
								Staff members don't need to pay for tickets
							</div>
						</div>
					</label>

					<p class="text-sm italic text-muted-foreground">
						Note: Ticket tier management will be available in a future update
					</p>
				{/if}
			</div>
		{/if}
	</div>

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
				Capacity
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
					<label for="max-attendees" class="block text-sm font-medium"> Maximum Attendees </label>
					<input
						id="max-attendees"
						type="number"
						min="1"
						value={formData.max_attendees || ''}
						oninput={(e) =>
							onUpdate({ max_attendees: parseInt(e.currentTarget.value) || undefined })}
						placeholder="Unlimited"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					/>
					<p class="text-xs text-muted-foreground">Leave empty for unlimited capacity</p>
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
						<div class="font-medium">Waitlist Open</div>
						<div class="text-sm text-muted-foreground">
							Allow users to join a waitlist when event is full
						</div>
					</div>
				</label>

				<!-- Invitation Message -->
				<div class="space-y-2">
					<label for="invitation-message" class="block text-sm font-medium">
						Invitation Message
					</label>
					<textarea
						id="invitation-message"
						value={formData.invitation_message || ''}
						oninput={(e) => onUpdate({ invitation_message: e.currentTarget.value })}
						placeholder="Welcome message for attendees..."
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
				Advanced
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
							Check-in Opens At
						</label>
						<input
							id="check-in-starts"
							type="datetime-local"
							value={formData.check_in_starts_at || ''}
							oninput={(e) => onUpdate({ check_in_starts_at: e.currentTarget.value })}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						/>
						<p class="text-xs text-muted-foreground">
							When ticket check-in becomes available (timezone: {Intl.DateTimeFormat().resolvedOptions()
								.timeZone})
						</p>
					</div>

					<!-- Check-in Ends At (tickets only) -->
					<div class="space-y-2">
						<label for="check-in-ends" class="block text-sm font-medium">
							Check-in Closes At
						</label>
						<input
							id="check-in-ends"
							type="datetime-local"
							value={formData.check_in_ends_at || ''}
							oninput={(e) => onUpdate({ check_in_ends_at: e.currentTarget.value })}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						/>
						<p class="text-xs text-muted-foreground">
							When ticket check-in is no longer available (timezone: {Intl.DateTimeFormat().resolvedOptions()
								.timeZone})
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
						<div class="font-medium">Enable Potluck</div>
						<div class="text-sm text-muted-foreground">
							Allow attendees to create and claim items to bring
						</div>
					</div>
				</label>

				<!-- Tags -->
				<div class="space-y-2">
					<label for="tags-input" class="block text-sm font-medium">
						<span class="flex items-center gap-2">
							<Hash class="h-4 w-4" aria-hidden="true" />
							Tags
						</span>
					</label>
					<div class="flex gap-2">
						<input
							id="tags-input"
							type="text"
							value={tagInput}
							oninput={(e) => (tagInput = e.currentTarget.value)}
							onkeydown={handleTagKeydown}
							placeholder="Add tags..."
							class="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						/>
						<button
							type="button"
							onclick={addTag}
							class="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							Add
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
										aria-label="Remove {tag} tag"
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
						<label for="event-series" class="block text-sm font-medium"> Event Series </label>
						<select
							id="event-series"
							value={formData.event_series_id || ''}
							onchange={(e) => onUpdate({ event_series_id: e.currentTarget.value || null })}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							<option value="">None</option>
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
							Save the event first to assign questionnaires
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
				Media
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
					label="Event Logo"
					aspectRatio="square"
					accept="image/jpeg,image/png,image/webp"
					maxSize={5 * 1024 * 1024}
					onFileSelect={(file) => {
						if (file) handleLogoFileSelect(file);
						else handleRemoveLogo();
					}}
				/>
				<p class="-mt-4 text-xs text-muted-foreground">
					Recommended: Square image, at least 400x400px. Falls back to organization logo if not set.
				</p>

				<!-- Cover Art Upload -->
				<ImageUploader
					bind:value={coverArtFile}
					preview={coverArtUrl}
					label="Cover Art"
					aspectRatio="wide"
					accept="image/jpeg,image/png,image/webp"
					maxSize={5 * 1024 * 1024}
					onFileSelect={(file) => {
						if (file) handleCoverArtFileSelect(file);
						else handleRemoveCoverArt();
					}}
				/>
				<p class="-mt-4 text-xs text-muted-foreground">
					Recommended: 16:9 aspect ratio, at least 1200x675px. Falls back to organization cover if
					not set.
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
