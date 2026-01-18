<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import { accountUploadProfilePicture, accountDeleteProfilePicture } from '$lib/api/generated';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import { Upload, Trash2, Loader2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	/**
	 * ProfilePictureUploader Component
	 *
	 * Allows users to upload, preview, and delete their profile picture.
	 * Uploads are sent immediately to the server.
	 *
	 * @example
	 * ```svelte
	 * <ProfilePictureUploader
	 *   currentPictureUrl={user.profile_picture_url}
	 *   displayName={user.display_name}
	 *   firstName={user.first_name}
	 *   lastName={user.last_name}
	 *   accessToken={accessToken}
	 *   onUpdate={(newUrl) => user.profile_picture_url = newUrl}
	 * />
	 * ```
	 */
	interface Props {
		/** Current profile picture URL (null if none) */
		currentPictureUrl: string | null;
		/** User's display name (for avatar fallback) */
		displayName: string;
		/** User's first name (for avatar initials) */
		firstName?: string;
		/** User's last name (for avatar initials) */
		lastName?: string;
		/** Access token for API calls */
		accessToken: string;
		/** Callback when profile picture is updated */
		onUpdate?: (newUrl: string | null) => void;
		/** Additional CSS classes */
		class?: string;
	}

	let {
		currentPictureUrl,
		displayName,
		firstName = '',
		lastName = '',
		accessToken,
		onUpdate,
		class: className
	}: Props = $props();

	let isUploading = $state(false);
	let isDeleting = $state(false);
	let showDeleteConfirm = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let error = $state<string | null>(null);

	// Maximum file size (10MB)
	const MAX_FILE_SIZE = 10 * 1024 * 1024;
	const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function validateFile(file: File): string | null {
		if (!ACCEPTED_TYPES.includes(file.type)) {
			return m['profilePage.profilePicture_invalidFormat']();
		}
		if (file.size > MAX_FILE_SIZE) {
			return m['profilePage.profilePicture_tooLarge']({ size: formatFileSize(MAX_FILE_SIZE) });
		}
		return null;
	}

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		error = null;
		const validationError = validateFile(file);
		if (validationError) {
			error = validationError;
			return;
		}

		isUploading = true;
		try {
			const response = await accountUploadProfilePicture({
				headers: {
					Authorization: `Bearer ${accessToken}`
				},
				body: {
					profile_picture: file
				}
			});

			if (response.data) {
				const newUrl = response.data.profile_picture_url ?? null;
				onUpdate?.(newUrl);
				toast.success(m['profilePage.profilePicture_uploadSuccess']());
			}
		} catch (err) {
			console.error('Failed to upload profile picture:', err);
			error = m['profilePage.profilePicture_uploadError']();
			toast.error(error);
		} finally {
			isUploading = false;
			// Reset file input
			if (fileInput) {
				fileInput.value = '';
			}
		}
	}

	async function handleDelete() {
		if (!showDeleteConfirm) {
			showDeleteConfirm = true;
			return;
		}

		isDeleting = true;
		try {
			await accountDeleteProfilePicture({
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			onUpdate?.(null);
			toast.success(m['profilePage.profilePicture_deleteSuccess']());
		} catch (err) {
			console.error('Failed to delete profile picture:', err);
			toast.error(m['profilePage.profilePicture_deleteError']());
		} finally {
			isDeleting = false;
			showDeleteConfirm = false;
		}
	}

	function cancelDelete() {
		showDeleteConfirm = false;
	}

	function triggerFileInput() {
		fileInput?.click();
	}
</script>

<div class={cn('space-y-4', className)}>
	<span
		class="block text-sm font-medium text-gray-900 dark:text-gray-100"
		id="profile-picture-label"
	>
		{m['profilePage.profilePicture_label']()}
	</span>

	<div class="flex items-center gap-6">
		<!-- Avatar Preview -->
		<UserAvatar
			profilePictureUrl={currentPictureUrl}
			{displayName}
			{firstName}
			{lastName}
			size="xl"
		/>

		<!-- Actions -->
		<div class="flex flex-col gap-2">
			<!-- Upload Button -->
			<button
				type="button"
				onclick={triggerFileInput}
				disabled={isUploading || isDeleting}
				class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isUploading}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					<span>{m['profilePage.profilePicture_uploading']()}</span>
				{:else}
					<Upload class="h-4 w-4" aria-hidden="true" />
					<span>{m['profilePage.profilePicture_upload']()}</span>
				{/if}
			</button>

			<!-- Delete Button (only show if there's a picture) -->
			{#if currentPictureUrl}
				{#if showDeleteConfirm}
					<div class="flex gap-2">
						<button
							type="button"
							onclick={handleDelete}
							disabled={isDeleting}
							class="inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if isDeleting}
								<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
								<span>{m['profilePage.profilePicture_deleting']()}</span>
							{:else}
								<span>{m['profilePage.profilePicture_confirm']()}</span>
							{/if}
						</button>
						<button
							type="button"
							onclick={cancelDelete}
							disabled={isDeleting}
							class="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{m['profilePage.profilePicture_cancel']()}
						</button>
					</div>
				{:else}
					<button
						type="button"
						onclick={handleDelete}
						disabled={isUploading || isDeleting}
						class="inline-flex items-center gap-2 rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Trash2 class="h-4 w-4" aria-hidden="true" />
						<span>{m['profilePage.profilePicture_remove']()}</span>
					</button>
				{/if}
			{/if}

			<!-- File size hint -->
			<p class="text-xs text-muted-foreground">
				{m['profilePage.profilePicture_hint']()}
			</p>
		</div>
	</div>

	<!-- Hidden file input -->
	<input
		bind:this={fileInput}
		type="file"
		id="profile-picture-input"
		accept={ACCEPTED_TYPES.join(',')}
		onchange={handleFileSelect}
		class="sr-only"
		aria-labelledby="profile-picture-label"
	/>

	<!-- Error message -->
	{#if error}
		<p class="text-sm text-destructive" role="alert">
			{error}
		</p>
	{/if}
</div>
