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
			<p class="text-sm font-extrabold uppercase tracking-[0.12em] text-primary">{kicker}</p>
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
			<p class="mt-2 max-w-prose text-muted-foreground">{subtitle}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex shrink-0 flex-wrap items-center gap-2">{@render actions()}</div>
	{/if}
</header>
