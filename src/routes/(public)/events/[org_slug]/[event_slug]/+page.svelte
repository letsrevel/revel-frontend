<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import EventHeader from '$lib/components/events/EventHeader.svelte';
	import EventDetails from '$lib/components/events/EventDetails.svelte';
	import EventActionSidebar from '$lib/components/events/EventActionSidebar.svelte';
	import OrganizationInfo from '$lib/components/events/OrganizationInfo.svelte';
	import {
		generateEventStructuredData,
		structuredDataToJsonLd
	} from '$lib/utils/structured-data';

	let { data }: { data: PageData } = $props();

	// Get structured data for SEO
	let structuredData = $derived(
		generateEventStructuredData(data.event, `${page.url.origin}${page.url.pathname}`)
	);
	let jsonLd = $derived(structuredDataToJsonLd(structuredData));
</script>

<svelte:head>
	<title>{data.event.name} | Revel</title>
	<meta name="description" content={data.event.description?.slice(0, 160) || `Join ${data.event.name} organized by ${data.event.organization.name}`} />

	<!-- Open Graph -->
	<meta property="og:type" content="event" />
	<meta property="og:title" content={data.event.name} />
	<meta property="og:description" content={data.event.description || `Join ${data.event.name}`} />
	{#if data.event.cover_art}
		<meta property="og:image" content={data.event.cover_art} />
	{/if}
	<meta property="og:url" content={page.url.href} />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={data.event.name} />
	<meta name="twitter:description" content={data.event.description?.slice(0, 200) || `Join ${data.event.name}`} />
	{#if data.event.cover_art}
		<meta name="twitter:image" content={data.event.cover_art} />
	{/if}

	<!-- Structured Data (JSON-LD) -->
	{@html `<script type="application/ld+json">${jsonLd}<\/script>`}
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Event Header -->
	<EventHeader event={data.event} class="mb-8" />

	<!-- Main Content -->
	<div class="container mx-auto px-6 pb-16 md:px-8">
		<!-- Mobile Action Card (at top, prominent) -->
		<div class="mb-8 lg:hidden">
			<EventActionSidebar
				event={data.event}
				userStatus={data.userStatus}
				isAuthenticated={data.isAuthenticated}
				variant="card"
			/>
		</div>

		<div class="grid gap-8 lg:grid-cols-3">
			<!-- Left Column: Event Details -->
			<div class="lg:col-span-2">
				<EventDetails event={data.event} />

				<!-- Organization Info (below details on mobile, hidden on desktop) -->
				<div class="mt-8 lg:hidden">
					<OrganizationInfo organization={data.event.organization} />
				</div>
			</div>

			<!-- Right Column: Action Sidebar (desktop only, sticky) -->
			<aside class="hidden lg:col-span-1 lg:block">
				<div class="space-y-6">
					<EventActionSidebar
						event={data.event}
						userStatus={data.userStatus}
						isAuthenticated={data.isAuthenticated}
						variant="sidebar"
					/>

					<!-- Organization Info (desktop only) -->
					<OrganizationInfo organization={data.event.organization} />
				</div>
			</aside>
		</div>
	</div>
</div>
