<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { TicketAttributionBucketSchema } from '$lib/api/generated/types.gen';
	import { sanitizeUtmValue } from '$lib/utils/attribution';

	interface Props {
		buckets: TicketAttributionBucketSchema[];
		/** The page's current URL — row hrefs are derived from it (pure component). */
		currentUrl: URL;
		/**
		 * Whether tagged buckets render as filter links (default `true`). Set to `false` for
		 * aggregate views (e.g. the org-wide breakdown) that have no single ticket list to filter —
		 * every bucket then renders as a plain row and the "Filtered by" chip never appears.
		 */
		filterable?: boolean;
		/**
		 * Whether the card renders its own "Sales by source" heading (default `true`). Set to
		 * `false` when a caller already renders an equivalent heading above the card (e.g. the
		 * org-wide page's `SectionHeader`) so the visible heading isn't duplicated. The table's
		 * sr-only caption still gives the table an accessible name either way.
		 */
		showHeading?: boolean;
	}
	const { buckets, currentUrl, filterable = true, showHeading = true }: Props = $props();

	const isDirect = (b: TicketAttributionBucketSchema) =>
		!b.utm_source && !b.utm_medium && !b.utm_campaign && !b.utm_content;

	/** A bucket can only be filtered on by row link when it carries a source or campaign tag. */
	const hasUtmIdentity = (b: TicketAttributionBucketSchema) =>
		Boolean(b.utm_source) || Boolean(b.utm_campaign);

	const bucketKey = (b: TicketAttributionBucketSchema) =>
		JSON.stringify([b.utm_source, b.utm_medium, b.utm_campaign, b.utm_content]);

	/** Rows rendered as filter links: real source and/or campaign tags. */
	const linkable = $derived(buckets.filter((b) => !isDirect(b) && hasUtmIdentity(b)));
	/** Rows with only medium/content (no source, no campaign): shown, not linkable, not "active". */
	const untagged = $derived(buckets.filter((b) => !isDirect(b) && !hasUtmIdentity(b)));
	const tagged = $derived([...linkable, ...untagged]);
	const direct = $derived(buckets.find(isDirect) ?? null);

	const activeSource = $derived(sanitizeUtmValue(currentUrl.searchParams.get('utm_source')));
	const activeCampaign = $derived(sanitizeUtmValue(currentUrl.searchParams.get('utm_campaign')));
	const isFiltered = $derived(filterable && (activeSource !== null || activeCampaign !== null));
	const filteredLabel = $derived([activeSource, activeCampaign].filter(Boolean).join(' · '));

	function rowHref(bucket: TicketAttributionBucketSchema): string {
		const url = new URL(currentUrl);
		url.searchParams.delete('page');
		url.searchParams.delete('utm_source');
		url.searchParams.delete('utm_campaign');
		if (bucket.utm_source) url.searchParams.set('utm_source', bucket.utm_source);
		if (bucket.utm_campaign) url.searchParams.set('utm_campaign', bucket.utm_campaign);
		return url.pathname + url.search;
	}

	function clearHref(): string {
		const url = new URL(currentUrl);
		url.searchParams.delete('page');
		url.searchParams.delete('utm_source');
		url.searchParams.delete('utm_campaign');
		return url.pathname + url.search;
	}

	const isActive = (b: TicketAttributionBucketSchema) =>
		(b.utm_source ?? null) === activeSource && (b.utm_campaign ?? null) === activeCampaign;
</script>

<div class="rounded-lg border bg-card p-4">
	{#if showHeading || isFiltered}
		<div class="flex flex-wrap items-center justify-between gap-2">
			{#if showHeading}
				<h2 class="font-bold">{m['tickets.salesBySource.title']()}</h2>
			{/if}
			{#if isFiltered}
				<div class="flex items-center gap-2 text-xs text-muted-foreground">
					<span>{m['tickets.salesBySource.filteredBy']({ label: filteredLabel })}</span>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- this card is pure w.r.t. navigation: it derives hrefs from an arbitrary caller-supplied currentUrl, not a known route id, so resolve() cannot express them -->
					<a
						href={clearHref()}
						data-sveltekit-replacestate
						data-sveltekit-keepfocus
						class="rounded-full border px-3 py-1 font-medium hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					>
						{m['tickets.salesBySource.clearFilter']()}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</div>
			{/if}
		</div>
	{/if}

	{#if tagged.length === 0}
		<p class="mt-3 text-sm text-muted-foreground">{m['tickets.salesBySource.allDirect']()}</p>
	{:else}
		<div class="mt-3 overflow-x-auto">
			<table class="w-full text-sm">
				<caption class="sr-only">{m['tickets.salesBySource.caption']()}</caption>
				<thead>
					<tr class="border-b text-left text-xs text-muted-foreground">
						<th scope="col" class="py-2 pr-4 font-medium">{m['tickets.salesBySource.source']()}</th>
						<th scope="col" class="py-2 text-right font-medium"
							>{m['tickets.salesBySource.tickets']()}</th
						>
					</tr>
				</thead>
				<tbody>
					{#each linkable as bucket (bucketKey(bucket))}
						<tr class="border-b border-border/50 last:border-0">
							<td class="py-2 pr-4">
								{#if filterable}
									<!-- eslint-disable svelte/no-navigation-without-resolve -- this card is pure w.r.t. navigation: it derives hrefs from an arbitrary caller-supplied currentUrl, not a known route id, so resolve() cannot express them -->
									<a
										href={rowHref(bucket)}
										data-sveltekit-replacestate
										data-sveltekit-keepfocus
										aria-current={isActive(bucket) ? 'true' : undefined}
										aria-label={m['tickets.salesBySource.filterRow']({
											label: [bucket.utm_source, bucket.utm_campaign].filter(Boolean).join(' · ')
										})}
										class="-mx-1 flex flex-col rounded-md border-l-2 border-l-transparent px-1 py-0.5 hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[current=true]:border-l-primary aria-[current=true]:bg-secondary aria-[current=true]:pl-2 aria-[current=true]:font-semibold"
									>
										<span class="font-medium"
											>{bucket.utm_source ?? '—'}{#if bucket.utm_campaign}<span
													class="text-muted-foreground"
												>
													· {bucket.utm_campaign}</span
												>{/if}</span
										>
										{#if bucket.utm_medium || bucket.utm_content}
											<span class="text-xs text-muted-foreground">
												{[bucket.utm_medium, bucket.utm_content].filter(Boolean).join(' · ')}
											</span>
										{/if}
									</a>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
								{:else}
									<div class="flex flex-col">
										<span class="font-medium"
											>{bucket.utm_source ?? '—'}{#if bucket.utm_campaign}<span
													class="text-muted-foreground"
												>
													· {bucket.utm_campaign}</span
												>{/if}</span
										>
										{#if bucket.utm_medium || bucket.utm_content}
											<span class="text-xs text-muted-foreground">
												{[bucket.utm_medium, bucket.utm_content].filter(Boolean).join(' · ')}
											</span>
										{/if}
									</div>
								{/if}
							</td>
							<td class="py-2 text-right tabular-nums">{bucket.count}</td>
						</tr>
					{/each}
					{#each untagged as bucket (bucketKey(bucket))}
						<tr class="border-b border-border/50 last:border-0">
							<td class="py-2 pr-4 text-muted-foreground">
								<div class="flex flex-col">
									<span>—</span>
									{#if bucket.utm_medium || bucket.utm_content}
										<span class="text-xs">
											{[bucket.utm_medium, bucket.utm_content].filter(Boolean).join(' · ')}
										</span>
									{/if}
								</div>
							</td>
							<td class="py-2 text-right tabular-nums">{bucket.count}</td>
						</tr>
					{/each}
					{#if direct}
						<tr>
							<td class="py-2 pr-4 text-muted-foreground">{m['tickets.salesBySource.direct']()}</td>
							<td class="py-2 text-right tabular-nums">{direct.count}</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</div>
