<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import EventHeader from '$lib/components/events/EventHeader.svelte';
	import EventDetails from '$lib/components/events/EventDetails.svelte';
	import EligibilityStatusDisplay from '$lib/components/events/EligibilityStatusDisplay.svelte';
	import ActionButton from '$lib/components/events/ActionButton.svelte';
	import OrganizationInfo from '$lib/components/events/OrganizationInfo.svelte';
	import { isEligibility } from '$lib/utils/eligibility';
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

	// Check if user is authenticated
	let isAuthenticated = $derived(data.userStatus !== null);

	// Get eligibility if available
	let eligibility = $derived.by(() => {
		if (!data.userStatus) return null;
		if (isEligibility(data.userStatus)) return data.userStatus;
		return null;
	});
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
		<div class="grid gap-8 lg:grid-cols-3">
			<!-- Left Column: Event Details -->
			<div class="lg:col-span-2">
				<EventDetails event={data.event} />

				<!-- Organization Info (below details on mobile, hidden on desktop) -->
				<div class="mt-8 lg:hidden">
					<OrganizationInfo organization={data.event.organization} />
				</div>
			</div>

			<!-- Right Column: Action Sidebar -->
			<div class="lg:col-span-1">
				<div class="sticky top-4 space-y-6">
					<!-- Action Button -->
					<ActionButton
						userStatus={data.userStatus}
						requiresTicket={data.event.requires_ticket}
						{isAuthenticated}
					/>

					<!-- Eligibility Status (if applicable) -->
					{#if eligibility}
						<EligibilityStatusDisplay {eligibility} />
					{/if}

					<!-- Organization Info (desktop only) -->
					<div class="hidden lg:block">
						<OrganizationInfo organization={data.event.organization} />
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Mobile Sticky Action Button -->
<div class="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
	<ActionButton
		userStatus={data.userStatus}
		requiresTicket={data.event.requires_ticket}
		{isAuthenticated}
	/>
</div>

<!-- Add padding to prevent content from being hidden behind sticky button on mobile -->
<div class="h-20 lg:hidden" aria-hidden="true"></div>
