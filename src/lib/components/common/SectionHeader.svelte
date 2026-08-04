<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		/** Already-translated strings — i18n stays at the call site. */
		title: string;
		kicker?: string;
		level?: 2 | 3;
		/** 'celebration' = public/user surfaces; 'studio' = admin/dense. */
		volume?: 'celebration' | 'studio';
		/** Applied to the heading element so callers can keep existing aria-labelledby wiring. */
		id?: string;
		actions?: Snippet;
		class?: string;
	}
	const {
		title,
		kicker,
		level = 2,
		volume = 'studio',
		id,
		actions,
		class: className = ''
	}: Props = $props();

	const headingClass = $derived(
		volume === 'celebration' ? 'text-xl font-extrabold' : 'text-lg font-bold'
	);
	const kickerClass = $derived(
		cn(
			'font-extrabold uppercase tracking-[0.12em] text-primary',
			volume === 'celebration' ? 'text-sm' : 'text-xs'
		)
	);
</script>

<div class={cn('flex flex-wrap items-end justify-between gap-2', className)}>
	<div class="min-w-0">
		{#if kicker}
			<p class={kickerClass}>{kicker}</p>
		{/if}
		{#if level === 2}
			<h2 class={headingClass} {id}>{title}</h2>
		{:else}
			<h3 class={headingClass} {id}>{title}</h3>
		{/if}
	</div>
	{#if actions}
		<div class="flex shrink-0 items-center gap-2">{@render actions()}</div>
	{/if}
</div>
