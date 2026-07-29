<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/state';
	import EventCard from '$lib/components/events/EventCard.svelte';
	import EmbedHeader from '$lib/components/embed/EmbedHeader.svelte';
	import EmbedFooter from '$lib/components/embed/EmbedFooter.svelte';
	import {
		buildEmbedLink,
		eventPath,
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
		medium: data.viaOembed ? 'oembed' : 'event',
		campaign: data.event.organization.slug,
		content: data.utmContent
	});

	const eventHref = $derived(
		buildEmbedLink(links.origin, eventPath(data.event.organization.slug, data.event.slug), links)
	);
	const orgHref = $derived(
		buildEmbedLink(links.origin, organizationPath(data.event.organization.slug), links)
	);

	const ctaLabel = $derived(
		data.event.requires_ticket ? m['embed.getTickets']() : m['embed.viewEvent']()
	);
</script>

<svelte:head>
	<title>{data.event.name}</title>
</svelte:head>

<section aria-labelledby="embed-event-heading">
	<EmbedHeader
		headingId="embed-event-heading"
		title={data.event.organization.name}
		logo={data.event.organization.logo_thumbnail_url ?? data.event.organization.logo}
		href={orgHref}
	/>

	<div class="flex flex-col gap-3 p-4">
		<!-- EventDetailSchema is a structural superset of the list schema the card
		     renders, so the same component serves both surfaces. -->
		<EventCard
			event={data.event}
			lean
			target="_blank"
			href={eventHref}
			priceFrom={data.priceFrom}
		/>

		<a
			href={eventHref}
			target="_blank"
			rel="noopener"
			class="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			{ctaLabel}
			<span class="sr-only">({m['embed.openInNewTab']()})</span>
		</a>
	</div>

	<EmbedFooter
		poweredByHref={poweredByLink(links.origin, links)}
		moreHref={orgHref}
		moreLabel={m['embed.seeAllEvents']()}
	/>
</section>
