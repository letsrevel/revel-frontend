<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { cn } from '$lib/utils';
	import { withUtmParams } from '$lib/utils/attribution';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import type { MinimalEventSeriesSchema } from '$lib/api/generated/types.gen';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		series: MinimalEventSeriesSchema;
		orgSlug: string;
		/** Applied to the section's `aria-labelledby`/heading `id` — the mobile
		 * and desktop instances on the event page keep distinct ids so the two
		 * (one hidden per breakpoint) never collide. */
		headingId: string;
		class?: string;
	}

	const { series, orgSlug, headingId, class: className = '' }: Props = $props();

	// Carry campaign tags across public surfaces (#880): identical output when
	// the current URL has no utm_* (so authed/dashboard usage is unaffected).
	const seriesHref = $derived(
		withUtmParams(
			resolve('/(public)/events/[org_slug]/series/[series_slug]', {
				org_slug: orgSlug,
				series_slug: series.slug
			}),
			page.url
		)
	);
</script>

<section
	aria-labelledby={headingId}
	class={cn('rounded-lg border-2 bg-card shadow-poster', className)}
>
	<div class="border-b p-4">
		<SectionHeader volume="celebration" id={headingId} title={m['eventDetails.series_heading']()} />
	</div>
	<!--
		`seriesHref` is resolve()d then carries UTM tags (#880); the eslint rule
		can't see through the wrapper, so it's disabled for this element only.
	-->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		href={seriesHref}
		class="block p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
	>
		<div class="font-bold">{series.name}</div>
		{#if series.description}
			<p class="mt-1 text-sm text-muted-foreground">
				{series.description}
			</p>
		{/if}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</section>
