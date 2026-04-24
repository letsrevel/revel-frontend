<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { ArrowLeft, AlertTriangle, Pause } from 'lucide-svelte';
	import type { PageData } from './$types';
	import {
		organizationadminrecurringeventsGetSeriesDetail,
		organizationadminrecurringeventsGetSeriesDrift,
		eventpublicdiscoveryListEvents
	} from '$lib/api';
	import type {
		EventSeriesRecurrenceDetailSchema,
		EventSeriesDriftSchema,
		EventInListSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { seriesQueryKeys } from '$lib/queries/event-series';
	import SeriesHeaderCard from '$lib/components/event-series/admin/SeriesHeaderCard.svelte';
	import OccurrenceRow from '$lib/components/event-series/admin/OccurrenceRow.svelte';
	import ExdatesChipList from '$lib/components/event-series/admin/ExdatesChipList.svelte';
	import CadenceDriftBanner from '$lib/components/event-series/admin/CadenceDriftBanner.svelte';
	import SeriesSettingsDialog from '$lib/components/event-series/admin/SeriesSettingsDialog.svelte';
	import TemplateEditDialog from '$lib/components/event-series/admin/TemplateEditDialog.svelte';
	import RecurrenceEditDialog from '$lib/components/event-series/admin/RecurrenceEditDialog.svelte';
	import CancelOccurrenceDialog from '$lib/components/event-series/admin/CancelOccurrenceDialog.svelte';
	import GenerateNowButton from '$lib/components/event-series/admin/GenerateNowButton.svelte';
	import PauseResumeButton from '$lib/components/event-series/admin/PauseResumeButton.svelte';
	import CancelDriftedOccurrencesDialog from '$lib/components/event-series/admin/CancelDriftedOccurrencesDialog.svelte';

	const { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);

	// Server-authoritative data — seeded into TanStack Query so Phase 3 mutations
	// can invalidate by key and trigger a refetch without re-running the server load.
	const detailQuery = createQuery<EventSeriesRecurrenceDetailSchema>(() => ({
		queryKey: seriesQueryKeys.recurrenceDetail(organization.slug, data.seriesId),
		queryFn: async () => {
			const response = await organizationadminrecurringeventsGetSeriesDetail({
				path: { slug: organization.slug, series_id: data.seriesId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error || !response.data) throw new Error('Failed to load event series');
			return response.data;
		},
		initialData: data.series
	}));

	const driftQuery = createQuery<EventSeriesDriftSchema>(() => ({
		queryKey: seriesQueryKeys.drift(organization.slug, data.seriesId),
		queryFn: async () => {
			const response = await organizationadminrecurringeventsGetSeriesDrift({
				path: { slug: organization.slug, series_id: data.seriesId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error || !response.data) throw new Error('Failed to load drift state');
			return response.data;
		},
		initialData: data.drift
	}));

	const upcomingQuery = createQuery<EventInListSchema[]>(() => ({
		queryKey: seriesQueryKeys.occurrences(data.seriesId, { past: false }),
		queryFn: async () => {
			const response = await eventpublicdiscoveryListEvents({
				query: {
					event_series: data.seriesId,
					include_past: false,
					order_by: 'start',
					page_size: 100
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error('Failed to load upcoming occurrences');
			return response.data?.results ?? [];
		},
		initialData: data.upcoming
	}));

	// Past occurrences load lazily once the user switches tabs — cheap to skip on
	// first paint, and historically long. `enabled` is the only gate.
	let activeTab = $state<'upcoming' | 'past'>('upcoming');

	const pastQuery = createQuery<EventInListSchema[]>(() => ({
		queryKey: seriesQueryKeys.occurrences(data.seriesId, { past: true }),
		queryFn: async () => {
			const response = await eventpublicdiscoveryListEvents({
				query: {
					event_series: data.seriesId,
					include_past: true,
					past_events: true,
					order_by: '-start',
					page_size: 100
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error('Failed to load past occurrences');
			return response.data?.results ?? [];
		},
		enabled: activeTab === 'past'
	}));

	const series = $derived(detailQuery.data);
	const drift = $derived(driftQuery.data ?? { stale_occurrences: [] });
	const staleIds = $derived(new Set<string>(drift.stale_occurrences ?? []));
	const upcoming = $derived(upcomingQuery.data ?? []);
	const past = $derived(pastQuery.data ?? []);

	// Filter templates out of any occurrence list — they live inside the series
	// but never appear on the attendee surface, and they'd just confuse the list.
	const upcomingOccurrences = $derived(upcoming.filter((e: EventInListSchema) => !e.is_template));
	const pastOccurrences = $derived(past.filter((e: EventInListSchema) => !e.is_template));
	// Drifted occurrences fed to the bulk-cancel dialog — upcoming ∩ staleIds.
	// The backend's drift endpoint guarantees these are upcoming, non-cancelled,
	// non-template rows, so a second-order filter here is just a safety net.
	const driftedOccurrences = $derived(
		upcomingOccurrences.filter((e: EventInListSchema) => staleIds.has(e.id))
	);

	const exdates = $derived(series?.exdates ?? []);
	const hasRecurrenceRule = $derived(!!series?.recurrence_rule);
	const hasTemplate = $derived(!!series?.template_event);
	const isDegraded = $derived(!hasRecurrenceRule || !hasTemplate);
	const isPaused = $derived(series && series.is_active === false);
	// Appendix F: Phase 3 mutating endpoints accept either `create_event` or
	// `edit_event_series`. `canManageRecurring` (set on the admin layout) is
	// the union and gates every header-action + row-action + drift-banner
	// entry point on this dashboard.
	const canEdit = $derived($page.data.canManageRecurring === true);

	// Series-settings dialog. Auto-opens when the dashboard is loaded with
	// `?settings=open` (the 301 redirect from the retired `/edit` route sets this
	// query param). We clean the param from the URL after honouring it once so
	// it doesn't reopen the dialog on every re-render or on refresh.
	let showSeriesSettings = $state(false);
	let showTemplateEdit = $state(false);
	let showRecurrenceEdit = $state(false);
	let showCancelOccurrence = $state(false);
	let showGenerateNow = $state(false);
	let showPauseResume = $state(false);
	let showDriftBulkCancel = $state(false);
	// `null` → header-mode picker; ISO string → row-mode prefill. The dashboard
	// flips this before setting `showCancelOccurrence=true` so the dialog's
	// open-effect seed picks up the right source.
	let cancelOccurrenceInitialDate = $state<string | null>(null);
	let hasHandledSettingsParam = $state(false);

	function openCancelOccurrenceFromRow(event: EventInListSchema): void {
		cancelOccurrenceInitialDate = event.start;
		showCancelOccurrence = true;
	}

	function openCancelOccurrenceFromHeader(): void {
		cancelOccurrenceInitialDate = null;
		showCancelOccurrence = true;
	}

	$effect(() => {
		if (hasHandledSettingsParam) return;
		if ($page.url.searchParams.get('settings') === 'open') {
			showSeriesSettings = true;
			hasHandledSettingsParam = true;
			if (typeof window !== 'undefined') {
				const url = new URL($page.url);
				url.searchParams.delete('settings');
				window.history.replaceState({}, '', url.toString());
			}
		}
	});

	function goBack(): void {
		goto(`/org/${organization.slug}/admin/event-series`);
	}
</script>

<svelte:head>
	<title
		>{m['recurringEvents.dashboard.title']({ seriesName: series?.name ?? '' })} - {organization.name}
		Admin | Revel</title
	>
	<meta
		name="description"
		content={m['recurringEvents.dashboard.pageDescription']({ seriesName: series?.name ?? '' })}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-start gap-4">
		<button
			type="button"
			onclick={goBack}
			class="mt-1 rounded-md p-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			aria-label={m['eventSeriesNewPage.backAriaLabel']()}
		>
			<ArrowLeft class="h-5 w-5" aria-hidden="true" />
		</button>
		<div class="min-w-0 flex-1">
			{#if series}
				<SeriesHeaderCard
					{series}
					{canEdit}
					onSeriesSettings={() => (showSeriesSettings = true)}
					onEditTemplate={() => (showTemplateEdit = true)}
					onEditRecurrence={() => (showRecurrenceEdit = true)}
					onCancelOccurrence={openCancelOccurrenceFromHeader}
					onGenerateNow={() => (showGenerateNow = true)}
					onPauseResume={() => (showPauseResume = true)}
				/>
			{/if}
		</div>
	</div>

	<!-- Degraded state (repair banner) -->
	{#if isDegraded}
		<div
			class="border-warning/50 bg-warning/10 flex items-start gap-3 rounded-lg border p-4 text-sm"
			role="alert"
		>
			<AlertTriangle
				class="text-warning-foreground mt-0.5 h-5 w-5 flex-shrink-0"
				aria-hidden="true"
			/>
			<div class="flex-1 space-y-1">
				<p class="font-medium">{m['recurringEvents.dashboard.repairSeriesBanner']()}</p>
				<a
					href="mailto:contact@letsrevel.io?subject=Repair%20event%20series%20{data.seriesId}"
					class="inline-block text-sm underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					contact@letsrevel.io
				</a>
			</div>
		</div>
	{:else if isPaused}
		<div
			class="flex items-start gap-3 rounded-lg border border-border bg-muted p-4 text-sm"
			role="status"
		>
			<Pause class="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
			<p class="flex-1">{m['recurringEvents.dashboard.pausedBanner']()}</p>
		</div>
	{/if}

	<!-- Drift banner -->
	<CadenceDriftBanner
		count={staleIds.size}
		{canEdit}
		onBulkCancel={() => (showDriftBulkCancel = true)}
	/>

	<!-- Tabs -->
	<div class="border-b border-border">
		<nav class="-mb-px flex gap-4" aria-label="Occurrence tabs">
			<button
				type="button"
				onclick={() => (activeTab = 'upcoming')}
				class="border-b-2 px-1 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {activeTab ===
				'upcoming'
					? 'border-primary text-primary'
					: 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}"
				aria-current={activeTab === 'upcoming' ? 'page' : undefined}
			>
				{m['recurringEvents.dashboard.upcomingHeading']()}
				<span class="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
					{upcomingOccurrences.length}
				</span>
			</button>
			<button
				type="button"
				onclick={() => (activeTab = 'past')}
				class="border-b-2 px-1 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {activeTab ===
				'past'
					? 'border-primary text-primary'
					: 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}"
				aria-current={activeTab === 'past' ? 'page' : undefined}
			>
				{m['recurringEvents.dashboard.pastHeading']()}
			</button>
		</nav>
	</div>

	<!-- Occurrences list -->
	{#if activeTab === 'upcoming'}
		<section id="upcoming-occurrences" aria-labelledby="upcoming-heading">
			<h2 id="upcoming-heading" class="sr-only">
				{m['recurringEvents.dashboard.upcomingHeading']()}
			</h2>
			{#if upcomingOccurrences.length === 0}
				<p
					class="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
				>
					No upcoming occurrences yet.
				</p>
			{:else}
				<ul class="space-y-4">
					{#each upcomingOccurrences as occurrence (occurrence.id)}
						<li>
							<OccurrenceRow
								event={occurrence}
								organizationSlug={organization.slug}
								driftedIds={staleIds}
								{canEdit}
								onCancelOccurrence={openCancelOccurrenceFromRow}
							/>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{:else}
		<section aria-labelledby="past-heading">
			<h2 id="past-heading" class="sr-only">{m['recurringEvents.dashboard.pastHeading']()}</h2>
			{#if pastQuery.isLoading}
				<p
					class="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
				>
					Loading past occurrences…
				</p>
			{:else if pastOccurrences.length === 0}
				<p
					class="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
				>
					No past occurrences yet.
				</p>
			{:else}
				<ul class="space-y-4">
					{#each pastOccurrences as occurrence (occurrence.id)}
						<li class="opacity-70">
							<OccurrenceRow
								event={occurrence}
								organizationSlug={organization.slug}
								driftedIds={staleIds}
								canEdit={false}
							/>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	<!-- Cancelled dates (exdates) -->
	{#if exdates.length > 0}
		<ExdatesChipList
			{exdates}
			organizationSlug={organization.slug}
			seriesId={data.seriesId}
			{canEdit}
		/>
	{/if}
</div>

{#if series}
	<SeriesSettingsDialog
		bind:open={showSeriesSettings}
		{series}
		organizationSlug={organization.slug}
		{accessToken}
		onClose={() => (showSeriesSettings = false)}
	/>
	<TemplateEditDialog
		bind:open={showTemplateEdit}
		{series}
		organizationSlug={organization.slug}
		{accessToken}
		onClose={() => (showTemplateEdit = false)}
	/>
	<RecurrenceEditDialog
		bind:open={showRecurrenceEdit}
		{series}
		organizationSlug={organization.slug}
		{accessToken}
		onClose={() => (showRecurrenceEdit = false)}
	/>
	<CancelOccurrenceDialog
		bind:open={showCancelOccurrence}
		{series}
		organizationSlug={organization.slug}
		{accessToken}
		occurrences={upcomingOccurrences}
		initialDate={cancelOccurrenceInitialDate}
		onClose={() => (showCancelOccurrence = false)}
	/>
	<GenerateNowButton
		bind:open={showGenerateNow}
		{series}
		organizationSlug={organization.slug}
		{accessToken}
		onClose={() => (showGenerateNow = false)}
	/>
	<PauseResumeButton
		bind:open={showPauseResume}
		{series}
		organizationSlug={organization.slug}
		{accessToken}
		onClose={() => (showPauseResume = false)}
	/>
	<CancelDriftedOccurrencesDialog
		bind:open={showDriftBulkCancel}
		{series}
		organizationSlug={organization.slug}
		{accessToken}
		{driftedOccurrences}
		onClose={() => (showDriftBulkCancel = false)}
	/>
{/if}

<style>
	:global(button:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
