<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages.js';
	import { formatEventDate } from '$lib/utils/date';
	import EventStatusBadge from '$lib/components/events/EventStatusBadge.svelte';
	import { Ticket, ChevronRight, Users } from '@lucide/svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import SalesBySourceCard from '$lib/components/tickets/SalesBySourceCard.svelte';
	import {
		sinceForPreset,
		presetForSince,
		SELECTABLE_SINCE_PRESETS,
		type SincePreset
	} from '$lib/utils/attribution-presets';

	const { data }: { data: PageData } = $props();

	const slug = $derived(data.organization.slug);
	const events = $derived(data.events);

	// ─── Org-wide "Sales by source" (#880 follow-up) ────────────────────────
	const attributionBreakdown = $derived(data.attributionBreakdown ?? null);
	const since = $derived(data.since ?? null);
	const eventIds = $derived(data.eventIds ?? []);
	const activePreset = $derived(presetForSince(since));
	const hasActiveFilter = $derived(since !== null || eventIds.length > 0);
	const bucketCount = $derived(attributionBreakdown?.length ?? 0);
	// Shown when there's data to show OR a filter is active (so an empty
	// filtered result doesn't strand the controls with no way to clear them).
	const showSalesSection = $derived(
		(attributionBreakdown !== null && attributionBreakdown.length > 0) || hasActiveFilter
	);
	const showEmptyFiltered = $derived(
		hasActiveFilter && (attributionBreakdown === null || attributionBreakdown.length === 0)
	);
	const eventFilterLabel = $derived(
		eventIds.length === 0
			? m['orgAdmin.tickets.salesBySource.eventFilterAll']()
			: m['orgAdmin.tickets.salesBySource.eventFilterCount']({ count: eventIds.length })
	);

	function sincePresetLabel(preset: SincePreset): string {
		switch (preset) {
			case 'all':
				return m['orgAdmin.tickets.salesBySource.sincePresetAll']();
			case 'last7':
				return m['orgAdmin.tickets.salesBySource.sincePresetLast7']();
			case 'last30':
				return m['orgAdmin.tickets.salesBySource.sincePresetLast30']();
			case 'last90':
				return m['orgAdmin.tickets.salesBySource.sincePresetLast90']();
			case 'thisYear':
				return m['orgAdmin.tickets.salesBySource.sincePresetThisYear']();
			case 'custom':
				return m['orgAdmin.tickets.salesBySource.sincePresetCustom']();
		}
	}

	/** Mutates a clone of the current URL and navigates to it, preserving
	 * every param this feature doesn't touch. */
	function updateUrl(mutate: (url: URL) => void) {
		const url = new URL($page.url);
		mutate(url);
		const query = url.searchParams.toString();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-route query-only update; the relative path+"?"+params string preserves the current pathname (resolve() cannot express search params)
		goto(`${url.pathname}${query ? `?${query}` : ''}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function selectSincePreset(preset: SincePreset) {
		updateUrl((url) => {
			url.searchParams.delete('since');
			const iso = sinceForPreset(preset);
			if (iso) url.searchParams.set('since', iso);
		});
	}

	function toggleEventFilter(eventId: string, checked: boolean) {
		updateUrl((url) => {
			const next = checked ? [...eventIds, eventId] : eventIds.filter((id) => id !== eventId);
			url.searchParams.delete('event_ids');
			for (const id of next) url.searchParams.append('event_ids', id);
		});
	}
</script>

<svelte:head>
	<title>{m['orgAdmin.tickets.title']()} · {data.organization.name}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="space-y-6">
	<PageHeader title={m['orgAdmin.tickets.title']()} subtitle={m['orgAdmin.tickets.subtitle']()} />

	{#if showSalesSection}
		<div class="space-y-4">
			<SectionHeader title={m['orgAdmin.tickets.salesBySource.title']()} />

			<div class="flex flex-wrap items-center gap-3">
				<Select.Root
					type="single"
					value={activePreset === 'custom' ? '' : activePreset}
					onValueChange={(v) => {
						if (v) selectSincePreset(v as SincePreset);
					}}
				>
					<Select.Trigger
						class="w-full sm:w-52"
						aria-label={m['orgAdmin.tickets.salesBySource.sinceAriaLabel']()}
					>
						{sincePresetLabel(activePreset)}
					</Select.Trigger>
					<Select.Content>
						{#each SELECTABLE_SINCE_PRESETS as preset (preset)}
							<Select.Item value={preset}>{sincePresetLabel(preset)}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>

				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="outline"
								class="gap-2"
								aria-label={m['orgAdmin.tickets.salesBySource.eventFilterAriaLabel']()}
							>
								{eventFilterLabel}
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="start" class="w-64">
						{#each events as event (event.id)}
							<DropdownMenu.CheckboxItem
								checked={eventIds.includes(event.id)}
								onCheckedChange={(checked) => toggleEventFilter(event.id, checked)}
							>
								{event.name}
							</DropdownMenu.CheckboxItem>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>

			<!-- Announces the visible bucket-row count whenever the since/event
			     filters change what the card shows (WCAG 4.1.3). -->
			<div role="status" aria-live="polite" class="sr-only">
				{m['orgAdmin.tickets.salesBySource.resultsAnnouncement']({ count: bucketCount })}
			</div>

			{#if showEmptyFiltered}
				<p class="text-sm text-muted-foreground">
					{m['orgAdmin.tickets.salesBySource.noResults']()}
				</p>
			{:else if attributionBreakdown}
				<SalesBySourceCard
					buckets={attributionBreakdown}
					currentUrl={$page.url}
					filterable={false}
					showHeading={false}
				/>
			{/if}
		</div>
	{/if}

	{#if events.length === 0}
		{#snippet goToEventsAction()}
			<Button href={resolve('/(auth)/org/[slug]/admin/events', { slug: slug })}>
				{m['orgAdmin.tickets.empty.cta']()}
			</Button>
		{/snippet}
		<EmptyState
			icon={Ticket}
			level={2}
			title={m['orgAdmin.tickets.empty.title']()}
			body={m['orgAdmin.tickets.empty.description']()}
			action={goToEventsAction}
		/>
	{:else}
		<ul class="space-y-3">
			{#each events as event (event.id)}
				<li>
					<a
						href={resolve('/(auth)/org/[slug]/admin/events/[event_id]/tickets', {
							slug: slug,
							event_id: event.id
						})}
						class="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{#if event.logo_thumbnail_url}
							<img
								src={event.logo_thumbnail_url}
								alt=""
								class="h-12 w-12 shrink-0 rounded-md object-cover"
							/>
						{:else}
							<div
								class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted"
								aria-hidden="true"
							>
								<Ticket class="h-6 w-6 text-muted-foreground" />
							</div>
						{/if}

						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<span class="truncate font-bold">{event.name}</span>
								<EventStatusBadge {event} />
							</div>
							<div
								class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"
							>
								<span>{formatEventDate(event.start, event.timezone)}</span>
								<!-- Staff see the real numbers, but the field is nullable since
								     #825 — omit the tally rather than render a fabricated zero. -->
								{#if event.attendee_count != null}
									<span class="inline-flex items-center gap-1">
										<Users class="h-3.5 w-3.5" aria-hidden="true" />
										{m['orgAdmin.tickets.attendees']({ count: event.attendee_count })}
									</span>
								{/if}
							</div>
						</div>

						<ChevronRight class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
