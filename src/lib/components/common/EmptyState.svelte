<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import type { Tone } from './tones';

	interface Props {
		icon: Component;
		/** Already-translated strings — i18n stays at the call site. */
		title: string;
		body?: string;
		tone?: Exclude<Tone, 'danger'>;
		/** Heading level for the title; use 2 on pages whose only heading is this one. */
		level?: 2 | 3;
		action?: Snippet;
		class?: string;
	}
	const {
		icon: Icon,
		title,
		body,
		tone = 'brand',
		level = 3,
		action,
		class: className = ''
	}: Props = $props();

	// Imagery rule: the chip is decorative art, so it keeps the FIXED poster
	// palette in both modes (like the landing's stickers). Every solid pair
	// below is an audited token pair in audit-brand-themes.py (poster section),
	// except success, which has no poster hue and uses the theme success pair
	// (also audited, flips in dark).
	const chipClasses: Record<Exclude<Tone, 'danger'>, string> = {
		brand: 'bg-poster-purple text-poster-white',
		info: 'bg-poster-periwinkle text-poster-ink',
		warning: 'bg-poster-amber text-poster-ink',
		neutral: 'bg-poster-paper text-poster-ink',
		success: 'bg-success text-success-foreground'
	};

	const headingClass = 'mt-4 text-lg font-extrabold';
</script>

<div
	class={cn(
		'flex flex-col items-center rounded-lg border-2 bg-card px-6 py-10 text-center shadow-poster',
		className
	)}
>
	<span
		aria-hidden="true"
		class={cn(
			'flex h-14 w-14 -rotate-2 items-center justify-center rounded-2xl shadow-sm',
			chipClasses[tone]
		)}
	>
		<Icon class="h-7 w-7" />
	</span>
	{#if level === 2}
		<h2 class={headingClass}>{title}</h2>
	{:else}
		<h3 class={headingClass}>{title}</h3>
	{/if}
	{#if body}
		<p class="mt-1.5 max-w-sm text-sm text-muted-foreground">{body}</p>
	{/if}
	{#if action}
		<div class="mt-5 flex flex-wrap justify-center gap-2">{@render action()}</div>
	{/if}
</div>
