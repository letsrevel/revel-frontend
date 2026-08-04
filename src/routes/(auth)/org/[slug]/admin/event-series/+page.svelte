<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import type { EventSeriesInListSchema } from '$lib/api/generated/types.gen';
	import { Repeat, Calendar, Edit, Eye, Tag, Plus, Folder } from '@lucide/svelte';
	import { getImageUrl } from '$lib/utils/url';
	import NewSeriesPickerDialog from '$lib/components/event-series/admin/NewSeriesPickerDialog.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ToneTile from '$lib/components/common/ToneTile.svelte';

	const { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);

	// "New series" → opens a picker that lets the organiser choose between
	// the recurring wizard and the empty-series form. The two flows are
	// equally valid (recurring is more common but neither is the "default")
	// — see the picker dialog component for the full copy.
	let showNewSeriesPicker = $state(false);

	function openNewSeriesPicker(): void {
		showNewSeriesPicker = true;
	}

	/**
	 * Navigate to the series dashboard. Metadata editing (name/description/logo/
	 * cover/tags) lives in the settings dialog there.
	 */
	function editSeries(seriesId: string): void {
		goto(
			resolve('/(auth)/org/[slug]/admin/event-series/[series_id]', {
				slug: organization.slug,
				series_id: seriesId
			})
		);
	}

	/**
	 * Navigate to public event series page
	 */
	function viewSeries(seriesSlug: string): void {
		goto(
			resolve('/(public)/events/[org_slug]/series/[series_slug]', {
				org_slug: organization.slug,
				series_slug: seriesSlug
			})
		);
	}

	/**
	 * Get event count for a series (from events array length, if present)
	 */
	function getEventCount(series: EventSeriesInListSchema): number {
		if ('events' in series && Array.isArray(series.events)) {
			return series.events.length;
		}
		return 0;
	}
</script>

<svelte:head>
	<title>{m['orgAdmin.eventSeries.pageTitle']()} - {organization.name} Admin | Revel</title>
	<meta
		name="description"
		content={m['orgAdmin.eventSeries.metaDescription']({ orgName: organization.name })}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	{#snippet headerActions()}
		<button
			type="button"
			onclick={openNewSeriesPicker}
			class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			data-testid="new-series-button"
		>
			<Plus class="h-5 w-5" aria-hidden="true" />
			{m['recurringEvents.seriesList.primaryCta']()}
		</button>
	{/snippet}
	<PageHeader
		kicker={m['orgAdmin.nav.eventSeries']()}
		title={m['orgAdmin.eventSeries.pageTitle']()}
		subtitle={m['orgAdmin.eventSeries.pageDescription']()}
		actions={headerActions}
	/>

	<!-- Empty state -->
	{#if data.series.length === 0}
		<EmptyState
			icon={Repeat}
			title={m['orgAdmin.eventSeries.empty.title']()}
			body={m['orgAdmin.eventSeries.empty.description']()}
		>
			{#snippet action()}
				<button
					type="button"
					onclick={openNewSeriesPicker}
					class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<Plus class="h-4 w-4" aria-hidden="true" />
					{m['recurringEvents.seriesList.primaryCta']()}
				</button>
			{/snippet}
		</EmptyState>
	{:else}
		<!-- Series List -->
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each data.series as series (series.id)}
				{@const isRecurring = series.is_recurring ?? false}
				{@const typeLabel = isRecurring
					? m['recurringEvents.newSeriesPicker.recurring.title']()
					: m['recurringEvents.newSeriesPicker.empty.title']()}
				<div class="relative rounded-lg border border-border bg-card p-4 shadow-sm">
					<!-- Corner type indicator: always visible so organisers can tell
					     recurring (Repeat) from grouping-only (Folder) even when a
					     logo is set. -->
					<span
						role="img"
						class="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground"
						title={typeLabel}
						aria-label={typeLabel}
					>
						{#if isRecurring}
							<Repeat class="h-3 w-3" aria-hidden="true" />
						{:else}
							<Folder class="h-3 w-3" aria-hidden="true" />
						{/if}
					</span>
					<div class="space-y-3">
						<!-- Logo and Header -->
						<div class="flex items-start gap-3 pr-8">
							{#if series.logo}
								<img
									src={getImageUrl(series.logo_thumbnail_url || series.logo)}
									alt="{series.name} logo"
									class="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
								/>
							{:else if isRecurring}
								<ToneTile tone="brand" icon={Repeat} size="lg" />
							{:else}
								<ToneTile tone="neutral" icon={Folder} size="lg" />
							{/if}
							<div class="min-w-0 flex-1">
								<h3 class="line-clamp-1 font-semibold">{series.name}</h3>
								<p class="text-sm text-muted-foreground">{series.organization.name}</p>
							</div>
						</div>

						<!-- Description -->
						{#if series.description}
							<p class="line-clamp-2 text-sm text-muted-foreground">
								{series.description}
							</p>
						{/if}

						<!-- Tags -->
						{#if series.tags && series.tags.length > 0}
							<div class="flex flex-wrap gap-1">
								{#each series.tags.slice(0, 3) as tag (tag)}
									<span
										class="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium"
									>
										<Tag class="h-3 w-3" aria-hidden="true" />
										{tag}
									</span>
								{/each}
								{#if series.tags.length > 3}
									<span
										class="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium"
									>
										{m['orgAdmin.eventSeries.tagsMore']({ count: series.tags.length - 3 })}
									</span>
								{/if}
							</div>
						{/if}

						<!-- Event Count (if available) -->
						{#if getEventCount(series) > 0}
							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								<Calendar class="h-4 w-4" aria-hidden="true" />
								{getEventCount(series)}
								{getEventCount(series) === 1 ? 'event' : 'events'}
							</div>
						{/if}

						<!-- Actions -->
						<div class="flex flex-wrap gap-2 border-t border-border pt-3">
							<button
								type="button"
								onclick={() => viewSeries(series.slug)}
								class="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								<Eye class="h-4 w-4" aria-hidden="true" />
								{m['orgAdmin.eventSeries.actions.view']()}
							</button>
							<button
								type="button"
								onclick={() => editSeries(series.id)}
								class="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								<Edit class="h-4 w-4" aria-hidden="true" />
								{m['orgAdmin.eventSeries.actions.edit']()}
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<NewSeriesPickerDialog
	bind:open={showNewSeriesPicker}
	organizationSlug={organization.slug}
	onClose={() => (showNewSeriesPicker = false)}
/>

<style>
	/* Ensure consistent focus states for accessibility */
	:global(button:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
