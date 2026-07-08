<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { seriespassListSeriesPasses } from '$lib/api';
	import { seriesPassQueryKeys } from '$lib/queries/series-passes';
	import { createQuery } from '@tanstack/svelte-query';
	import { CalendarRange, ArrowRight } from '@lucide/svelte';

	interface Props {
		seriesId: string;
		orgSlug: string;
		seriesSlug: string;
	}

	const { seriesId, orgSlug, seriesSlug }: Props = $props();

	// Public, visibility-aware endpoint (auth is injected by the client
	// interceptor when logged in, so members-only passes count too). The banner
	// renders nothing while loading, on error, or when the series has no passes
	// on sale — a pure progressive enhancement of the event page.
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

	const hasPasses = $derived((passesQuery.data?.length ?? 0) > 0);
</script>

{#if hasPasses}
	<a
		href={resolve('/(public)/events/[org_slug]/series/[series_slug]', {
			org_slug: orgSlug,
			series_slug: seriesSlug
		})}
		class="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
	>
		<CalendarRange class="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
		<span class="min-w-0 flex-1 text-sm">
			<span class="font-medium">{m['seriesPass.eventHintTitle']()}</span>
			<span class="block text-muted-foreground">{m['seriesPass.eventHintCta']()}</span>
		</span>
		<ArrowRight class="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
	</a>
{/if}
