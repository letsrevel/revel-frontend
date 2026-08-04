<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Already-translated strings — i18n stays at the call site. */
		title: string;
		kicker?: string;
		level?: 2 | 3;
		/** 'celebration' = public/user surfaces; 'studio' = admin/dense. */
		volume?: 'celebration' | 'studio';
		actions?: Snippet;
		class?: string;
	}
	const {
		title,
		kicker,
		level = 2,
		volume = 'studio',
		actions,
		class: className = ''
	}: Props = $props();

	const headingClass = $derived(
		volume === 'celebration' ? 'text-xl font-extrabold' : 'text-lg font-bold'
	);
</script>

<div class="flex flex-wrap items-end justify-between gap-2 {className}">
	<div class="min-w-0">
		{#if kicker}
			<p class="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">{kicker}</p>
		{/if}
		{#if level === 2}
			<h2 class={headingClass}>{title}</h2>
		{:else}
			<h3 class={headingClass}>{title}</h3>
		{/if}
	</div>
	{#if actions}
		<div class="flex shrink-0 items-center gap-2">{@render actions()}</div>
	{/if}
</div>
