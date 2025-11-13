<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { notificationUnreadCount } from '$lib/api/generated';
	import { cn } from '$lib/utils/cn';

	interface Props {
		authToken: string;
		pollingInterval?: number;
		onCountChange?: (count: number) => void;
		showZero?: boolean;
		maxCount?: number;
		class?: string;
	}

	let {
		authToken,
		pollingInterval = 60000,
		onCountChange,
		showZero = false,
		maxCount = 99,
		class: className
	}: Props = $props();

	// Track previous count for animation trigger
	let previousCount = $state(0);
	let shouldAnimate = $state(false);

	// Determine if polling should be active based on document visibility
	let isVisible = $state(true);

	// Query for unread count with polling
	let unreadQuery = createQuery(() => ({
		queryKey: ['notifications', 'unread-count'],
		queryFn: async () => {
			return await notificationUnreadCount({
				headers: { Authorization: `Bearer ${authToken}` }
			});
		},
		refetchInterval: isVisible ? pollingInterval : false,
		refetchIntervalInBackground: false,
		staleTime: pollingInterval - 1000, // Consider data stale slightly before next poll
		retry: 1, // Only retry once on failure
		enabled: !!authToken // Only run if we have an auth token
	}));

	// Derived values
	let count = $derived(unreadQuery.data?.data?.count ?? 0);
	let isLoading = $derived(unreadQuery.isLoading);
	let isError = $derived(unreadQuery.isError);
	let shouldShowBadge = $derived((count > 0 || showZero) && !isLoading);

	// Display value with max count handling
	let displayValue = $derived.by(() => {
		if (count > maxCount) {
			return `${maxCount}+`;
		}
		return count.toString();
	});

	// ARIA label for accessibility
	let ariaLabel = $derived.by(() => {
		if (count === 0) {
			return 'No unread notifications';
		} else if (count === 1) {
			return '1 unread notification';
		} else if (count > maxCount) {
			return `More than ${maxCount} unread notifications`;
		} else {
			return `${count} unread notifications`;
		}
	});

	// Handle visibility changes to pause/resume polling
	$effect(() => {
		function handleVisibilityChange(): void {
			const visible = document.visibilityState === 'visible';
			isVisible = visible;

			// Refetch immediately when tab becomes visible
			if (visible && !unreadQuery.isLoading) {
				unreadQuery.refetch();
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});

	// Track count changes and trigger animation
	$effect(() => {
		if (count !== previousCount) {
			// Only animate if count increased and we have a previous count
			if (count > previousCount && previousCount > 0) {
				shouldAnimate = true;
				// Reset animation flag after animation completes
				setTimeout(() => {
					shouldAnimate = false;
				}, 600);
			}

			// Call the onChange callback if provided
			if (onCountChange) {
				onCountChange(count);
			}

			previousCount = count;
		}
	});

	// Log errors silently (fail gracefully)
	$effect(() => {
		if (isError) {
			console.warn('[NotificationBadge] Failed to fetch unread count');
		}
	});
</script>

{#if shouldShowBadge}
	<span
		class={cn(
			'absolute -right-1.5 -top-1.5 z-10',
			'flex h-5 min-w-[1.25rem] items-center justify-center',
			'rounded-full bg-destructive px-1',
			'text-[0.625rem] font-semibold leading-none text-destructive-foreground',
			'transition-all duration-200 ease-out',
			'shadow-sm',
			shouldAnimate && 'animate-badge-pulse',
			className
		)}
		role="status"
		aria-live="polite"
		aria-label={ariaLabel}
	>
		{displayValue}
	</span>
{/if}

<style>
	/* Pulse animation when count increases */
	@keyframes badge-pulse {
		0% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.2);
		}
		100% {
			transform: scale(1);
		}
	}

	.animate-badge-pulse {
		animation: badge-pulse 0.6s cubic-bezier(0.4, 0, 0.2, 1);
	}
</style>
