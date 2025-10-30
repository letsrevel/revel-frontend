<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { MapPin, Settings, Calendar, ArrowRight, Repeat, ArrowDownUp } from 'lucide-svelte';
	import ResourceCard from '$lib/components/resources/ResourceCard.svelte';
	import { EventCard, EventSeriesCard } from '$lib/components/events';
	import { OrganizationDescription } from '$lib/components/organizations';
	import { getImageUrl } from '$lib/utils/url';
	import { createQuery } from '@tanstack/svelte-query';
	import { eventListEvents, eventseriesListEventSeries } from '$lib/api/generated/sdk.gen';
	import RequestMembershipButton from '$lib/components/organization/RequestMembershipButton.svelte';
	import ClaimMembershipButton from '$lib/components/organizations/ClaimMembershipButton.svelte';

	let { data }: { data: PageData } = $props();

	// Create mutable copy for client-side updates
	let organization = $state(data.organization);

	// Filter state for events
	let includePastEvents = $state(true);
	let eventsOrderBy = $state<'start' | '-start'>('-start'); // Newest first by default

	// Pagination state
	let eventsPage = $state(1);
	let seriesPage = $state(1);
	const pageSize = 6;

	// Compute full image URLs
	const logoUrl = $derived(getImageUrl(organization.logo));
	const coverUrl = $derived(getImageUrl(organization.cover_art));

	// Compute location display
	let locationDisplay = $derived.by(() => {
		if (!organization.city) return organization.address || null;
		const cityCountry = organization.city.country
			? `${organization.city.name}, ${organization.city.country}`
			: organization.city.name;
		return organization.address ? `${organization.address}, ${cityCountry}` : cityCountry;
	});

	// Fallback gradient for cover art
	function getOrgFallbackGradient(orgId: string): string {
		// Use org ID to generate consistent gradient
		const hash = orgId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		const gradients = [
			'bg-gradient-to-br from-blue-500 to-indigo-600',
			'bg-gradient-to-br from-purple-500 to-pink-600',
			'bg-gradient-to-br from-green-500 to-teal-600',
			'bg-gradient-to-br from-orange-500 to-red-600',
			'bg-gradient-to-br from-cyan-500 to-blue-600'
		];
		return gradients[hash % gradients.length];
	}

	let fallbackGradient = $derived(getOrgFallbackGradient(organization.id));

	// Filter resources to show only those marked for display on org page
	const displayedResources = $derived(
		data.resources.filter((resource) => resource.display_on_organization_page)
	);

	// Fetch event series for this organization
	const seriesQuery = createQuery(() => ({
		queryKey: ['org-series', organization.id, seriesPage],
		queryFn: async () => {
			const response = await eventseriesListEventSeries({
				query: {
					organization: organization.id,
					page: seriesPage,
					page_size: pageSize
				}
			});

			return {
				results: response.data?.results || [],
				count: response.data?.count || 0
			};
		}
	}));

	let eventSeries = $derived(seriesQuery.data?.results || []);
	let seriesTotalCount = $derived(seriesQuery.data?.count || 0);
	let seriesTotalPages = $derived(Math.ceil(seriesTotalCount / pageSize));

	// Fetch events for this organization
	const eventsQuery = createQuery(() => ({
		queryKey: ['org-events', organization.id, includePastEvents, eventsOrderBy, eventsPage],
		queryFn: async () => {
			const response = await eventListEvents({
				query: {
					organization: organization.id,
					include_past: includePastEvents,
					page: eventsPage,
					page_size: pageSize,
					order_by: eventsOrderBy
				}
			});

			return {
				results: response.data?.results || [],
				count: response.data?.count || 0
			};
		}
	}));

	let events = $derived(eventsQuery.data?.results || []);
	let eventsTotalCount = $derived(eventsQuery.data?.count || 0);
	let eventsTotalPages = $derived(Math.ceil(eventsTotalCount / pageSize));

	// Toggle event ordering
	function toggleEventsOrder() {
		eventsOrderBy = eventsOrderBy === '-start' ? 'start' : '-start';
		eventsPage = 1; // Reset to first page
	}

	// Reset page when filter changes
	$effect(() => {
		// Watch includePastEvents and eventsOrderBy
		includePastEvents;
		eventsOrderBy;
		eventsPage = 1;
	});
</script>

<svelte:head>
	<title>{organization.name} | Revel</title>
	<meta
		name="description"
		content={organization.description?.slice(0, 160) || `${organization.name} on Revel`}
	/>

	<!-- Open Graph -->
	<meta property="og:type" content="profile" />
	<meta property="og:title" content={organization.name} />
	<meta
		property="og:description"
		content={organization.description || `${organization.name} on Revel`}
	/>
	{#if coverUrl}
		<meta property="og:image" content={coverUrl} />
	{/if}
	<meta property="og:url" content={page.url.href} />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={organization.name} />
	<meta
		name="twitter:description"
		content={organization.description?.slice(0, 200) || `${organization.name} on Revel`}
	/>
	{#if coverUrl}
		<meta name="twitter:image" content={coverUrl} />
	{/if}
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Hero Section with Cover Art -->
	<section class="relative w-full overflow-hidden">
		<!-- Cover Image or Gradient -->
		<div class="relative h-48 w-full md:h-64 lg:h-80">
			{#if coverUrl}
				<img
					src={coverUrl}
					alt="{organization.name} cover"
					class="h-full w-full object-cover"
					loading="eager"
				/>
				<!-- Gradient overlay -->
				<div
					class="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60"
				></div>
			{:else}
				<!-- Fallback gradient -->
				<div class="h-full w-full {fallbackGradient}"></div>
				<div class="absolute inset-0 bg-gradient-to-b from-black/10 to-black/60"></div>
			{/if}
		</div>
	</section>

	<!-- Main Content -->
	<div class="container mx-auto px-6 py-8 md:px-8 lg:py-12">
		<!-- Header with Logo, Name, and Actions -->
		<div class="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
			<div class="flex flex-1 gap-4">
				<!-- Organization Logo -->
				<div class="flex-shrink-0">
					{#if logoUrl}
						<img
							src={logoUrl}
							alt="{organization.name} logo"
							class="h-16 w-16 rounded-lg object-cover shadow-sm md:h-20 md:w-20"
						/>
					{:else}
						<div
							class="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-xl font-bold text-primary-foreground shadow-sm md:h-20 md:w-20 md:text-2xl"
						>
							{organization.name.charAt(0).toUpperCase()}
						</div>
					{/if}
				</div>

				<!-- Organization Info -->
				<div class="min-w-0 flex-1">
					<h1 class="mb-2 text-3xl font-bold md:text-4xl">{organization.name}</h1>

					<!-- Metadata Row -->
					<div class="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
						<!-- Location -->
						{#if locationDisplay}
							<div class="flex items-center gap-1.5">
								<MapPin class="h-4 w-4" aria-hidden="true" />
								<span>{locationDisplay}</span>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="flex flex-shrink-0 flex-wrap gap-2">
				<!-- Edit Button (if user has permission) -->
				{#if data.canEdit}
					<a
						href="/org/{organization.slug}/admin/settings"
						class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Settings class="h-4 w-4" aria-hidden="true" />
						Edit Profile
					</a>
				{/if}

				<!-- Claim Membership Button (if token present and grants membership) -->
				{#if data.organizationTokenDetails && data.organizationTokenDetails.grants_membership && !data.isMember && !data.isOwner && !data.isStaff}
					<ClaimMembershipButton
						tokenId={data.organizationTokenDetails.id || ''}
						tokenDetails={data.organizationTokenDetails}
						organizationName={organization.name}
						class="inline-flex items-center gap-2"
					/>
					<!-- Request Membership Button (if org accepts members and user is not a member) -->
				{:else if organization.accept_membership_requests}
					<RequestMembershipButton
						organizationSlug={organization.slug}
						organizationName={organization.name}
						isAuthenticated={data.isAuthenticated}
						isMember={data.isMember}
						isOwner={data.isOwner}
						isStaff={data.isStaff}
					/>
				{/if}
			</div>
		</div>

		<!-- Organization Description -->
		<div class="mb-12">
			<OrganizationDescription
				descriptionHtml={organization.description_html}
				description={organization.description}
				organizationName={organization.name}
			/>
		</div>

		<!-- Resources Section -->
		{#if displayedResources.length > 0}
			<section aria-labelledby="resources-heading" class="mb-12">
				<div class="mb-6 flex items-center justify-between">
					<div>
						<h2 id="resources-heading" class="text-2xl font-bold">Resources</h2>
						<p class="mt-1 text-sm text-muted-foreground">
							Helpful documents, links, and information from {organization.name}
						</p>
					</div>
					<a
						href="/org/{organization.slug}/resources"
						class="text-sm font-medium text-primary hover:underline"
					>
						View all
					</a>
				</div>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each displayedResources as resource (resource.id)}
						<ResourceCard {resource} />
					{/each}
				</div>
			</section>
		{/if}

		<!-- Event Series Section -->
		{#if !seriesQuery.isError && (eventSeries.length > 0 || seriesQuery.isLoading)}
			<section aria-labelledby="series-heading" class="mb-12">
				<div class="mb-6 flex items-center justify-between">
					<div>
						<h2 id="series-heading" class="text-2xl font-bold">Event Series</h2>
						<p class="mt-1 text-sm text-muted-foreground">
							Recurring event series from {organization.name}
						</p>
					</div>
				</div>

				{#if seriesQuery.isLoading}
					<!-- Loading State -->
					<div class="rounded-lg border bg-card p-8 text-center">
						<Repeat class="mx-auto mb-4 h-12 w-12 animate-pulse text-muted-foreground" />
						<p class="text-muted-foreground">Loading series...</p>
					</div>
				{:else if eventSeries.length > 0}
					<!-- Series Cards Grid -->
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{#each eventSeries as series (series.id)}
							<EventSeriesCard {series} />
						{/each}
					</div>

					<!-- Pagination -->
					{#if seriesTotalPages > 1}
						<div class="mt-6 flex items-center justify-center gap-2">
							<button
								type="button"
								disabled={seriesPage === 1}
								onclick={() => (seriesPage = seriesPage - 1)}
								class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
							>
								Previous
							</button>
							<span class="text-sm text-muted-foreground">
								Page {seriesPage} of {seriesTotalPages}
							</span>
							<button
								type="button"
								disabled={seriesPage >= seriesTotalPages}
								onclick={() => (seriesPage = seriesPage + 1)}
								class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
							>
								Next
							</button>
						</div>
					{/if}
				{/if}
			</section>
		{/if}

		<!-- Events Section -->
		<section aria-labelledby="events-heading" class="mb-12">
			<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 id="events-heading" class="text-2xl font-bold">Events</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						Discover events hosted by {organization.name}
					</p>
				</div>

				<div class="flex flex-wrap items-center gap-4">
					<!-- Filter Toggle -->
					<div class="flex items-center gap-2">
						<label for="include-past" class="text-sm font-medium">Include past events</label>
						<input
							id="include-past"
							type="checkbox"
							bind:checked={includePastEvents}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
					</div>

					<!-- Sort Order Toggle -->
					<button
						type="button"
						onclick={toggleEventsOrder}
						class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						aria-label={eventsOrderBy === '-start'
							? 'Showing newest first'
							: 'Showing oldest first'}
					>
						<ArrowDownUp class="h-4 w-4" aria-hidden="true" />
						{eventsOrderBy === '-start' ? 'Newest First' : 'Oldest First'}
					</button>

					<!-- Browse All Button -->
					<a
						href="/events?organization={organization.id}&organization_name={encodeURIComponent(
							organization.name
						)}&organization_slug={organization.slug}"
						class="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
					>
						Browse All
						<ArrowRight class="h-4 w-4" aria-hidden="true" />
					</a>
				</div>
			</div>

			{#if eventsQuery.isLoading}
				<!-- Loading State -->
				<div class="rounded-lg border bg-card p-8 text-center">
					<Calendar class="mx-auto mb-4 h-12 w-12 animate-pulse text-muted-foreground" />
					<p class="text-muted-foreground">Loading events...</p>
				</div>
			{:else if eventsQuery.isError}
				<!-- Error State -->
				<div class="rounded-lg border border-destructive/20 bg-destructive/5 p-8 text-center">
					<p class="font-semibold text-destructive">Failed to load events</p>
					<p class="mt-2 text-sm text-muted-foreground">
						Please try refreshing the page or check back later.
					</p>
				</div>
			{:else if events.length === 0}
				<!-- Empty State -->
				<div class="rounded-lg border bg-card p-8 text-center">
					<Calendar class="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
					<h3 class="mb-2 text-lg font-semibold">
						{includePastEvents ? 'No events found' : 'No upcoming events'}
					</h3>
					<p class="text-sm text-muted-foreground">
						{includePastEvents
							? `${organization.name} hasn't hosted any events yet.`
							: `${organization.name} has no upcoming events scheduled.`}
					</p>
					{#if !includePastEvents}
						<button
							type="button"
							onclick={() => (includePastEvents = true)}
							class="mt-4 text-sm font-medium text-primary hover:underline"
						>
							View past events
						</button>
					{/if}
				</div>
			{:else}
				<!-- Event Cards Grid -->
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each events as event (event.id)}
						<EventCard {event} />
					{/each}
				</div>

				<!-- Pagination -->
				{#if eventsTotalPages > 1}
					<div class="mt-6 flex items-center justify-center gap-2">
						<button
							type="button"
							disabled={eventsPage === 1}
							onclick={() => (eventsPage = eventsPage - 1)}
							class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
						>
							Previous
						</button>
						<span class="text-sm text-muted-foreground">
							Page {eventsPage} of {eventsTotalPages}
						</span>
						<button
							type="button"
							disabled={eventsPage >= eventsTotalPages}
							onclick={() => (eventsPage = eventsPage + 1)}
							class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
						>
							Next
						</button>
					</div>
				{/if}
			{/if}
		</section>
	</div>
</div>
