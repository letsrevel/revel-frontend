<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { AlertCircle } from 'lucide-svelte';
	import ImageUploader from '$lib/components/forms/ImageUploader.svelte';
	import { getBackendUrl } from '$lib/config/api';
	import {
		organizationadmincoreUploadLogo,
		organizationadmincoreUploadCoverArt,
		organizationadmincoreDeleteLogo,
		organizationadmincoreDeleteCoverArt
	} from '$lib/api/generated/sdk.gen';

	interface Props {
		slug: string;
		logoPath: string | null | undefined;
		coverArtPath: string | null | undefined;
		accessToken: string | null;
		onRegisterSave?: (saveFn: () => Promise<void>) => void;
	}

	const { slug, logoPath, coverArtPath, accessToken, onRegisterSave }: Props = $props();

	// Image upload state
	let logoFile = $state<File | null>(null);
	let coverFile = $state<File | null>(null);
	let uploadingLogo = $state(false);
	let uploadingCover = $state(false);
	let uploadError = $state<string | null>(null);
	let lastUploadedLogoName = $state<string | null>(null);
	let lastUploadedCoverName = $state<string | null>(null);

	// Track if user wants to delete images
	let shouldDeleteLogo = $state(false);
	let shouldDeleteCover = $state(false);

	// Helper function to get full image URL
	function getImageUrl(path: string | null | undefined): string | null {
		if (!path) return null;
		return getBackendUrl(path);
	}

	// Computed full URLs for images (hide if marked for deletion)
	const logoUrl = $derived(shouldDeleteLogo ? null : getImageUrl(logoPath));
	const coverUrl = $derived(shouldDeleteCover ? null : getImageUrl(coverArtPath));

	// Upload logo
	async function uploadLogo(): Promise<void> {
		if (!logoFile || !accessToken) return;

		uploadingLogo = true;
		uploadError = null;

		try {
			const response = await organizationadmincoreUploadLogo({
				path: { slug },
				body: { logo: logoFile },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

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

			window.location.reload();
		} catch (err) {
			console.error('[LOGO UPLOAD] Error:', err);
			uploadError = err instanceof Error ? err.message : 'Failed to upload logo';
			uploadingLogo = false;
		}
	}

	// Upload cover art
	async function uploadCover(): Promise<void> {
		if (!coverFile || !accessToken) return;

		uploadingCover = true;
		uploadError = null;

		try {
			const response = await organizationadmincoreUploadCoverArt({
				path: { slug },
				body: { cover_art: coverFile },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

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

			window.location.reload();
		} catch (err) {
			console.error('[COVER UPLOAD] Error:', err);
			uploadError = err instanceof Error ? err.message : 'Failed to upload cover art';
			uploadingCover = false;
		}
	}

	// Handle logo file selection
	function handleLogoFileSelect(file: File | null): void {
		logoFile = file;
		if (file) {
			shouldDeleteLogo = false;
		}
	}

	// Handle cover file selection
	function handleCoverFileSelect(file: File | null): void {
		coverFile = file;
		if (file) {
			shouldDeleteCover = false;
		}
	}

	// Handle logo removal
	function handleRemoveLogo(): void {
		logoFile = null;
		shouldDeleteLogo = true;
	}

	// Handle cover removal
	function handleRemoveCover(): void {
		coverFile = null;
		shouldDeleteCover = true;
	}

	/**
	 * Process image uploads and deletions.
	 * Called by the parent form on submission via registered callback.
	 */
	async function processImageChanges(): Promise<void> {
		if (!accessToken) return;

		// Upload logo if a new file was selected
		if (logoFile && logoFile.name !== lastUploadedLogoName) {
			await uploadLogo();
			lastUploadedLogoName = logoFile.name;
		}

		// Upload cover if a new file was selected
		if (coverFile && coverFile.name !== lastUploadedCoverName) {
			await uploadCover();
			lastUploadedCoverName = coverFile.name;
		}

		// Delete logo if marked for deletion
		if (shouldDeleteLogo && logoPath) {
			const response = await organizationadmincoreDeleteLogo({
				path: { slug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				console.error('[LOGO] Delete failed:', response.error);
			} else {
				shouldDeleteLogo = false;
			}
		}

		// Delete cover if marked for deletion
		if (shouldDeleteCover && coverArtPath) {
			const response = await organizationadmincoreDeleteCoverArt({
				path: { slug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				console.error('[COVER] Delete failed:', response.error);
			} else {
				shouldDeleteCover = false;
			}
		}
	}

	// Register the save function with the parent
	$effect(() => {
		onRegisterSave?.(processImageChanges);
	});
</script>

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
