<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { getBackendUrl } from '$lib/config/api';
	import * as Dialog from '$lib/components/ui/dialog';
	import { X } from 'lucide-svelte';

	/**
	 * UserAvatar Component
	 *
	 * Displays a user's profile picture or initials fallback.
	 * Used consistently across the app wherever user info is displayed.
	 *
	 * For performance, pass both `profilePictureUrl` and `thumbnailUrl`:
	 * - Small sizes (xs, sm, md) will automatically use the thumbnail
	 * - Large sizes (lg, xl) will use the full picture
	 *
	 * Set `clickable={true}` to enable click-to-expand functionality.
	 *
	 * @example
	 * ```svelte
	 * <UserAvatar
	 *   profilePictureUrl={user.profile_picture_url}
	 *   thumbnailUrl={user.profile_picture_thumbnail_url}
	 *   displayName={user.display_name}
	 *   firstName={user.first_name}
	 *   lastName={user.last_name}
	 *   size="md"
	 *   clickable={true}
	 * />
	 * ```
	 */
	interface Props {
		/** URL to the full-size profile picture (null if none) */
		profilePictureUrl?: string | null;
		/** URL to the thumbnail version for better performance in lists (null if none) */
		thumbnailUrl?: string | null;
		/** Display name for the user (used for alt text and initials fallback) */
		displayName: string;
		/** First name (used for initials) */
		firstName?: string | null;
		/** Last name (used for initials) */
		lastName?: string | null;
		/** Size of the avatar */
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		/** Additional CSS classes */
		class?: string;
		/** Enable click-to-expand functionality (only works if there's a profile picture) */
		clickable?: boolean;
	}

	let {
		profilePictureUrl = null,
		thumbnailUrl = null,
		displayName,
		firstName = '',
		lastName = '',
		size = 'md',
		class: className,
		clickable = false
	}: Props = $props();

	// Dialog state for expanded view
	let isDialogOpen = $state(false);

	// Compute initials from first/last name or display name
	const initials = $derived.by(() => {
		const first = firstName?.[0] || '';
		const last = lastName?.[0] || '';
		if (first || last) {
			return (first + last).toUpperCase();
		}
		// Fallback to first character of display name
		return displayName?.[0]?.toUpperCase() || '?';
	});

	// Size classes for the container
	const sizeClasses = {
		xs: 'h-6 w-6 text-xs',
		sm: 'h-8 w-8 text-sm',
		md: 'h-10 w-10 text-sm',
		lg: 'h-12 w-12 text-base',
		xl: 'h-16 w-16 text-lg'
	} as const;

	// Get the alt text for the image
	const altText = $derived(`${displayName}'s avatar`);

	// Select the best image URL based on size
	// Small sizes (xs, sm, md) use thumbnail if available for better performance
	// Large sizes (lg, xl) use the full picture
	const selectedUrl = $derived.by(() => {
		const useSmallImage = size === 'xs' || size === 'sm' || size === 'md';
		if (useSmallImage && thumbnailUrl) {
			return thumbnailUrl;
		}
		return profilePictureUrl;
	});

	// Get the full URL for the profile picture (handles relative URLs from backend)
	const fullPictureUrl = $derived(selectedUrl ? getBackendUrl(selectedUrl) : null);

	// Get the full-size URL for the expanded dialog (always use full picture, not thumbnail)
	const fullSizePictureUrl = $derived(profilePictureUrl ? getBackendUrl(profilePictureUrl) : null);

	// Determine if avatar should be clickable (only if there's a picture and clickable is true)
	const isClickable = $derived(clickable && fullPictureUrl);

	function handleClick() {
		if (isClickable) {
			isDialogOpen = true;
		}
	}
</script>

{#if fullPictureUrl}
	{#if isClickable}
		<button
			type="button"
			onclick={handleClick}
			class={cn(
				'rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
				'cursor-pointer transition-opacity hover:opacity-80'
			)}
			aria-label="View {displayName}'s profile picture"
		>
			<img
				src={fullPictureUrl}
				alt={altText}
				class={cn('rounded-full object-cover', sizeClasses[size], className)}
			/>
		</button>
	{:else}
		<img
			src={fullPictureUrl}
			alt={altText}
			class={cn('rounded-full object-cover', sizeClasses[size], className)}
		/>
	{/if}
{:else}
	<div
		class={cn(
			'flex items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground',
			sizeClasses[size],
			className
		)}
		aria-label={altText}
		role="img"
	>
		{initials}
	</div>
{/if}

<!-- Expanded image dialog -->
{#if clickable && fullSizePictureUrl}
	<Dialog.Root bind:open={isDialogOpen}>
		<Dialog.Content class="max-w-md border-0 bg-transparent p-0 shadow-none sm:max-w-lg">
			<Dialog.Title class="sr-only">{displayName}'s profile picture</Dialog.Title>
			<Dialog.Description class="sr-only">Enlarged view of profile picture</Dialog.Description>
			<div class="relative">
				<img
					src={fullSizePictureUrl}
					alt={altText}
					class="max-h-[80vh] w-full rounded-lg object-contain"
				/>
				<button
					type="button"
					onclick={() => (isDialogOpen = false)}
					class="absolute right-2 top-2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
					aria-label="Close"
				>
					<X class="h-5 w-5" />
				</button>
			</div>
		</Dialog.Content>
	</Dialog.Root>
{/if}
