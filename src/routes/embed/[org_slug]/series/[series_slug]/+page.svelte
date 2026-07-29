<script lang="ts">
	import { page } from '$app/state';
	import EmbedHeader from '$lib/components/embed/EmbedHeader.svelte';
	import EmbedFooter from '$lib/components/embed/EmbedFooter.svelte';
	import EmbedEventGrid from '$lib/components/embed/EmbedEventGrid.svelte';
	import {
		buildEmbedLink,
		seriesPath,
		poweredByLink,
		type EmbedLinkContext
	} from '$lib/embed/links';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	const links = $derived<EmbedLinkContext>({
		origin: page.url.origin,
		medium: data.viaOembed ? 'oembed' : 'series',
		campaign: data.series.organization.slug,
		content: data.utmContent
	});

	// Same fallback ladder the event embed uses: series thumbnail, series logo,
	// then the organization's. Without the last two rungs a series with no
	// thumbnail rendered no logo at all, even when one was available.
	const seriesLogo = $derived(
		data.series.logo_thumbnail_url ??
			data.series.logo ??
			data.series.organization.logo_thumbnail_url ??
			data.series.organization.logo
	);

	const seriesHref = $derived(
		buildEmbedLink(links.origin, seriesPath(data.series.organization.slug, data.series.slug), links)
	);
</script>

<svelte:head>
	<title>{data.series.name}</title>
</svelte:head>

<section aria-labelledby="embed-series-heading">
	<EmbedHeader
		headingId="embed-series-heading"
		title={data.series.name}
		subtitle={data.series.organization.name}
		logo={seriesLogo}
		href={seriesHref}
	/>

	{#if data.series.description}
		<p class="border-b border-border px-4 py-3 text-sm text-muted-foreground">
			{data.series.description}
		</p>
	{/if}

	<EmbedEventGrid
		events={data.events}
		prices={data.prices}
		{links}
		labelledBy="embed-series-heading"
	/>

	<EmbedFooter poweredByHref={poweredByLink(links.origin, links)} moreHref={seriesHref} />
</section>
