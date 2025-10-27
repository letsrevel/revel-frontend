<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import CityAutocomplete from '$lib/components/forms/CityAutocomplete.svelte';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import ImageUploader from '$lib/components/forms/ImageUploader.svelte';
	import StripeConnect from '$lib/components/organization/StripeConnect.svelte';
	import type { CitySchema } from '$lib/api/generated';
	import { Building2, AlertCircle, Check, Eye } from 'lucide-svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import {
		organizationadminUploadLogo,
		organizationadminUploadCoverArt,
		organizationadminDeleteLogo,
		organizationadminDeleteCoverArt
	} from '$lib/api/generated/sdk.gen';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	// Backend URL for image previews
	const BACKEND_URL = 'http://localhost:8000';

	// Form state - always sync with latest data
	let description = $state(data.organization.description || '');
	let address = $state(data.organization.address || '');
	let selectedCity = $state<CitySchema | null>(data.organization.city || null);
	let visibility = $state(data.organization.visibility || 'public');
	let acceptNewMembers = $state(data.organization.accept_membership_requests || false);
	let contactEmail = $state(data.organization.contact_email || '');
	let isSubmitting = $state(false);

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
		contactEmail = data.organization.contact_email || '';
	});

	// Handle city selection
	function handleCitySelect(city: CitySchema | null) {
		selectedCity = city;
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
	}
</script>

<svelte:head>
	<title>Settings - {data.organization.name} Admin | Revel</title>
	<meta name="description" content="Manage your organization settings" />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6 px-4 md:px-0">
	<!-- Header with Public Profile Button -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">Organization Settings</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Manage your organization's profile and preferences
			</p>
		</div>

		<a
			href="/org/{data.organization.slug}"
			target="_blank"
			rel="noopener noreferrer"
			class="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			<Eye class="h-4 w-4" aria-hidden="true" />
			View Public Profile
		</a>
	</div>

	<!-- Success Message -->
	{#if form?.success}
		<div
			class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
			role="alert"
		>
			<Check class="h-5 w-5 shrink-0" aria-hidden="true" />
			<p class="text-sm font-medium">Your organization settings have been updated successfully.</p>
		</div>
	{/if}

	<!-- Error Message -->
	{#if form?.errors?.form}
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
			<h2 class="text-lg font-semibold">Organization Identity</h2>
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<!-- Name (Read-only) -->
			<div>
				<div class="block text-sm font-medium text-muted-foreground">Organization Name</div>
				<div class="mt-1 rounded-md border border-border bg-muted px-3 py-2 text-sm">
					{data.organization.name}
				</div>
				<p class="mt-1 text-xs text-muted-foreground">
					Contact support to change your organization name
				</p>
			</div>

			<!-- Slug (Read-only) -->
			<div>
				<div class="block text-sm font-medium text-muted-foreground">URL Slug</div>
				<div class="mt-1 rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">
					{data.organization.slug}
				</div>
				<p class="mt-1 text-xs text-muted-foreground">Contact support to change your URL slug</p>
			</div>
		</div>
	</section>

	<!-- Platform Fees (Read-only) -->
	<section class="rounded-lg border border-border bg-card p-6 shadow-sm">
		<div class="mb-4 flex items-center gap-2">
			<Building2 class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
			<h2 class="text-lg font-semibold">Platform Fees</h2>
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<!-- Platform Fee Percent -->
			<div>
				<div class="block text-sm font-medium text-muted-foreground">Platform Fee (Percent)</div>
				<div class="mt-1 rounded-md border border-border bg-muted px-3 py-2 text-sm">
					{data.organization.platform_fee_percent}%
				</div>
				<p class="mt-1 text-xs text-muted-foreground">Percentage fee applied to ticket sales</p>
			</div>

			<!-- Platform Fee Fixed -->
			<div>
				<div class="block text-sm font-medium text-muted-foreground">Platform Fee (Fixed)</div>
				<div class="mt-1 rounded-md border border-border bg-muted px-3 py-2 text-sm">
					€{data.organization.platform_fee_fixed}
				</div>
				<p class="mt-1 text-xs text-muted-foreground">Fixed fee per ticket sold</p>
			</div>
		</div>

		<p class="mt-4 text-xs text-muted-foreground">
			Contact support to modify platform fee settings
		</p>
	</section>

	<!-- Stripe Connect Section -->
	<StripeConnect
		organizationSlug={data.organization.slug}
		stripeChargesEnabled={data.organization.stripe_charges_enabled}
		stripeDetailsSubmitted={data.organization.stripe_details_submitted}
		stripeAccountId={data.organization.stripe_account_id}
		accessToken={accessToken || ''}
	/>

	<!-- Images Section (Outside Form) -->
	<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
		<h2 class="text-lg font-semibold">Branding</h2>

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
				label="Organization Logo"
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
			<p class="mt-1 text-xs text-muted-foreground">Square (400×400px recommended)</p>
		</div>

		<!-- Cover Art -->
		<div>
			<ImageUploader
				value={coverFile}
				preview={coverUrl}
				label="Cover Image"
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
			<p class="mt-1 text-xs text-muted-foreground">Wide (1200×400px recommended)</p>
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
			<h2 class="text-lg font-semibold">Profile Information</h2>

			<!-- Description -->
			<div>
				<MarkdownEditor
					bind:value={description}
					label="Description"
					placeholder="Tell people about your organization..."
					rows={8}
				/>
				<input type="hidden" name="description" value={description} />
			</div>

			<!-- City -->
			<div>
				<CityAutocomplete value={selectedCity} onSelect={handleCitySelect} label="City" />
				<input type="hidden" name="city_id" value={selectedCity?.id || ''} />
			</div>

			<!-- Address -->
			<div>
				<label for="address" class="block text-sm font-medium">
					Address
					<span class="text-muted-foreground">(Optional)</span>
				</label>
				<input
					type="text"
					id="address"
					name="address"
					bind:value={address}
					placeholder="123 Main St, City, State 12345"
					class="mt-1 flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				/>
			</div>

			<!-- Visibility -->
			<div>
				<label for="visibility" class="block text-sm font-medium">Visibility</label>
				<select
					id="visibility"
					name="visibility"
					bind:value={visibility}
					class="mt-1 flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				>
					<option value="public">Public - Anyone can view</option>
					<option value="members-only">Members Only - Only organization members can view</option>
					<option value="staff-only">Staff Only - Only staff members can view</option>
				</select>
				<p class="mt-1 text-xs text-muted-foreground">
					{#if visibility === 'public'}
						Your organization profile is visible to everyone
					{:else if visibility === 'members-only'}
						Your organization profile is only visible to members
					{:else if visibility === 'staff-only'}
						Your organization profile is only visible to staff
					{/if}
				</p>
			</div>
		</section>

		<!-- Membership Settings -->
		<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
			<h2 class="text-lg font-semibold">Membership Settings</h2>

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
						Accept membership requests
					</label>
				</div>
				<p class="text-xs text-muted-foreground">
					When enabled, users can submit requests to become members of your organization. Members
					may have access to members-only events and content.
				</p>
			</div>

			<!-- Contact Email -->
			<div>
				<label for="contact_email" class="block text-sm font-medium">
					Contact Email
					<span class="text-muted-foreground">(Optional)</span>
				</label>
				<input
					type="email"
					id="contact_email"
					name="contact_email"
					bind:value={contactEmail}
					placeholder="contact@yourorganization.com"
					class="mt-1 flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				/>
				{#if data.organization.contact_email_verified}
					<p class="mt-1 text-xs text-green-600 dark:text-green-400">✓ Email verified</p>
				{:else if contactEmail}
					<p class="mt-1 text-xs text-muted-foreground">Email not yet verified</p>
				{/if}
				<p class="mt-1 text-xs text-muted-foreground">
					Public contact email for inquiries about your organization
				</p>
			</div>
		</section>

		<!-- Actions -->
		<div class="flex items-center justify-end gap-3">
			<a
				href="/org/{data.organization.slug}/admin"
				class="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				Cancel
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
					Saving...
				{:else}
					Save Changes
				{/if}
			</button>
		</div>
	</form>
</div>

<style>
	/* Ensure consistent focus states for accessibility */
	:global(button:focus-visible),
	:global(a:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
