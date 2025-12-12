<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import CityAutocomplete from '$lib/components/forms/CityAutocomplete.svelte';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import ImageUploader from '$lib/components/forms/ImageUploader.svelte';
	import StripeConnect from '$lib/components/organization/StripeConnect.svelte';
	import type { CitySchema } from '$lib/api/generated';
	import {
		Building2,
		AlertCircle,
		Check,
		Eye,
		Hash,
		Mail,
		X,
		Instagram,
		Facebook,
		Send,
		AtSign
	} from 'lucide-svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { getBackendUrl } from '$lib/config/api';
	import { toast } from 'svelte-sonner';
	import {
		organizationadminUploadLogo,
		organizationadminUploadCoverArt,
		organizationadminDeleteLogo,
		organizationadminDeleteCoverArt,
		organizationadminAddTags,
		organizationadminRemoveTags,
		organizationadminUpdateContactEmail,
		tagListTags
	} from '$lib/api/generated/sdk.gen';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	// Form state - always sync with latest data
	let description = $state(data.organization.description || '');
	let address = $state(data.organization.address || '');
	let selectedCity = $state<CitySchema | null>(data.organization.city || null);
	let visibility = $state(data.organization.visibility || 'public');
	let acceptNewMembers = $state(data.organization.accept_membership_requests || false);
	let isSubmitting = $state(false);

	// Social media state
	let instagramUrl = $state(data.organization.instagram_url || '');
	let facebookUrl = $state(data.organization.facebook_url || '');
	let blueskyUrl = $state(data.organization.bluesky_url || '');
	let telegramUrl = $state(data.organization.telegram_url || '');

	// Email change modal state
	let showEmailModal = $state(false);
	let newEmail = $state('');
	let isUpdatingEmail = $state(false);
	let emailUpdateError = $state<string | null>(null);
	let emailSent = $state(false);

	// Image upload state
	let logoFile = $state<File | null>(null);
	let coverFile = $state<File | null>(null);
	let uploadingLogo = $state(false);
	let uploadingCover = $state(false);
	let uploadError = $state<string | null>(null);
	let lastUploadedLogoName = $state<string | null>(null);
	let lastUploadedCoverName = $state<string | null>(null);

	// Track if user wants to delete images (will be processed on form save)
	let shouldDeleteLogo = $state(false);
	let shouldDeleteCover = $state(false);

	// Tag management state
	let tags = $state<string[]>(data.organization.tags || []);
	let initialTags = $state<string[]>(data.organization.tags || []);
	let tagInput = $state('');
	let tagSuggestions = $state<string[]>([]);
	let showTagSuggestions = $state(false);
	let isLoadingTagSuggestions = $state(false);
	let tagSearchTimeout: ReturnType<typeof setTimeout> | null = null;

	// Helper function to get full image URL
	function getImageUrl(path: string | null | undefined): string | null {
		if (!path) return null;
		// getBackendUrl already handles full URLs and path normalization
		return getBackendUrl(path);
	}

	// Computed full URLs for images (hide if marked for deletion)
	const logoUrl = $derived(shouldDeleteLogo ? null : getImageUrl(data.organization.logo));
	const coverUrl = $derived(shouldDeleteCover ? null : getImageUrl(data.organization.cover_art));

	// Sync form state when data changes (after submission)
	$effect(() => {
		description = data.organization.description || '';
		address = data.organization.address || '';
		selectedCity = data.organization.city || null;
		visibility = data.organization.visibility || 'public';
		acceptNewMembers = data.organization.accept_membership_requests || false;
		tags = data.organization.tags || [];
		initialTags = data.organization.tags || [];
		// Social media fields
		instagramUrl = data.organization.instagram_url || '';
		facebookUrl = data.organization.facebook_url || '';
		blueskyUrl = data.organization.bluesky_url || '';
		telegramUrl = data.organization.telegram_url || '';
	});

	// Handle city selection
	function handleCitySelect(city: CitySchema | null) {
		selectedCity = city;
	}

	// Update contact email
	async function handleEmailUpdate() {
		if (!accessToken || !newEmail.trim()) return;

		isUpdatingEmail = true;
		emailUpdateError = null;
		emailSent = false;

		try {
			const { data: orgData, error } = await organizationadminUpdateContactEmail({
				headers: {
					Authorization: `Bearer ${accessToken}`
				},
				path: {
					slug: data.organization.slug
				},
				body: {
					email: newEmail.trim()
				}
			});

			if (error || !orgData) {
				emailUpdateError =
					typeof error === 'object' && error && 'detail' in error
						? (error as { detail?: string }).detail || 'Failed to update email'
						: 'Failed to update email';
				return;
			}

			// Check if email was already verified (same as user's email)
			if (orgData.contact_email_verified) {
				toast.success('Email updated successfully - no verification needed');
				showEmailModal = false;
				newEmail = '';
				// Refresh page to show new email
				window.location.reload();
			} else {
				// Verification email sent
				emailSent = true;
				toast.success('Verification email sent! Please check your inbox.');
			}
		} catch (err) {
			console.error('[EMAIL UPDATE] Error:', err);
			emailUpdateError = 'An unexpected error occurred';
		} finally {
			isUpdatingEmail = false;
		}
	}

	// Upload logo
	async function uploadLogo() {
		if (!logoFile || !accessToken) return;

		uploadingLogo = true;
		uploadError = null;

		try {
			console.log('[LOGO UPLOAD] Starting upload for:', logoFile.name);
			const response = await organizationadminUploadLogo({
				path: { slug: data.organization.slug },
				body: {
					logo: logoFile
				},
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			console.log('[LOGO UPLOAD] Response:', response);

			if (response.error) {
				const errorMsg =
					typeof response.error === 'object' && response.error && 'detail' in response.error
						? String(response.error.detail)
						: JSON.stringify(response.error);
				throw new Error(`Upload failed: ${errorMsg}`);
			}

			if (!response.data) {
				throw new Error('Failed to upload logo - no data returned');
			}

			console.log('[LOGO UPLOAD] Success, reloading page');
			// Refresh the page to show the new logo
			window.location.reload();
		} catch (err) {
			console.error('[LOGO UPLOAD] Error:', err);
			uploadError = err instanceof Error ? err.message : 'Failed to upload logo';
			uploadingLogo = false;
		}
	}

	// Upload cover art
	async function uploadCover() {
		if (!coverFile || !accessToken) return;

		uploadingCover = true;
		uploadError = null;

		try {
			console.log('[COVER UPLOAD] Starting upload for:', coverFile.name);
			const response = await organizationadminUploadCoverArt({
				path: { slug: data.organization.slug },
				body: {
					cover_art: coverFile
				},
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			console.log('[COVER UPLOAD] Response:', response);

			if (response.error) {
				const errorMsg =
					typeof response.error === 'object' && response.error && 'detail' in response.error
						? String(response.error.detail)
						: JSON.stringify(response.error);
				throw new Error(`Upload failed: ${errorMsg}`);
			}

			if (!response.data) {
				throw new Error('Failed to upload cover art - no data returned');
			}

			console.log('[COVER UPLOAD] Success, reloading page');
			// Refresh the page to show the new cover
			window.location.reload();
		} catch (err) {
			console.error('[COVER UPLOAD] Error:', err);
			uploadError = err instanceof Error ? err.message : 'Failed to upload cover art';
			uploadingCover = false;
		}
	}

	// Handle logo file selection
	function handleLogoFileSelect(file: File | null) {
		logoFile = file;
		if (file) {
			shouldDeleteLogo = false; // If selecting a new file, cancel delete
		}
	}

	// Handle cover file selection
	function handleCoverFileSelect(file: File | null) {
		coverFile = file;
		if (file) {
			shouldDeleteCover = false; // If selecting a new file, cancel delete
		}
	}

	// Handle logo removal
	function handleRemoveLogo() {
		logoFile = null;
		shouldDeleteLogo = true;
	}

	// Handle cover removal
	function handleRemoveCover() {
		coverFile = null;
		shouldDeleteCover = true;
	}

	// Process image uploads/deletions when form is submitted
	async function processImageChanges() {
		if (!accessToken) return;

		// Upload logo if a new file was selected
		if (logoFile && logoFile.name !== lastUploadedLogoName) {
			console.log('[LOGO] Uploading new logo:', logoFile.name);
			await uploadLogo();
			lastUploadedLogoName = logoFile.name;
		}

		// Upload cover if a new file was selected
		if (coverFile && coverFile.name !== lastUploadedCoverName) {
			console.log('[COVER] Uploading new cover:', coverFile.name);
			await uploadCover();
			lastUploadedCoverName = coverFile.name;
		}

		// Delete logo if marked for deletion
		if (shouldDeleteLogo && data.organization.logo) {
			console.log('[LOGO] Deleting logo');
			const response = await organizationadminDeleteLogo({
				path: { slug: data.organization.slug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				console.error('[LOGO] Delete failed:', response.error);
			} else {
				shouldDeleteLogo = false;
			}
		}

		// Delete cover if marked for deletion
		if (shouldDeleteCover && data.organization.cover_art) {
			console.log('[COVER] Deleting cover art');
			const response = await organizationadminDeleteCoverArt({
				path: { slug: data.organization.slug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				console.error('[COVER] Delete failed:', response.error);
			} else {
				shouldDeleteCover = false;
			}
		}

		// Save tag associations
		await saveTagAssociations();
	}

	/**
	 * Fetch tag suggestions from API
	 */
	async function fetchTagSuggestions(search: string): Promise<void> {
		if (!search.trim()) {
			tagSuggestions = [];
			showTagSuggestions = false;
			return;
		}

		isLoadingTagSuggestions = true;

		try {
			const response = await tagListTags({
				query: { search: search.trim() }
			});

			if (response.data?.results) {
				// Filter out tags that are already added
				tagSuggestions = response.data.results
					.map((tag) => tag.name)
					.filter((tagName) => !tags.includes(tagName));
				showTagSuggestions = tagSuggestions.length > 0;
			}
		} catch (error) {
			console.error('Failed to fetch tag suggestions:', error);
			tagSuggestions = [];
		} finally {
			isLoadingTagSuggestions = false;
		}
	}

	/**
	 * Handle tag input changes (with debouncing)
	 */
	function handleTagInput(e: Event): void {
		const target = e.target as HTMLInputElement;
		const value = target.value;
		tagInput = value;

		// Clear existing timeout
		if (tagSearchTimeout) {
			clearTimeout(tagSearchTimeout);
		}

		// Debounce search
		tagSearchTimeout = setTimeout(() => {
			fetchTagSuggestions(value);
		}, 300);
	}

	/**
	 * Add tag
	 */
	function addTag(tag?: string): void {
		const tagToAdd = tag || tagInput.trim();
		if (tagToAdd && !tags.includes(tagToAdd)) {
			tags = [...tags, tagToAdd];
			tagInput = '';
			tagSuggestions = [];
			showTagSuggestions = false;
		}
	}

	/**
	 * Remove tag
	 */
	function removeTag(tag: string): void {
		tags = tags.filter((t) => t !== tag);
	}

	/**
	 * Save tag associations (add/remove tags)
	 */
	async function saveTagAssociations(): Promise<void> {
		if (!accessToken) return;

		// Determine which tags were added and removed
		const addedTags = tags.filter((tag) => !initialTags.includes(tag));
		const removedTags = initialTags.filter((tag) => !tags.includes(tag));

		// Add new tags
		if (addedTags.length > 0) {
			await organizationadminAddTags({
				path: { slug: data.organization.slug },
				body: { tags: addedTags },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
		}

		// Remove deleted tags
		if (removedTags.length > 0) {
			await organizationadminRemoveTags({
				path: { slug: data.organization.slug },
				body: { tags: removedTags },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
		}

		// Update initialTags to current state
		initialTags = [...tags];
	}
</script>

<svelte:head>
	<title>{m['orgAdmin.settings.pageTitle']()} - {data.organization.name} Admin | Revel</title>
	<meta name="description" content={m['orgAdmin.settings.metaDescription']()} />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6 px-4 md:px-0">
	<!-- Header with Public Profile Button -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
				{m['orgAdmin.settings.pageTitle']()}
			</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{m['orgAdmin.settings.pageDescription']()}
			</p>
		</div>

		<a
			href="/org/{data.organization.slug}"
			target="_blank"
			rel="noopener noreferrer"
			class="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			<Eye class="h-4 w-4" aria-hidden="true" />
			{m['orgAdmin.settings.viewPublicProfile']()}
		</a>
	</div>

	<!-- Success Message -->
	{#if form?.success}
		<div
			class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
			role="alert"
		>
			<Check class="h-5 w-5 shrink-0" aria-hidden="true" />
			<p class="text-sm font-medium">{m['orgAdmin.settings.successMessage']()}</p>
		</div>
	{/if}

	<!-- Error Message -->
	{#if form?.errors && 'form' in form.errors}
		<div
			class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
			role="alert"
		>
			<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
			<p class="text-sm font-medium">{form.errors.form}</p>
		</div>
	{/if}

	<!-- Organization Identity (Read-only) -->
	<section class="rounded-lg border border-border bg-card p-6 shadow-sm">
		<div class="mb-4 flex items-center gap-2">
			<Building2 class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
			<h2 class="text-lg font-semibold">{m['orgAdmin.settings.identity.heading']()}</h2>
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<!-- Name (Read-only) -->
			<div>
				<div class="block text-sm font-medium text-muted-foreground">
					{m['orgAdmin.settings.identity.orgNameLabel']()}
				</div>
				<div class="mt-1 rounded-md border border-border bg-muted px-3 py-2 text-sm">
					{data.organization.name}
				</div>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['orgAdmin.settings.identity.orgNameHelp']()}
				</p>
			</div>

			<!-- Slug (Read-only) -->
			<div>
				<div class="block text-sm font-medium text-muted-foreground">
					{m['orgAdmin.settings.identity.urlSlugLabel']()}
				</div>
				<div class="mt-1 rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">
					{data.organization.slug}
				</div>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['orgAdmin.settings.identity.urlSlugHelp']()}
				</p>
			</div>
		</div>
	</section>

	<!-- Platform Fees (Read-only) -->
	<section class="rounded-lg border border-border bg-card p-6 shadow-sm">
		<div class="mb-4 flex items-center gap-2">
			<Building2 class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
			<h2 class="text-lg font-semibold">{m['orgAdmin.settings.platformFees.heading']()}</h2>
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<!-- Platform Fee Percent -->
			<div>
				<div class="block text-sm font-medium text-muted-foreground">
					{m['orgAdmin.settings.platformFees.percentLabel']()}
				</div>
				<div class="mt-1 rounded-md border border-border bg-muted px-3 py-2 text-sm">
					{data.organization.platform_fee_percent}%
				</div>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['orgAdmin.settings.platformFees.percentHelp']()}
				</p>
			</div>

			<!-- Platform Fee Fixed -->
			<div>
				<div class="block text-sm font-medium text-muted-foreground">
					{m['orgAdmin.settings.platformFees.fixedLabel']()}
				</div>
				<div class="mt-1 rounded-md border border-border bg-muted px-3 py-2 text-sm">
					€{data.organization.platform_fee_fixed}
				</div>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['orgAdmin.settings.platformFees.fixedHelp']()}
				</p>
			</div>
		</div>

		<p class="mt-4 text-xs text-muted-foreground">
			{m['orgAdmin.settings.platformFees.contactSupport']()}
		</p>
	</section>

	<!-- Stripe Connect Section -->
	<StripeConnect
		organizationSlug={data.organization.slug}
		stripeChargesEnabled={data.organization.stripe_charges_enabled}
		stripeDetailsSubmitted={data.organization.stripe_details_submitted}
		stripeAccountId={data.organization.stripe_account_id ?? null}
		stripeAccountEmail={data.organization.stripe_account_email ?? null}
		accessToken={accessToken || ''}
	/>

	<!-- Images Section (Outside Form) -->
	<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
		<h2 class="text-lg font-semibold">{m['orgAdmin.settings.branding.heading']()}</h2>

		{#if uploadError}
			<div
				class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
				role="alert"
			>
				<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
				<p class="text-sm font-medium">{uploadError}</p>
			</div>
		{/if}

		<!-- Logo -->
		<div>
			<ImageUploader
				value={logoFile}
				preview={logoUrl}
				label={m['orgAdmin.settings.branding.logoLabel']()}
				accept="image/*"
				maxSize={5 * 1024 * 1024}
				aspectRatio="square"
				disabled={uploadingLogo}
				onFileSelect={(file) => {
					if (file) {
						handleLogoFileSelect(file);
					} else {
						handleRemoveLogo();
					}
				}}
			/>
			<p class="mt-1 text-xs text-muted-foreground">{m['orgAdmin.settings.branding.logoHelp']()}</p>
		</div>

		<!-- Cover Art -->
		<div>
			<ImageUploader
				value={coverFile}
				preview={coverUrl}
				label={m['orgAdmin.settings.branding.coverLabel']()}
				accept="image/*"
				maxSize={10 * 1024 * 1024}
				disabled={uploadingCover}
				onFileSelect={(file) => {
					if (file) {
						handleCoverFileSelect(file);
					} else {
						handleRemoveCover();
					}
				}}
			/>
			<p class="mt-1 text-xs text-muted-foreground">
				{m['orgAdmin.settings.branding.coverHelp']()}
			</p>
		</div>
	</section>

	<form
		method="POST"
		use:enhance={() => {
			isSubmitting = true;
			return async ({ update }) => {
				// Process image changes (upload new files, delete removed files)
				await processImageChanges();

				// Submit form data (description, address, city, visibility)
				await update();
				isSubmitting = false;
			};
		}}
		class="space-y-8"
	>
		<!-- Profile Information -->
		<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
			<h2 class="text-lg font-semibold">{m['orgAdmin.settings.profile.heading']()}</h2>

			<!-- Description -->
			<div>
				<MarkdownEditor
					bind:value={description}
					label={m['orgAdmin.settings.profile.descriptionLabel']()}
					placeholder={m['orgAdmin.settings.profile.descriptionPlaceholder']()}
					rows={8}
				/>
				<input type="hidden" name="description" value={description} />
			</div>

			<!-- City -->
			<div>
				<CityAutocomplete
					value={selectedCity}
					onSelect={handleCitySelect}
					label={m['orgAdmin.settings.profile.cityLabel']()}
					description=""
				/>
				<input type="hidden" name="city_id" value={selectedCity?.id || ''} />
			</div>

			<!-- Address -->
			<div>
				<label for="address" class="block text-sm font-medium">
					{m['orgAdmin.settings.profile.addressLabel']()}
					<span class="text-muted-foreground"
						>{m['orgAdmin.settings.profile.addressOptional']()}</span
					>
				</label>
				<input
					type="text"
					id="address"
					name="address"
					bind:value={address}
					placeholder={m['orgAdmin.settings.profile.addressPlaceholder']()}
					class="mt-1 flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				/>
			</div>

			<!-- Visibility -->
			<div>
				<label for="visibility" class="block text-sm font-medium"
					>{m['orgAdmin.settings.profile.visibilityLabel']()}</label
				>
				<select
					id="visibility"
					name="visibility"
					bind:value={visibility}
					class="mt-1 flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				>
					<option value="public">{m['orgAdmin.settings.profile.visibilityPublic']()}</option>
					<option value="members-only"
						>{m['orgAdmin.settings.profile.visibilityMembersOnly']()}</option
					>
					<option value="staff-only">{m['orgAdmin.settings.profile.visibilityStaffOnly']()}</option>
				</select>
				<p class="mt-1 text-xs text-muted-foreground">
					{#if visibility === 'public'}
						{m['orgAdmin.settings.profile.visibilityPublicHelp']()}
					{:else if visibility === 'members-only'}
						{m['orgAdmin.settings.profile.visibilityMembersOnlyHelp']()}
					{:else if visibility === 'staff-only'}
						{m['orgAdmin.settings.profile.visibilityStaffOnlyHelp']()}
					{/if}
				</p>
			</div>

			<!-- Tags -->
			<div class="space-y-2">
				<label for="tags-input" class="block text-sm font-medium">
					<span class="flex items-center gap-2">
						<Hash class="h-4 w-4" aria-hidden="true" />
						Tags
					</span>
				</label>
				<div class="flex gap-2">
					<div class="relative flex-1">
						<input
							id="tags-input"
							type="text"
							value={tagInput}
							oninput={handleTagInput}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									addTag();
								}
							}}
							onfocus={() => {
								if (tagInput.trim() && tagSuggestions.length > 0) {
									showTagSuggestions = true;
								}
							}}
							onblur={() => {
								setTimeout(() => {
									showTagSuggestions = false;
								}, 200);
							}}
							placeholder="Add tags..."
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
							autocomplete="off"
						/>

						{#if showTagSuggestions && tagSuggestions.length > 0}
							<div
								class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-popover text-popover-foreground shadow-md"
							>
								{#each tagSuggestions as suggestion}
									<button
										type="button"
										onclick={() => addTag(suggestion)}
										class="flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
									>
										<Hash class="mr-2 h-3 w-3" aria-hidden="true" />
										{suggestion}
									</button>
								{/each}
							</div>
						{/if}

						{#if isLoadingTagSuggestions}
							<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
								<svg
									class="h-4 w-4 animate-spin text-muted-foreground"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									/>
									<path
										class="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									/>
								</svg>
							</div>
						{/if}
					</div>
					<button
						type="button"
						onclick={() => addTag()}
						class="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						Add
					</button>
				</div>
				{#if tags.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each tags as tag}
							<span class="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
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
		</section>

		<!-- Social Media Links -->
		<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
			<h2 class="text-lg font-semibold">{m['orgAdmin.settings.social.heading']()}</h2>
			<p class="text-sm text-muted-foreground">{m['orgAdmin.settings.social.description']()}</p>

			<div class="grid gap-4 md:grid-cols-2">
				<!-- Instagram -->
				<div>
					<label for="instagram_url" class="flex items-center gap-2 text-sm font-medium">
						<Instagram class="h-4 w-4 text-pink-500" aria-hidden="true" />
						Instagram
					</label>
					<input
						type="url"
						id="instagram_url"
						name="instagram_url"
						bind:value={instagramUrl}
						placeholder="https://instagram.com/yourorg"
						class="mt-1 flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>

				<!-- Facebook -->
				<div>
					<label for="facebook_url" class="flex items-center gap-2 text-sm font-medium">
						<Facebook class="h-4 w-4 text-blue-600" aria-hidden="true" />
						Facebook
					</label>
					<input
						type="url"
						id="facebook_url"
						name="facebook_url"
						bind:value={facebookUrl}
						placeholder="https://facebook.com/yourorg"
						class="mt-1 flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>

				<!-- Bluesky -->
				<div>
					<label for="bluesky_url" class="flex items-center gap-2 text-sm font-medium">
						<AtSign class="h-4 w-4 text-sky-500" aria-hidden="true" />
						Bluesky
					</label>
					<input
						type="url"
						id="bluesky_url"
						name="bluesky_url"
						bind:value={blueskyUrl}
						placeholder="https://bsky.app/profile/yourorg.bsky.social"
						class="mt-1 flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>

				<!-- Telegram -->
				<div>
					<label for="telegram_url" class="flex items-center gap-2 text-sm font-medium">
						<Send class="h-4 w-4 text-blue-400" aria-hidden="true" />
						Telegram
					</label>
					<input
						type="url"
						id="telegram_url"
						name="telegram_url"
						bind:value={telegramUrl}
						placeholder="https://t.me/yourorg"
						class="mt-1 flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>
			</div>
		</section>

		<!-- Membership Settings -->
		<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
			<h2 class="text-lg font-semibold">{m['orgAdmin.settings.membership.heading']()}</h2>

			<!-- Accept New Members -->
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<input
						type="checkbox"
						id="accept_membership_requests"
						name="accept_membership_requests"
						value="true"
						bind:checked={acceptNewMembers}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<label for="accept_membership_requests" class="text-sm font-medium">
						{m['orgAdmin.settings.membership.acceptRequestsLabel']()}
					</label>
				</div>
				<p class="text-xs text-muted-foreground">
					{m['orgAdmin.settings.membership.acceptRequestsHelp']()}
				</p>
			</div>

			<!-- Contact Email (Read-only with Change Button) -->
			<div>
				<label class="block text-sm font-medium">
					{m['orgAdmin.settings.membership.contactEmailLabel']()}
				</label>
				<div class="mt-1 flex items-center gap-2">
					<div
						class="flex-1 rounded-md border-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
					>
						{data.organization.contact_email || 'No contact email set'}
					</div>
					<button
						type="button"
						onclick={() => {
							showEmailModal = true;
							newEmail = data.organization.contact_email || '';
							emailUpdateError = null;
							emailSent = false;
						}}
						class="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
					>
						<Mail class="h-4 w-4" aria-hidden="true" />
						Change
					</button>
				</div>
				{#if data.organization.contact_email_verified}
					<p class="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
						<Check class="h-3 w-3" aria-hidden="true" />
						{m['orgAdmin.settings.membership.emailVerified']()}
					</p>
				{:else if data.organization.contact_email}
					<p class="mt-1 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
						<AlertCircle class="h-3 w-3" aria-hidden="true" />
						{m['orgAdmin.settings.membership.emailNotVerified']()}
					</p>
				{/if}
				<p class="mt-1 text-xs text-muted-foreground">
					{m['orgAdmin.settings.membership.contactEmailHelp']()}
				</p>
			</div>
		</section>

		<!-- Actions -->
		<div class="flex items-center justify-end gap-3">
			<a
				href="/org/{data.organization.slug}/admin"
				class="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				{m['orgAdmin.settings.actions.cancel']()}
			</a>
			<button
				type="submit"
				disabled={isSubmitting}
				class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isSubmitting}
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
						aria-hidden="true"
					></div>
					{m['orgAdmin.settings.actions.saving']()}
				{:else}
					{m['orgAdmin.settings.actions.saveChanges']()}
				{/if}
			</button>
		</div>
	</form>
</div>

<!-- Email Change Modal -->
{#if showEmailModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget && !isUpdatingEmail) {
				showEmailModal = false;
			}
		}}
		role="dialog"
		aria-modal="true"
		aria-labelledby="email-modal-title"
	>
		<div class="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
			<div class="mb-4 flex items-start justify-between">
				<h3 id="email-modal-title" class="text-lg font-semibold">Change Contact Email</h3>
				<button
					type="button"
					onclick={() => (showEmailModal = false)}
					disabled={isUpdatingEmail}
					class="rounded-md p-1 hover:bg-accent"
					aria-label="Close"
				>
					<X class="h-5 w-5" aria-hidden="true" />
				</button>
			</div>

			{#if emailSent}
				<!-- Success state -->
				<div class="space-y-4">
					<div class="rounded-md bg-green-50 p-4 dark:bg-green-950">
						<div class="flex gap-3">
							<Check
								class="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400"
								aria-hidden="true"
							/>
							<div>
								<h4 class="font-medium text-green-900 dark:text-green-100">
									Verification Email Sent
								</h4>
								<p class="mt-1 text-sm text-green-800 dark:text-green-200">
									We've sent a verification link to <strong>{newEmail}</strong>. Please check your
									inbox and click the link to verify your new contact email.
								</p>
							</div>
						</div>
					</div>
					<div class="flex justify-end gap-2">
						<button
							type="button"
							onclick={handleEmailUpdate}
							disabled={isUpdatingEmail}
							class="rounded-md px-4 py-2 text-sm font-medium text-primary hover:bg-accent"
						>
							Resend Email
						</button>
						<button
							type="button"
							onclick={() => {
								showEmailModal = false;
								newEmail = '';
								emailSent = false;
							}}
							class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
						>
							Done
						</button>
					</div>
				</div>
			{:else}
				<!-- Input form -->
				<div class="space-y-4">
					<div>
						<label for="new-email" class="block text-sm font-medium"> New Contact Email </label>
						<input
							id="new-email"
							type="email"
							bind:value={newEmail}
							disabled={isUpdatingEmail}
							placeholder="organization@example.com"
							class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800"
						/>
						<p class="mt-1 text-xs text-muted-foreground">
							If this email is different from your account email, a verification email will be sent.
						</p>
					</div>

					{#if emailUpdateError}
						<div class="rounded-md bg-red-50 p-3 dark:bg-red-950">
							<div class="flex gap-2">
								<AlertCircle
									class="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
									aria-hidden="true"
								/>
								<p class="text-sm text-red-800 dark:text-red-200">
									{emailUpdateError}
								</p>
							</div>
						</div>
					{/if}

					<div class="flex justify-end gap-2">
						<button
							type="button"
							onclick={() => {
								showEmailModal = false;
								newEmail = '';
							}}
							disabled={isUpdatingEmail}
							class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
						>
							Cancel
						</button>
						<button
							type="button"
							onclick={handleEmailUpdate}
							disabled={isUpdatingEmail || !newEmail.trim()}
							class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>
							{#if isUpdatingEmail}
								<div
									class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
									aria-hidden="true"
								></div>
								Updating...
							{:else}
								Update Email
							{/if}
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Ensure consistent focus states for accessibility */
	:global(button:focus-visible),
	:global(a:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
