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
		/**
		 * Heading level for the title; use 2 on pages whose only heading is this
		 * one. Level 1 additionally switches the block to the DISPLAY variant —
		 * celebration h1 scale, a bigger chip, roomier spacing — for full-page
		 * TERMINAL interstitials (unsubscribe confirmed, contact email verified, …)
		 * whose only heading has to be the page h1. Those pages hand-composed the
		 * chip + heading + body stack before it existed; unsubscribe even carried a
		 * comment saying the primitive "caps at h2/h3".
		 *
		 * Loading states are deliberately NOT adopters: a spinner is not a terminal
		 * state, and this renders a static icon.
		 *
		 * Level 1 introduces NO new colour pair — it only changes size and
		 * spacing, so every ratio is the one levels 2/3 already ship: title
		 * (foreground on card) 17.40:1 light / 15.64:1 dark, body
		 * (muted-foreground on card) 9.05:1 / 7.41:1, and the chip pairs listed
		 * below. Only the body's SIZE moves, 14px → 16px, which loosens the
		 * requirement rather than tightening it.
		 *
		 * Levels 2 and 3 render exactly as they did before level 1 existed.
		 */
		level?: 1 | 2 | 3;
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
	// (also audited, flips in dark). Level 1 changes SIZE only, never the pair,
	// so the display variant inherits the same audited contrast.
	const chipClasses: Record<Exclude<Tone, 'danger'>, string> = {
		brand: 'bg-poster-purple text-poster-white',
		info: 'bg-poster-periwinkle text-poster-ink',
		warning: 'bg-poster-amber text-poster-ink',
		neutral: 'bg-poster-paper text-poster-ink',
		success: 'bg-success text-success-foreground'
	};

	// Each variant below holds a COMPLETE literal class string instead of a
	// shared base plus conditional fragments. That keeps the level 2/3 strings
	// byte-identical (same classes, same ORDER) to what shipped before level 1
	// existed, so no adopter's rendered markup — and nothing the e2e suite
	// matches on — shifts under the new variant.
	const display = $derived(level === 1);

	const rootClass = $derived(
		display
			? 'flex flex-col items-center rounded-lg border-2 bg-card px-6 py-14 text-center shadow-poster sm:py-16'
			: 'flex flex-col items-center rounded-lg border-2 bg-card px-6 py-10 text-center shadow-poster'
	);
	// The display chip lands on the same size the auth band uses (h-16/w-16),
	// which is where the hand-composed interstitials had already converged.
	const chipClass = $derived(
		display
			? 'flex h-16 w-16 -rotate-2 items-center justify-center rounded-2xl shadow-sm'
			: 'flex h-14 w-14 -rotate-2 items-center justify-center rounded-2xl shadow-sm'
	);
	const iconClass = $derived(display ? 'h-8 w-8' : 'h-7 w-7');
	const headingClass = $derived(
		display ? 'mt-5 text-3xl font-black leading-[1.12] sm:text-4xl' : 'mt-4 text-lg font-extrabold'
	);
	const bodyClass = $derived(
		display
			? 'mt-3 max-w-md text-base text-muted-foreground'
			: 'mt-1.5 max-w-sm text-sm text-muted-foreground'
	);
	const actionClass = $derived(
		display
			? 'mt-7 flex flex-wrap justify-center gap-2'
			: 'mt-5 flex flex-wrap justify-center gap-2'
	);
</script>

<div class={cn(rootClass, className)}>
	<span aria-hidden="true" class={cn(chipClass, chipClasses[tone])}>
		<Icon class={iconClass} />
	</span>
	{#if level === 1}
		<h1 class={headingClass}>{title}</h1>
	{:else if level === 2}
		<h2 class={headingClass}>{title}</h2>
	{:else}
		<h3 class={headingClass}>{title}</h3>
	{/if}
	{#if body}
		<p class={bodyClass}>{body}</p>
	{/if}
	{#if action}
		<div class={actionClass}>{@render action()}</div>
	{/if}
</div>
