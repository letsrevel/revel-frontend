<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		/** Already-translated strings — i18n stays at the call site. */
		title: string;
		kicker?: string;
		level?: 2 | 3;
		/**
		 * 'celebration' = public/user surfaces; 'studio' = admin/dense;
		 * 'poster' = the hero screens that carry a color-block band, matching
		 * `PageHeader`'s third volume so U2/U3 never hand-roll the scale.
		 * Poster and celebration share the same section scale today — the
		 * volume exists so a future poster-only step doesn't have to be
		 * retrofitted at every call site.
		 */
		volume?: 'celebration' | 'studio' | 'poster';
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

	// Uplift prototype: the celebration section heading goes up a step
	// (text-xl → text-2xl). Celebration is exactly the public/user surfaces the
	// uplift targets, and a section heading a hair larger than body copy was
	// part of why those screens read flat. Studio is deliberately untouched.
	// Poster rides with celebration at section level (see the Props doc).
	const studio = $derived(volume === 'studio');
	const headingClass = $derived(studio ? 'text-lg font-bold' : 'text-2xl font-extrabold');
	const kickerClass = $derived(
		cn('font-extrabold uppercase tracking-[0.12em] text-primary', studio ? 'text-xs' : 'text-sm')
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
