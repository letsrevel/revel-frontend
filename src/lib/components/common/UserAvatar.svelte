<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { getBackendUrl } from '$lib/config/api';

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
	 * @example
	 * ```svelte
	 * <UserAvatar
	 *   profilePictureUrl={user.profile_picture_url}
	 *   thumbnailUrl={user.profile_picture_thumbnail_url}
	 *   displayName={user.display_name}
	 *   firstName={user.first_name}
	 *   lastName={user.last_name}
	 *   size="md"
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
	}

	let {
		profilePictureUrl = null,
		thumbnailUrl = null,
		displayName,
		firstName = '',
		lastName = '',
		size = 'md',
		class: className
	}: Props = $props();

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
</script>

{#if fullPictureUrl}
	<img
		src={fullPictureUrl}
		alt={altText}
		class={cn('rounded-full object-cover', sizeClasses[size], className)}
	/>
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
