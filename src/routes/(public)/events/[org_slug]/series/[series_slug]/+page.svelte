<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import { Calendar, ArrowLeft, Repeat, ArrowDownUp, Settings } from 'lucide-svelte';
	import { EventCard } from '$lib/components/events';
	import { getImageUrl } from '$lib/utils/url';
	import {
		generateEventSeriesMeta,
		generateEventSeriesStructuredData,
		generateBreadcrumbStructuredData,
		toJsonLd
	} from '$lib/utils/seo';
	import * as m from '$lib/paraglide/messages.js';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import FollowButton from '$lib/components/common/FollowButton.svelte';

	let { data }: { data: PageData } = $props();

	let series = $derived(data.series);
	let events = $derived(data.events);
	let totalCount = $derived(data.totalCount);
	let currentPage = $derived(data.page);
	let pageSize = $derived(data.pageSize);
	let orderBy = $derived(data.orderBy);

	// Compute full image URLs
	const coverUrl = $derived(getImageUrl(series.cover_art));
	const logoUrl = $derived(getImageUrl(series.logo));
	const orgLogoUrl = $derived(getImageUrl(series.organization.logo));

	// Fallback gradient
	function getSeriesFallbackGradient(seriesId: string): string {
		const hash = seriesId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		const gradients = [
			'bg-gradient-to-br from-blue-500 to-indigo-600',
			'bg-gradient-to-br from-purple-500 to-pink-600',
			'bg-gradient-to-br from-green-500 to-teal-600',
			'bg-gradient-to-br from-orange-500 to-red-600',
			'bg-gradient-to-br from-cyan-500 to-blue-600'
		];
		return gradients[hash % gradients.length];
	}

	let fallbackGradient = $derived(getSeriesFallbackGradient(series.id));

	// Generate comprehensive meta tags
	let metaTags = $derived(
		generateEventSeriesMeta(series, `${$page.url.origin}${$page.url.pathname}`)
	);

	// Generate structured data
	let structuredData = $derived(
		generateEventSeriesStructuredData(series, `${$page.url.origin}${$page.url.pathname}`)
	);
	let jsonLd = $derived(toJsonLd(structuredData));

	// Generate BreadcrumbList structured data
	let breadcrumbData = $derived(
		generateBreadcrumbStructuredData([
			{ name: 'Home', url: $page.url.origin },
			{ name: 'Events', url: `${$page.url.origin}/events` },
			{
				name: series.organization.name,
				url: `${$page.url.origin}/org/${series.organization.slug}`
			},
			{ name: series.name, url: `${$page.url.origin}${$page.url.pathname}` }
		])
	);
	let breadcrumbJsonLd = $derived(toJsonLd(breadcrumbData));

	// Calculate pagination info
	let totalPages = $derived(Math.ceil(totalCount / pageSize));
	let hasNextPage = $derived(currentPage < totalPages);
	let hasPrevPage = $derived(currentPage > 1);
</script>

<svelte:head>
	<title>{metaTags.title}</title>
	<meta name="description" content={metaTags.description} />
	{#if metaTags.canonical}
		<link rel="canonical" href={metaTags.canonical} />
	{/if}

	<!-- Open Graph -->
	<meta property="og:type" content={metaTags.ogType || 'website'} />
	<meta property="og:title" content={metaTags.ogTitle || metaTags.title} />
	<meta property="og:description" content={metaTags.ogDescription || metaTags.description} />
	{#if metaTags.ogImage}
		<meta property="og:image" content={metaTags.ogImage} />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		<meta
			property="og:image:alt"
			content={m['eventSeriesDetailPage.coverImageAlt']({ seriesName: series.name })}
		/>
	{/if}
	<meta property="og:url" content={metaTags.ogUrl || $page.url.href} />
	<meta property="og:site_name" content="Revel" />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter Card -->
	<meta name="twitter:card" content={metaTags.twitterCard || 'summary_large_image'} />
	<meta name="twitter:title" content={metaTags.twitterTitle || metaTags.title} />
	<meta name="twitter:description" content={metaTags.twitterDescription || metaTags.description} />
	{#if metaTags.twitterImage}
		<meta name="twitter:image" content={metaTags.twitterImage} />
		<meta
			name="twitter:image:alt"
			content={m['eventSeriesDetailPage.coverImageAlt']({ seriesName: series.name })}
		/>
	{/if}

	<!-- Additional SEO meta tags -->
	<meta name="robots" content="index, follow" />
	<meta name="author" content={series.organization.name} />

	<!-- Structured Data (JSON-LD) -->
	{@html `<script type="application/ld+json">${jsonLd}<\/script>`}
	{@html `<script type="application/ld+json">${breadcrumbJsonLd}<\/script>`}
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Hero Section with Cover Art -->
	<section class="relative w-full overflow-hidden">
		<!-- Cover Image or Gradient -->
		<div class="relative h-48 w-full md:h-64 lg:h-80">
			{#if coverUrl}
				<img
					src={coverUrl}
					alt={m['eventSeriesDetailPage.coverImageAlt']({ seriesName: series.name })}
					class="h-full w-full object-cover"
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

			<!-- Series Badge -->
			<div class="absolute right-4 top-4">
				<div class="rounded-full bg-primary px-4 py-2 shadow-lg">
					<div class="flex items-center gap-2">
						<Repeat class="h-4 w-4 text-primary-foreground" aria-hidden="true" />
						<span class="text-sm font-semibold text-primary-foreground"
							>{m['eventSeriesDetailPage.badge_eventSeries']()}</span
						>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Main Content -->
	<div class="container mx-auto px-6 py-8 md:px-8 lg:py-12">
		<!-- Back Button -->
		<div class="mb-6">
			<a
				href="/org/{series.organization.slug}"
				class="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				<ArrowLeft class="h-4 w-4" aria-hidden="true" />
				{m['eventSeriesDetailPage.backToOrganization']({
					organizationName: series.organization.name
				})}
			</a>
		</div>

		<!-- Admin Actions Card (Mobile) -->
		{#if data.canEdit}
			<div class="mb-8 lg:hidden">
				<aside
					class="rounded-lg border border-border bg-card p-4 shadow-sm"
					aria-label="Series management actions"
				>
					<h3 class="mb-3 text-sm font-semibold">{m['eventSeriesDetailPage.admin_title']()}</h3>
					<div class="space-y-2">
						<a
							href="/org/{series.organization.slug}/admin/event-series/{series.id}/edit"
							class="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							<Settings class="h-4 w-4" aria-hidden="true" />
							{m['eventSeriesDetailPage.admin_editButton']()}
						</a>
					</div>
				</aside>
			</div>
		{/if}

		<div class="grid gap-8 lg:grid-cols-3">
			<!-- Left Column: Main Content -->
			<div class="space-y-8 lg:col-span-2">
				<!-- Header with Logo, Name, and Organization -->
				<div class="flex flex-col gap-6 sm:flex-row sm:items-start">
					<div class="flex flex-1 gap-4">
						<!-- Series/Organization Logo -->
						<div class="flex-shrink-0">
							{#if logoUrl || orgLogoUrl}
								<img
									src={logoUrl || orgLogoUrl}
									alt={m['eventSeriesDetailPage.coverImageAlt']({ seriesName: series.name })}
									class="h-16 w-16 rounded-lg object-cover shadow-sm md:h-20 md:w-20"
								/>
							{:else}
								<div
									class="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-xl font-bold text-primary-foreground shadow-sm md:h-20 md:w-20 md:text-2xl"
								>
									{series.name.charAt(0).toUpperCase()}
								</div>
							{/if}
						</div>

						<!-- Series Info -->
						<div class="min-w-0 flex-1">
							<h1 class="mb-2 text-3xl font-bold md:text-4xl">{series.name}</h1>

							<!-- Organization Link -->
							<a
								href="/org/{series.organization.slug}"
								class="mb-2 inline-block text-base font-medium text-primary hover:underline"
							>
								{m['eventSeriesDetailPage.byOrganization']({
									organizationName: series.organization.name
								})}
							</a>

							<!-- Tags -->
							{#if series.tags && series.tags.length > 0}
								<div class="mt-3 flex flex-wrap gap-2">
									{#each series.tags as tag}
										<span
											class="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
										>
											{tag}
										</span>
									{/each}
								</div>
							{/if}

							<!-- Follow Button -->
							<div class="mt-4">
								<FollowButton
									entityType="event-series"
									entityId={series.id}
									entityName={series.name}
									isAuthenticated={data.isAuthenticated}
									variant="outline"
								/>
							</div>
						</div>
					</div>
				</div>

				<!-- Series Description -->
				{#if series.description}
					<section
						aria-labelledby="description-heading"
						class="rounded-lg border bg-card p-6 md:p-8"
					>
						<h2 id="description-heading" class="sr-only">
							{m['eventSeriesDetailPage.description_heading']({ seriesName: series.name })}
						</h2>
						<MarkdownContent content={series.description} class="prose-slate" />
					</section>
				{/if}

				<!-- Events Section -->
				<section aria-labelledby="events-heading">
					<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
						<div>
							<h2 id="events-heading" class="text-2xl font-bold">
								{m['eventSeriesDetailPage.events_heading']()}
							</h2>
							{#if totalCount > 0}
								<p class="mt-1 text-sm text-muted-foreground">
									{m['eventSeriesDetailPage.events_count']({
										count: totalCount,
										plural: totalCount === 1 ? '' : m['eventSeriesDetailPage.events_count_plural']()
									})}
								</p>
							{/if}
						</div>

						<!-- Sort Order Toggle -->
						<a
							href="?order_by={orderBy === '-start' ? 'start' : '-start'}"
							class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							aria-label={orderBy === '-start'
								? m['eventSeriesDetailPage.sort_ariaLabel_newest']()
								: m['eventSeriesDetailPage.sort_ariaLabel_oldest']()}
						>
							<ArrowDownUp class="h-4 w-4" aria-hidden="true" />
							{orderBy === '-start'
								? m['eventSeriesDetailPage.sort_newestFirst']()
								: m['eventSeriesDetailPage.sort_oldestFirst']()}
						</a>
					</div>

					{#if events.length === 0}
						<!-- Empty State -->
						<div class="rounded-lg border bg-card p-8 text-center">
							<Calendar class="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
							<h3 class="mb-2 text-lg font-semibold">{m['eventSeriesDetailPage.empty_title']()}</h3>
							<p class="text-sm text-muted-foreground">
								{m['eventSeriesDetailPage.empty_description']()}
							</p>
						</div>
					{:else}
						<!-- Event Cards Grid -->
						<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{#each events as event, index (`${event.id}-${index}`)}
								<EventCard {event} />
							{/each}
						</div>

						<!-- Pagination -->
						{#if totalPages > 1}
							<nav
								class="mt-12 flex flex-col items-center justify-between gap-4 sm:flex-row"
								aria-label="Pagination"
							>
								<!-- Results info -->
								<p class="text-sm text-muted-foreground">
									{m['eventSeriesDetailPage.pagination_showingPage']({ currentPage, totalPages })}
								</p>

								<!-- Pagination controls -->
								<div class="flex items-center gap-2">
									{#if hasPrevPage}
										<a
											href="?page={currentPage - 1}"
											class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
											aria-label="Go to previous page"
										>
											{m['eventSeriesDetailPage.pagination_previous']()}
										</a>
									{:else}
										<button
											type="button"
											disabled
											class="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium opacity-50"
											aria-label={m['eventSeriesDetailPage.pagination_previousUnavailable']()}
										>
											{m['eventSeriesDetailPage.pagination_previous']()}
										</button>
									{/if}

									<!-- Page indicator -->
									<span
										class="inline-flex h-10 items-center justify-center px-4 text-sm font-medium"
									>
										{m['eventSeriesDetailPage.pagination_pageIndicator']({
											currentPage,
											totalPages
										})}
									</span>

									{#if hasNextPage}
										<a
											href="?page={currentPage + 1}"
											class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
											aria-label="Go to next page"
										>
											{m['eventSeriesDetailPage.pagination_next']()}
										</a>
									{:else}
										<button
											type="button"
											disabled
											class="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium opacity-50"
											aria-label={m['eventSeriesDetailPage.pagination_nextUnavailable']()}
										>
											{m['eventSeriesDetailPage.pagination_next']()}
										</button>
									{/if}
								</div>
							</nav>
						{/if}
					{/if}
				</section>
			</div>

			<!-- Right Column: Admin Sidebar (Desktop only, sticky) -->
			{#if data.canEdit}
				<aside class="hidden lg:col-span-1 lg:block">
					<div class="sticky top-4 space-y-6">
						<div class="rounded-lg border border-border bg-card p-4 shadow-sm">
							<h3 class="mb-3 text-sm font-semibold">{m['eventSeriesDetailPage.admin_title']()}</h3>
							<div class="space-y-2">
								<a
									href="/org/{series.organization.slug}/admin/event-series/{series.id}/edit"
									class="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								>
									<Settings class="h-4 w-4" aria-hidden="true" />
									{m['eventSeriesDetailPage.admin_editButton']()}
								</a>
							</div>
						</div>
					</div>
				</aside>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Ensure proper prose styling for description */
	:global(.prose) {
		color: inherit;
	}

	:global(.prose p) {
		margin-top: 0.75rem;
		margin-bottom: 0.75rem;
	}

	:global(.prose p:first-child) {
		margin-top: 0;
	}

	:global(.prose p:last-child) {
		margin-bottom: 0;
	}

	:global(.prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6) {
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
		font-weight: 600;
	}

	:global(.prose h1:first-child, .prose h2:first-child, .prose h3:first-child) {
		margin-top: 0;
	}

	:global(.prose ul, .prose ol) {
		margin-top: 0.75rem;
		margin-bottom: 0.75rem;
		padding-left: 1.5rem;
	}

	:global(.prose li) {
		margin-top: 0.25rem;
		margin-bottom: 0.25rem;
	}

	:global(.prose a) {
		color: hsl(var(--primary));
		text-decoration: underline;
	}

	:global(.prose a:hover) {
		color: hsl(var(--primary) / 0.8);
	}

	:global(.prose strong) {
		font-weight: 600;
	}

	:global(.prose em) {
		font-style: italic;
	}

	:global(.prose code) {
		background-color: hsl(var(--muted));
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		font-size: 0.875em;
	}
</style>
