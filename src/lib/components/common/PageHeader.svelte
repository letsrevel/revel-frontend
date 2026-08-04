<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	interface Props extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
		/** Already-translated strings — i18n stays at the call site. */
		title: string;
		kicker?: string;
		subtitle?: string;
		/**
		 * 'celebration' = display scale (public/user surfaces); 'studio' =
		 * admin/dense; 'poster' = celebration one notch louder, for the handful
		 * of hero screens that carry a color-block band (uplift prototype).
		 * 'poster' is celebration in every other respect — same kicker, same
		 * decoration slot — so it inherits the decorative-only rule below.
		 */
		volume?: 'celebration' | 'studio' | 'poster';
		/**
		 * The header sits on a SATURATED color-block band whose own
		 * `*-foreground` pair is already audit-enforced (e.g. `bg-secondary
		 * text-secondary-foreground`). Kicker and subtitle then inherit that
		 * foreground instead of carrying their own accent/muted colours.
		 *
		 * This exists because the default kicker's `text-primary` does NOT
		 * survive a saturated band: on the light periwinkle `--secondary` it
		 * measures **4.12:1**, below AA for the kicker's 14px extrabold text
		 * (4.60:1 in dark, which passes — the prop covers both so the two modes
		 * don't drift). Inheriting takes it to the band's own pair: 9.00:1
		 * light / 8.23:1 dark. The subtitle's `text-muted-foreground` does clear
		 * AA on that band (5.35 / 5.46) but goes full-strength too, so the whole
		 * header reads as one block of band copy.
		 *
		 * The h1 never carried a colour class, so it already inherits.
		 */
		onBand?: boolean;
		/** Right-aligned on sm+, wraps under the title on mobile. */
		actions?: Snippet;
		/** Celebration-only decorative slot (e.g. a brand Sticker). Ignored in studio. */
		decoration?: Snippet;
		class?: string;
	}
	const {
		title,
		kicker,
		subtitle,
		volume = 'studio',
		onBand = false,
		actions,
		decoration,
		class: className = '',
		...restProps
	}: Props = $props();
</script>

<header
	class={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}
	{...restProps}
>
	<div class="min-w-0">
		{#if kicker}
			<p
				class={cn(
					'text-sm font-extrabold uppercase tracking-[0.12em]',
					onBand ? 'text-current' : 'text-primary'
				)}
			>
				{kicker}
			</p>
		{/if}
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
			<h1
				class={cn(
					'mt-1',
					volume === 'poster' && 'text-4xl font-black leading-[1.08] sm:text-5xl',
					volume === 'celebration' && 'text-3xl font-black leading-[1.12] sm:text-4xl',
					volume === 'studio' && 'text-2xl font-extrabold tracking-tight sm:text-3xl'
				)}
			>
				{title}
			</h1>
			{#if decoration && volume !== 'studio'}
				<span aria-hidden="true">{@render decoration()}</span>
			{/if}
		</div>
		{#if subtitle}
			<p class={cn('mt-2 max-w-prose', onBand ? 'text-current' : 'text-muted-foreground')}>
				{subtitle}
			</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex shrink-0 flex-wrap items-center gap-2">{@render actions()}</div>
	{/if}
</header>
