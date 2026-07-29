<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/state';
	import EmbedHeader from '$lib/components/embed/EmbedHeader.svelte';
	import EmbedFooter from '$lib/components/embed/EmbedFooter.svelte';
	import EmbedEventGrid from '$lib/components/embed/EmbedEventGrid.svelte';
	import {
		buildEmbedLink,
		organizationPath,
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
		medium: data.viaOembed ? 'oembed' : 'list',
		campaign: data.organization.slug,
		content: data.utmContent
	});

	const orgHref = $derived(
		buildEmbedLink(links.origin, organizationPath(data.organization.slug), links)
	);
</script>

<svelte:head>
	<title>{m['embed.eventsBy']({ organization: data.organization.name })}</title>
</svelte:head>

<section aria-labelledby="embed-list-heading">
	<EmbedHeader
		headingId="embed-list-heading"
		title={data.organization.name}
		logo={data.organization.logo_thumbnail_url ?? data.organization.logo}
		href={orgHref}
	/>

	<EmbedEventGrid
		events={data.events}
		prices={data.prices}
		{links}
		labelledBy="embed-list-heading"
	/>

	<EmbedFooter poweredByHref={poweredByLink(links.origin, links)} moreHref={orgHref} />
</section>
