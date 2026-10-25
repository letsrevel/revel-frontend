<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { cn } from '$lib/utils';
	import { withUtmParams } from '$lib/utils/attribution';
	import { getImageUrl } from '$lib/utils/url';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import type { MinimalEventSeriesSchema } from '$lib/api/generated/types.gen';
	import * as m from '$lib/paraglide/messages.js';
	import { ArrowRight } from '@lucide/svelte';

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

	// The series' own mark only — the organization already has its card above.
	// Thumbnail first, full-size logo if the thumbnail fails to load. Failures
	// are remembered per URL, so a different series starts clean.
	const logoCandidates = $derived(
		[series.logo_thumbnail_url, series.logo]
			.map((path) => getImageUrl(path))
			.filter((url): url is string => !!url)
	);
	let failedLogoUrls = $state<string[]>([]);
	const logoUrl = $derived(logoCandidates.find((url) => !failedLogoUrls.includes(url)) ?? null);
</script>

<!--
	The card is not one big link: the description is rendered markdown, and its
	links would nest inside an outer <a>. The name and the "View series" CTA are
	the two (same-destination) links instead.
	`seriesHref` is resolve()d then carries UTM tags (#880); the eslint rule
	can't see through the wrapper, so it's disabled for these elements only.
-->
<section
	aria-labelledby={headingId}
	class={cn('rounded-lg border-2 bg-card shadow-poster', className)}
>
	<div class="border-b p-4">
		<SectionHeader volume="celebration" id={headingId} title={m['eventDetails.series_heading']()} />
	</div>
	<div class="space-y-3 p-4">
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href={seriesHref}
			class="flex items-center gap-3 rounded-md font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			{#if logoUrl}
				<img
					src={logoUrl}
					alt=""
					class="h-12 w-12 shrink-0 rounded-md object-cover"
					loading="lazy"
					onerror={() => (failedLogoUrls = [...failedLogoUrls, logoUrl])}
				/>
			{/if}
			<span>{series.name}</span>
		</a>
		<MarkdownContent content={series.description} class="text-muted-foreground" />
		<a
			href={seriesHref}
			class="inline-flex items-center gap-1 rounded-md text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			{m['eventDetails.series_viewSeries']()}
			<ArrowRight class="h-4 w-4" aria-hidden="true" />
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</div>
</section>
