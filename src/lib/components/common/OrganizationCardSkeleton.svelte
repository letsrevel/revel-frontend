<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import Skeleton from './Skeleton.svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();
</script>

<div
	class={cn('flex items-center gap-4 rounded-lg border bg-card p-4', className)}
	role="status"
	aria-live="polite"
>
	<!-- Logo Skeleton -->
	<Skeleton variant="circular" width="4rem" height="4rem" class="shrink-0" />

	<!-- Content Skeleton -->
	<div class="flex-1 space-y-2">
		<Skeleton width="70%" height="1.25rem" />
		<Skeleton width="90%" height="0.875rem" />
	</div>

	<!-- Buttons Skeleton -->
	<div class="flex gap-2">
		<Skeleton width="7rem" height="2.5rem" />
		<Skeleton width="6rem" height="2.5rem" />
	</div>

	<span class="sr-only">{m['organizationCardSkeleton.loading']()}</span>
</div>
