<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { EventSeriesRetrieveSchema } from '$lib/api/generated/types.gen';
	import { Repeat, Calendar, Edit, Eye, Tag, Plus } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);

	/**
	 * Navigate to create event series page
	 */
	function createSeries(): void {
		goto(`/org/${organization.slug}/admin/event-series/new`);
	}

	/**
	 * Navigate to edit event series page
	 */
	function editSeries(seriesId: string): void {
		goto(`/org/${organization.slug}/admin/event-series/${seriesId}/edit`);
	}

	/**
	 * Navigate to public event series page
	 */
	function viewSeries(seriesSlug: string): void {
		goto(`/events/${organization.slug}/series/${seriesSlug}`);
	}

	/**
	 * Get event count for a series (from events array length)
	 */
	function getEventCount(series: EventSeriesRetrieveSchema): number {
		// EventSeriesRetrieveSchema might have an events array or count
		// Check if the type has this field
		if ('events' in series && Array.isArray(series.events)) {
			return series.events.length;
		}
		return 0;
	}
</script>

<svelte:head>
	<title>Event Series - {organization.name} Admin | Revel</title>
	<meta name="description" content="Manage event series for {organization.name}" />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">Event Series</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Manage recurring event series for your organization
			</p>
		</div>

		<button
			type="button"
			onclick={createSeries}
			class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			<Plus class="h-5 w-5" aria-hidden="true" />
			Create Series
		</button>
	</div>

	<!-- Empty state -->
	{#if data.series.length === 0}
		<div class="rounded-lg border border-border bg-card p-12 text-center">
			<Repeat class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<h3 class="mt-4 text-lg font-semibold">No event series yet</h3>
			<p class="mt-2 text-sm text-muted-foreground">
				Get started by creating your first event series
			</p>
			<button
				type="button"
				onclick={createSeries}
				class="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<Plus class="h-4 w-4" aria-hidden="true" />
				Create Event Series
			</button>
		</div>
	{:else}
		<!-- Series List -->
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each data.series as series (series.id)}
				<div class="rounded-lg border border-border bg-card p-4 shadow-sm">
					<div class="space-y-3">
						<!-- Logo and Header -->
						<div class="flex items-start gap-3">
							{#if series.logo}
								<img
									src={series.logo}
									alt="{series.name} logo"
									class="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
								/>
							{:else}
								<div
									class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950"
								>
									<Repeat class="h-6 w-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
								</div>
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
								{#each series.tags.slice(0, 3) as tag}
									<span
										class="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium"
									>
										<Tag class="h-3 w-3" aria-hidden="true" />
										{tag}
									</span>
								{/each}
								{#if series.tags.length > 3}
									<span class="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium">
										+{series.tags.length - 3} more
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
								View
							</button>
							<button
								type="button"
								onclick={() => editSeries(series.id)}
								class="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								<Edit class="h-4 w-4" aria-hidden="true" />
								Edit
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* Ensure consistent focus states for accessibility */
	:global(button:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
