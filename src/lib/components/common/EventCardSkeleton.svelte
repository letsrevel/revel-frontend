<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import Skeleton from './Skeleton.svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		class?: string;
		variant?: 'compact' | 'standard';
	}

	let { class: className, variant = 'standard' }: Props = $props();
</script>

<div
	class={cn(
		'overflow-hidden rounded-lg border bg-card',
		variant === 'compact' && 'flex flex-row md:flex-col',
		variant === 'standard' && 'flex flex-col',
		className
	)}
	role="status"
	aria-live="polite"
>
	<!-- Image Skeleton -->
	<div
		class={cn(
			'relative',
			variant === 'compact' && 'w-32 shrink-0 md:aspect-video md:w-full',
			variant === 'standard' && 'aspect-video'
		)}
	>
		<Skeleton class="h-full w-full rounded-none" />
	</div>

	<!-- Content Skeleton -->
	<div class="flex flex-1 flex-col gap-3 p-4">
		<!-- Title and Organization -->
		<div class="space-y-2">
			<Skeleton width="80%" height="1.25rem" />
			<Skeleton width="50%" height="0.875rem" />
		</div>

		{#if variant === 'standard'}
			<!-- Details (date, location, type) -->
			<div class="space-y-2 border-t pt-3">
				<div class="flex items-center gap-2">
					<Skeleton variant="circular" width="1rem" height="1rem" />
					<Skeleton width="60%" height="0.875rem" />
				</div>
				<div class="flex items-center gap-2">
					<Skeleton variant="circular" width="1rem" height="1rem" />
					<Skeleton width="45%" height="0.875rem" />
				</div>
				<div class="flex items-center gap-2">
					<Skeleton variant="circular" width="1rem" height="1rem" />
					<Skeleton width="55%" height="0.875rem" />
				</div>
			</div>
		{/if}
	</div>

	<span class="sr-only">{m['eventCardSkeleton.loading']()}</span>
</div>
