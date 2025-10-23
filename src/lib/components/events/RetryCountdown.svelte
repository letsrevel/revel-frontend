<script lang="ts">
	import { onMount } from 'svelte';
	import { Clock } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		retryOn: string; // ISO datetime string
		class?: string;
	}

	let { retryOn, class: className }: Props = $props();

	let countdown = $state('');
	let intervalId: ReturnType<typeof setInterval> | null = null;

	/**
	 * Format the countdown based on time remaining
	 */
	function formatCountdown(retryDate: string): string {
		try {
			const now = new Date();
			const retry = new Date(retryDate);
			const diff = retry.getTime() - now.getTime();

			// If date has passed, available now
			if (diff <= 0) {
				return 'Available now';
			}

			const minutes = Math.floor(diff / 60000);
			const hours = Math.floor(diff / 3600000);
			const days = Math.floor(diff / 86400000);

			// Less than 1 hour
			if (minutes < 60) {
				return `Available in ${minutes} minute${minutes === 1 ? '' : 's'}`;
			}

			// Less than 24 hours
			if (hours < 24) {
				return `Available in ${hours} hour${hours === 1 ? '' : 's'}`;
			}

			// Less than 7 days
			if (days < 7) {
				return `Available in ${days} day${days === 1 ? '' : 's'}`;
			}

			// 7+ days: show the date
			return `Available on ${retry.toLocaleDateString('en-US', {
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			})}`;
		} catch (error) {
			console.error('Failed to format retry countdown:', error);
			return 'Available soon';
		}
	}

	/**
	 * Update the countdown display
	 */
	function updateCountdown() {
		countdown = formatCountdown(retryOn);
	}

	onMount(() => {
		// Initial update
		updateCountdown();

		// Update every second
		intervalId = setInterval(updateCountdown, 1000);

		// Cleanup on unmount
		return () => {
			if (intervalId) {
				clearInterval(intervalId);
			}
		};
	});
</script>

<!--
  Retry Countdown Component

  Displays a live countdown timer for when a user can retry an action
  (e.g., retake a failed questionnaire).

  @component
  @example
  <RetryCountdown retryOn="2025-10-25T10:00:00Z" />
-->
<div
	class={cn('flex items-center gap-2 text-sm font-medium', className)}
	role="status"
	aria-live="polite"
	aria-atomic="true"
>
	<Clock class="h-4 w-4" aria-hidden="true" />
	<span>{countdown}</span>
</div>
