<script lang="ts">
	import type { Snippet } from 'svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';

	/**
	 * The dashboard cluster's poster-grade Celebration shell (uplift, spec §9).
	 *
	 * Twin of `auth/AuthBandLayout`, kept separate because the dashboard's
	 * header is a full-width, left-aligned page header with an actions rail —
	 * not the auth cluster's narrow centred column — and the two would fight
	 * over `width` / `text-center` if merged.
	 *
	 * `bg-secondary` / `secondary-foreground` is an audit-enforced pair in BOTH
	 * modes, so the band is a real poster panel that still respects the
	 * light/dark axis. The kicker and subtitle inherit the band's foreground
	 * through PageHeader's `onBand` affordance — its default `text-primary`
	 * kicker measures 4.12:1 there, below AA for 14px extrabold.
	 *
	 * Content is pulled up over the band's bottom edge so the first card
	 * visibly floats ON the colour. Give it something with a surface (a card,
	 * a controls panel); bare filter chips landing on the cut read as debris.
	 *
	 * Purely presentational: no data, no navigation, no copy of its own.
	 */
	interface Props {
		/** Already-translated strings — i18n stays at the call site. */
		title: string;
		kicker?: string;
		subtitle?: string;
		/** Right-aligned on sm+, same slot PageHeader exposes. */
		actions?: Snippet;
		children: Snippet;
	}
	const { title, kicker, subtitle, actions, children }: Props = $props();
</script>

<div class="bg-background">
	<section class="bg-secondary text-secondary-foreground">
		<div class="container mx-auto px-4 pb-20 pt-8 md:pt-10">
			<PageHeader volume="poster" onBand {kicker} {title} {subtitle} {actions} />
		</div>
	</section>

	<div class="container mx-auto -mt-12 px-4 pb-8 md:pb-12">
		{@render children()}
	</div>
</div>
