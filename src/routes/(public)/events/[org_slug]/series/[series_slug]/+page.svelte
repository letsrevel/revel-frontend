<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import { Calendar, ArrowLeft, ArrowDownUp, Settings } from '@lucide/svelte';
	import { EventCard } from '$lib/components/events';
	import { getImageUrl } from '$lib/utils/url';
	import { SeoHead } from '$lib/seo';
	import * as m from '$lib/paraglide/messages.js';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import FollowButton from '$lib/components/common/FollowButton.svelte';
	import SeriesPassCard from '$lib/components/series-passes/SeriesPassCard.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import Sticker from '$lib/components/brand/Sticker.svelte';
	import LogoChip from '$lib/components/brand/LogoChip.svelte';
	import { getPosterFallbackGradient } from '$lib/utils/fallback-gradient';

	const { data }: { data: PageData } = $props();

	const series = $derived(data.series);
	const seriesPasses = $derived(data.seriesPasses);
	const events = $derived(data.events);
	const totalCount = $derived(data.totalCount);
	const currentPage = $derived(data.page);
	const pageSize = $derived(data.pageSize);
	const orderBy = $derived(data.orderBy);

	// Compute full image URLs
	const coverUrl = $derived(getImageUrl(series.cover_art));
	// Prefer thumbnail for logo display (64-80px size)
	const logoUrl = $derived(getImageUrl(series.logo_thumbnail_url || series.logo));
	const orgLogoUrl = $derived(
		getImageUrl(series.organization.logo_thumbnail_url || series.organization.logo)
	);

	// Fallback cover, on the shared poster ramp (see utils/fallback-gradient.ts).
	const fallbackGradient = $derived(getPosterFallbackGradient(series.id));

	// Calculate pagination info
	const totalPages = $derived(Math.ceil(totalCount / pageSize));
	const hasNextPage = $derived(currentPage < totalPages);
	const hasPrevPage = $derived(currentPage > 1);
</script>

<SeoHead config={data.seo} />

<!-- `flex-col` so the tinted panel below can take `flex-1`: without it a short
     series (no passes, one event) leaves a bare `--background` strip under the
     wash, which reads as an unfinished page. -->
<div class="flex min-h-screen flex-col bg-background">
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
					class="absolute inset-0 bg-gradient-to-b from-transparent via-poster-ink/20 to-poster-ink/60"
				></div>
			{:else}
				<!-- Fallback gradient -->
				<div class="h-full w-full bg-gradient-to-br {fallbackGradient}"></div>
				<div class="absolute inset-0 bg-gradient-to-b from-poster-ink/10 to-poster-ink/60"></div>
			{/if}

			<!-- Series badge. The one Sticker on this page (celebration volume caps
			     them at one per viewport-height): a fixed-palette white sticker reads
			     identically over any cover art, in either theme. -->
			<div class="absolute right-4 top-4">
				<Sticker tint="purple" rotate={-3} class="text-sm">
					{m['eventSeriesDetailPage.badge_eventSeries']()}
				</Sticker>
			</div>
		</div>
	</section>

	<!--
		Poster ribbon (uplift, spec §9) — the event detail page's move, mirrored
		here because a series is the same kind of object: someone else's thing,
		put on by an organization. A solid brand-purple colour block under the
		cover carrying the org as a tilted white sticker, with `LogoChip` — the
		landing hero's mark-and-hearts chip — pinned to the far end.

		Ribbon, strip and chip are mode-INERT by the imagery rule (a poster panel
		is not a surface), so every pair on them is hand-verified against the
		fixed values; a poster-palette pair is invisible to
		scripts/audit-brand-themes.py (numbers are the audit script's own):
		  ink on white                   → 17.40:1
		  Hearty Purple #8C3CDD on white →  5.52:1 (the text-xs kicker clears AA)
		  white on crimson-DEEP          →  4.59:1 (the logo-less initial tile)
		The initial tile's gradient ends on `crimson-deep`, not raw
		`poster-crimson`: white on raw Light Crimson is 4.33:1, which fails AA
		for the tile's bold letter — the trap app.css documents at the
		`--poster-crimson-deep` declaration.
		Note: always the ORGANIZATION's logo/initial, never the series' own — the
		series keeps its mark in the header block below, and this ribbon answers
		"who is putting this on".
	-->
	<div class="bg-poster-purple">
		<!-- `container`, not the event header's `max-w-[1920px]`: that page's cover
		     is capped at 1920 so its ribbon matches it, whereas this cover is
		     edge-to-edge and the body below is a container — so the strip lines up
		     with the h1 it introduces. -->
		<div class="container relative mx-auto px-6 pb-6 md:px-8">
			<a
				href={resolve('/(public)/org/[slug]', { slug: series.organization.slug })}
				class="group -mt-8 inline-flex -rotate-1 items-center gap-3 rounded-[1.25rem] bg-poster-white p-3 shadow-poster-lg transition-transform hover:rotate-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-poster-white focus-visible:ring-offset-2 focus-visible:ring-offset-poster-purple"
			>
				{#if orgLogoUrl}
					<img
						src={orgLogoUrl}
						alt={m['eventHeader.organizationLogoAlt']({ name: series.organization.name })}
						class="h-12 w-12 rounded-md object-cover"
					/>
				{:else}
					<div
						class="flex h-12 w-12 items-center justify-center rounded-md bg-gradient-to-br from-poster-purple to-poster-crimson-deep text-lg font-black text-poster-white"
					>
						{series.organization.name.charAt(0).toUpperCase()}
					</div>
				{/if}

				<div class="flex flex-col pr-2">
					<span class="text-xs font-extrabold uppercase tracking-[0.12em] text-poster-purple">
						{m['eventHeader.organizedBy']()}
					</span>
					<span class="font-extrabold text-poster-ink">
						{series.organization.name}
					</span>
				</div>
			</a>
			<!-- Positioning lives on the wrapper: LogoChip owns its own `transform`
			     (the tilt), so a translate utility on the chip itself would be
			     overwritten. Anchored to the ribbon's BOTTOM so the chip grows
			     UPWARD over the cover — a sticker straddling the cut. Renders
			     nothing for a logo-less org (sticker-chip rule): the strip's
			     initial tile is the only identity mark then, which is the point. -->
			<div class="absolute bottom-3 right-8 hidden md:block">
				<LogoChip
					rotate={-8}
					logo={series.organization.logo}
					logoThumbnail={series.organization.logo_thumbnail_url}
				/>
			</div>
		</div>
	</div>

	<!--
		Tinted content panel — the event detail page's wash, so a series and the
		events it contains read as the same surface. Composite and therefore
		ratios are identical to that page's (a composited alpha is invisible to
		scripts/audit-brand-themes.py):
		  light — secondary@55 over background ⇒ hsl(231 88% 90%);
		          foreground 12.42:1 · muted-foreground 6.45:1 · primary 4.97:1
		  dark  — secondary@28 over background ⇒ hsl(246 33% 15%);
		          foreground 15.75:1 · muted-foreground 7.47:1 · primary 6.30:1
		Everything landing directly on it is covered: the h1 and section headings
		(`foreground`), the back link, tallies and blurbs (`muted-foreground`),
		and the SectionHeader kickers plus the org link (`primary`).
	-->
	<div class="flex-1 bg-secondary/55 dark:bg-secondary/[0.28]">
		<!-- Main Content -->
		<div class="container mx-auto px-6 py-8 md:px-8 lg:py-12">
			<!-- Back Button -->
			<div class="mb-6">
				<a
					href={resolve('/(public)/org/[slug]', { slug: series.organization.slug })}
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
						class="rounded-lg border-2 border-border bg-card p-4 shadow-poster"
						aria-label={m['seriesPublicPage.adminActionsLabel']()}
					>
						<h3 class="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-primary">
							{m['eventSeriesDetailPage.admin_title']()}
						</h3>
						<div class="space-y-2">
							<a
								href={resolve('/(auth)/org/[slug]/admin/event-series/[series_id]/edit', {
									slug: series.organization.slug,
									series_id: series.id
								})}
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
										class="h-16 w-16 rounded-lg object-cover shadow-poster md:h-20 md:w-20"
									/>
								{:else}
									<div
										class="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-xl font-black text-primary-foreground shadow-poster md:h-20 md:w-20 md:text-2xl"
									>
										{series.name.charAt(0).toUpperCase()}
									</div>
								{/if}
							</div>

							<!-- Series Info -->
							<div class="min-w-0 flex-1">
								<PageHeader
									volume="poster"
									kicker={m['eventSeriesCard.eventSeries']()}
									title={series.name}
									class="mb-2"
								/>

								<!-- Organization Link -->
								<a
									href={resolve('/(public)/org/[slug]', { slug: series.organization.slug })}
									class="mb-2 inline-block text-base font-bold text-primary hover:underline"
								>
									{m['eventSeriesDetailPage.byOrganization']({
										organizationName: series.organization.name
									})}
								</a>

								<!-- Tags -->
								{#if series.tags && series.tags.length > 0}
									<div class="mt-3 flex flex-wrap gap-2">
										{#each series.tags as tag (tag)}
											<span
												class="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary"
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
							class="rounded-lg border-2 bg-card p-6 shadow-poster md:p-8"
						>
							<h2 id="description-heading" class="sr-only">
								{m['eventSeriesDetailPage.description_heading']({ seriesName: series.name })}
							</h2>
							<MarkdownContent content={series.description} class="prose-slate" />
						</section>
					{/if}

					<!-- Season Passes Section -->
					{#if seriesPasses.length > 0}
						<section aria-labelledby="passes-heading">
							<div class="mb-6">
								<SectionHeader
									volume="celebration"
									id="passes-heading"
									title={m['seriesPass.sectionHeading']()}
								/>
								<p class="mt-1 text-sm text-muted-foreground">
									{m['seriesPass.sectionDescription']()}
								</p>
							</div>
							<div class="grid gap-4 sm:grid-cols-2">
								{#each seriesPasses as pass (pass.id)}
									<SeriesPassCard
										{pass}
										seriesId={series.id}
										isAuthenticated={data.isAuthenticated}
									/>
								{/each}
							</div>
						</section>
					{/if}

					<!-- Events Section -->
					<section aria-labelledby="events-heading">
						<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
							<div>
								<SectionHeader
									volume="celebration"
									id="events-heading"
									title={m['eventSeriesDetailPage.events_heading']()}
								/>
								{#if totalCount > 0}
									<p class="mt-1 text-sm text-muted-foreground">
										{m['eventSeriesDetailPage.events_count']({
											count: totalCount
										})}
									</p>
								{/if}
							</div>

							<!-- Sort Order Toggle -->
							<!-- eslint-disable svelte/no-navigation-without-resolve -- same-route query-only update; the relative "?"+params string preserves the current pathname (resolve() cannot express search params) -->
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
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</div>

						{#if events.length === 0}
							<EmptyState
								icon={Calendar}
								title={m['eventSeriesDetailPage.empty_title']()}
								body={m['eventSeriesDetailPage.empty_description']()}
							/>
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
									aria-label={m['seriesPublicPage.paginationLabel']()}
								>
									<!-- Results info -->
									<p class="text-sm text-muted-foreground">
										{m['eventSeriesDetailPage.pagination_showingPage']({ currentPage, totalPages })}
									</p>

									<!-- Pagination controls -->
									<div class="flex items-center gap-2">
										{#if hasPrevPage}
											<!-- eslint-disable svelte/no-navigation-without-resolve -- same-route query-only update; the relative "?"+params string preserves the current pathname (resolve() cannot express search params) -->
											<a
												href="?page={currentPage - 1}"
												class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
												aria-label={m['seriesPublicPage.goToPreviousPage']()}
											>
												{m['eventSeriesDetailPage.pagination_previous']()}
											</a>
											<!-- eslint-enable svelte/no-navigation-without-resolve -->
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
											<!-- eslint-disable svelte/no-navigation-without-resolve -- same-route query-only update; the relative "?"+params string preserves the current pathname (resolve() cannot express search params) -->
											<a
												href="?page={currentPage + 1}"
												class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
												aria-label={m['seriesPublicPage.goToNextPage']()}
											>
												{m['eventSeriesDetailPage.pagination_next']()}
											</a>
											<!-- eslint-enable svelte/no-navigation-without-resolve -->
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
							<div class="rounded-lg border-2 border-border bg-card p-4 shadow-poster">
								<h3 class="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-primary">
									{m['eventSeriesDetailPage.admin_title']()}
								</h3>
								<div class="space-y-2">
									<a
										href={resolve('/(auth)/org/[slug]/admin/event-series/[series_id]/edit', {
											slug: series.organization.slug,
											series_id: series.id
										})}
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
