<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import EventHeader from '$lib/components/events/EventHeader.svelte';
	import EventDetails from '$lib/components/events/EventDetails.svelte';
	import EventActionSidebar from '$lib/components/events/EventActionSidebar.svelte';
	import OrganizationInfo from '$lib/components/events/OrganizationInfo.svelte';
	import PotluckSection from '$lib/components/events/PotluckSection.svelte';
	import { generateEventStructuredData, structuredDataToJsonLd } from '$lib/utils/structured-data';
	import { isRSVP, isTicket } from '$lib/utils/eligibility';

	let { data }: { data: PageData } = $props();

	// Create mutable copy of event for client-side updates (like attendee count)
	let event = $state(data.event);

	// Get structured data for SEO
	let structuredData = $derived(
		generateEventStructuredData(event, `${page.url.origin}${page.url.pathname}`)
	);
	let jsonLd = $derived(structuredDataToJsonLd(structuredData));

	// Check if user has RSVP'd
	let hasRSVPd = $derived.by(() => {
		if (!data.userStatus) return false;

		if (isRSVP(data.userStatus)) {
			return data.userStatus.status === 'yes';
		}

		if (isTicket(data.userStatus)) {
			return data.userStatus.status === 'active' || data.userStatus.status === 'checked_in';
		}

		return false;
	});

	// Check if user is organizer
	// TODO: Get this from a separate endpoint or event permissions
	let isOrganizer = $derived(false);
</script>

<svelte:head>
	<title>{event.name} | Revel</title>
	<meta
		name="description"
		content={event.description?.slice(0, 160) ||
			`Join ${event.name} organized by ${event.organization.name}`}
	/>

	<!-- Open Graph -->
	<meta property="og:type" content="event" />
	<meta property="og:title" content={event.name} />
	<meta property="og:description" content={event.description || `Join ${event.name}`} />
	{#if event.cover_art}
		<meta property="og:image" content={event.cover_art} />
	{/if}
	<meta property="og:url" content={page.url.href} />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={event.name} />
	<meta
		name="twitter:description"
		content={event.description?.slice(0, 200) || `Join ${event.name}`}
	/>
	{#if event.cover_art}
		<meta name="twitter:image" content={event.cover_art} />
	{/if}

	<!-- Structured Data (JSON-LD) -->
	{@html `<script type="application/ld+json">${jsonLd}<\/script>`}
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Event Header -->
	<EventHeader {event} class="mb-8" />

	<!-- Main Content -->
	<div class="container mx-auto px-6 pb-16 md:px-8">
		<!-- Mobile Action Card (at top, prominent) -->
		<div class="mb-8 lg:hidden">
			<EventActionSidebar
				{event}
				userStatus={data.userStatus}
				isAuthenticated={data.isAuthenticated}
				variant="card"
			/>
		</div>

		<div class="grid gap-8 lg:grid-cols-3">
			<!-- Left Column: Event Details -->
			<div class="space-y-8 lg:col-span-2">
				<EventDetails {event} />

				<!-- Potluck Section -->
				<!-- Always show if items exist, controlled by the section itself -->
				<PotluckSection
					{event}
					{isOrganizer}
					isAuthenticated={data.isAuthenticated}
					{hasRSVPd}
					initialItems={data.potluckItems}
				/>

				<!-- Organization Info (below details on mobile, hidden on desktop) -->
				<div class="lg:hidden">
					<OrganizationInfo organization={event.organization} />
				</div>
			</div>

			<!-- Right Column: Action Sidebar (desktop only, sticky) -->
			<aside class="hidden lg:col-span-1 lg:block">
				<div class="space-y-6">
					<EventActionSidebar
						{event}
						userStatus={data.userStatus}
						isAuthenticated={data.isAuthenticated}
						variant="sidebar"
					/>

					<!-- Organization Info (desktop only) -->
					<OrganizationInfo organization={event.organization} />
				</div>
			</aside>
		</div>
	</div>
</div>
