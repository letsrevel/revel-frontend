<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { seriespassListSeriesPasses } from '$lib/api';
	import { seriesPassQueryKeys } from '$lib/queries/series-passes';
	import { createQuery } from '@tanstack/svelte-query';
	import { ArrowRight } from '@lucide/svelte';
	import SeriesPassCard from './SeriesPassCard.svelte';

	interface Props {
		seriesId: string;
		orgSlug: string;
		seriesSlug: string;
		isAuthenticated: boolean;
	}

	const { seriesId, orgSlug, seriesSlug, isAuthenticated }: Props = $props();

	// Public, visibility-aware endpoint (the client interceptor injects auth when
	// logged in, so members-only passes count too). Renders nothing while
	// loading, on error, or when the series has no passes on sale — a pure
	// progressive enhancement of the event's ticket section.
	const passesQuery = createQuery(() => ({
		queryKey: seriesPassQueryKeys.list(seriesId),
		queryFn: async () => {
			const response = await seriespassListSeriesPasses({
				path: { series_id: seriesId }
			});
			if (response.error || !response.data) {
				throw new Error('Failed to load series passes');
			}
			return response.data;
		}
	}));

	const passes = $derived(passesQuery.data ?? []);
</script>

{#if passes.length > 0}
	<section aria-labelledby="event-passes-heading" class="space-y-3">
		<div class="flex flex-wrap items-baseline justify-between gap-2">
			<h2 id="event-passes-heading" class="text-xl font-semibold">
				{m['seriesPass.sectionHeading']()}
			</h2>
			<a
				href={resolve('/(public)/events/[org_slug]/series/[series_slug]', {
					org_slug: orgSlug,
					series_slug: seriesSlug
				})}
				class="inline-flex items-center gap-1 text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				{m['seriesPass.viewSeriesLink']()}
				<ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
			</a>
		</div>
		<div class="space-y-3">
			{#each passes as pass (pass.id)}
				<SeriesPassCard {pass} {seriesId} {isAuthenticated} />
			{/each}
		</div>
	</section>
{/if}
