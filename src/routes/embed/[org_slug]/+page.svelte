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
		// The slug from the route, not from a fetched record: attribution must
		// work even when the list comes back empty.
		campaign: data.orgSlug,
		content: data.utmContent
	});

	const orgHref = $derived(buildEmbedLink(links.origin, organizationPath(data.orgSlug), links));

	// The organization's display identity rides along on the events. With none,
	// there is no name or logo to show, so the header is skipped rather than
	// rendered from a raw slug.
	const heading = $derived(data.organization?.name ?? data.orgSlug);
</script>

<svelte:head>
	<title>{m['embed.eventsBy']({ organization: heading })}</title>
</svelte:head>

<section aria-labelledby={data.organization ? 'embed-list-heading' : undefined}>
	{#if data.organization}
		<EmbedHeader
			headingId="embed-list-heading"
			title={data.organization.name}
			logo={data.organization.logo_thumbnail_url ?? data.organization.logo}
			href={orgHref}
		/>
	{/if}

	<EmbedEventGrid
		events={data.events}
		prices={data.prices}
		{links}
		labelledBy={data.organization ? 'embed-list-heading' : undefined}
	/>

	<EmbedFooter poweredByHref={poweredByLink(links.origin, links)} moreHref={orgHref} />
</section>
