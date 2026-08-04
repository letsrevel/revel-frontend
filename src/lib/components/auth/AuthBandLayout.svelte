<script lang="ts">
	import type { Snippet } from 'svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import { cn } from '$lib/utils';

	/**
	 * The auth cluster's poster-grade Celebration shell (uplift, spec §9).
	 *
	 * Every sign-in / sign-up / recovery / interstitial screen was the same
	 * vertically-centred column of white-on-paper: a hand-set kicker + h1, then
	 * a card. This gives the whole cluster the language U1 shipped on the public
	 * questionnaire route — a full-strength colour-block band carrying the type,
	 * with the content pulled up over its bottom edge so cards visibly FLOAT on
	 * colour rather than lying on the page.
	 *
	 * Why `bg-secondary` at full strength: `secondary` / `secondary-foreground`
	 * is an audit-enforced pair in BOTH modes (periwinkle in light, deep indigo
	 * in dark), so the band is a real poster panel that still respects the
	 * light/dark axis — no mode-inert surface, no hand-computed alpha. The
	 * kicker and subtitle inherit the band's own foreground via PageHeader's
	 * `onBand` affordance (its default `text-primary` kicker measures 4.12:1 on
	 * the light band, below AA — see PageHeader's `onBand` doc comment).
	 *
	 * Purely presentational: no form logic, no navigation, no copy of its own.
	 * The h1 it renders is the page's only heading, with byte-identical text to
	 * what each route passed before.
	 */
	interface Props {
		/** Already-translated strings — i18n stays at the call site. */
		title: string;
		kicker?: string;
		subtitle?: string;
		/**
		 * Decorative ornament rendered centred in the band ABOVE the title —
		 * the interstitials' status chip, or a `brand/LogoChip`. Callers are
		 * responsible for marking it `aria-hidden`; it must never carry copy
		 * that isn't already in the heading or body (same rule as PageHeader's
		 * `decoration` slot).
		 */
		chip?: Snippet;
		/** Column width for both the band copy and the floating stack. */
		width?: 'md' | 'lg' | 'xl';
		/** The floating content. Cards already carry the 2px edge + poster float. */
		children: Snippet;
		class?: string;
	}
	const {
		title,
		kicker,
		subtitle,
		chip,
		width = 'md',
		children,
		class: className = ''
	}: Props = $props();

	const widthClass = $derived(
		width === 'md' ? 'max-w-md' : width === 'lg' ? 'max-w-lg' : 'max-w-2xl'
	);
</script>

<div class={cn('min-h-[calc(100vh-4rem)] bg-background', className)}>
	<section class="bg-secondary text-secondary-foreground">
		<div class={cn('container mx-auto px-4 pb-20 pt-10 text-center sm:pt-14', widthClass)}>
			{#if chip}
				<div class="mb-5 flex justify-center">{@render chip()}</div>
			{/if}
			<PageHeader
				volume="poster"
				onBand
				{kicker}
				{title}
				{subtitle}
				class="text-center sm:flex-col sm:items-center"
			/>
		</div>
	</section>

	<!-- Pulled up over the band's bottom edge: the float is the whole point. -->
	<div class={cn('container mx-auto -mt-12 space-y-6 px-4 pb-16', widthClass)}>
		{@render children()}
	</div>
</div>
