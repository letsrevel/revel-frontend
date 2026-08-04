<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { ArrowLeft, Users, FileText, TrendingUp, Clock } from '@lucide/svelte';
	import StatusBreakdownBar from '$lib/components/questionnaires/StatusBreakdownBar.svelte';
	import McQuestionChart from '$lib/components/questionnaires/McQuestionChart.svelte';
	import ScoreStatsCard from '$lib/components/questionnaires/ScoreStatsCard.svelte';
	import PronounDistributionChart from '$lib/components/common/PronounDistributionChart.svelte';
	import ExportButton from '$lib/components/common/ExportButton.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ToneTile from '$lib/components/common/ToneTile.svelte';
	import { questionnaireExportSubmissions } from '$lib/api';
	import { authStore } from '$lib/stores/auth.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	const summary = $derived(data.summary);
	const questionnaire = $derived(data.questionnaire);
	const events = $derived(questionnaire?.events ?? []);
	const eventSeries = $derived(questionnaire?.event_series ?? []);

	/**
	 * Pronoun distribution, only when it carries real numbers.
	 *
	 * Since #825 the totals are withheld (`null`) whenever the event hides
	 * attendee counts, and the per-pronoun buckets are served empty alongside
	 * them. A withheld distribution therefore renders the existing "no data"
	 * state (the card is not shown) rather than a chart zeroed out of thin air.
	 */
	const pronounStats = $derived.by(() => {
		const pd = summary?.pronoun_distribution;
		if (!pd) return null;
		const { total_attendees, total_with_pronouns, total_without_pronouns } = pd;
		if (total_attendees == null || total_with_pronouns == null || total_without_pronouns == null) {
			return null;
		}
		if (total_attendees <= 0) return null;
		return {
			distribution: pd.distribution ?? [],
			totalAttendees: total_attendees,
			totalWithPronouns: total_with_pronouns,
			totalWithoutPronouns: total_without_pronouns
		};
	});

	// Derived stats
	const totalEvaluated = $derived(
		(summary?.by_status_per_user.approved ?? 0) + (summary?.by_status_per_user.rejected ?? 0)
	);
	const approvalRate = $derived(
		totalEvaluated > 0
			? Math.round(((summary?.by_status_per_user.approved ?? 0) / totalEvaluated) * 100)
			: 0
	);

	function setEventFilter(eventId: string) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: local URL builder, mutated synchronously then discarded via goto()
		const params = new URLSearchParams($page.url.searchParams);
		if (eventId) {
			params.set('event_id', eventId);
			params.delete('event_series_id');
		} else {
			params.delete('event_id');
		}
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-route query-only update; the relative "?"+params string preserves the current pathname (resolve() cannot express search params)
		goto(`?${params.toString()}`, { replaceState: true });
	}

	function setSeriesFilter(seriesId: string) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: local URL builder, mutated synchronously then discarded via goto()
		const params = new URLSearchParams($page.url.searchParams);
		if (seriesId) {
			params.set('event_series_id', seriesId);
			params.delete('event_id');
		} else {
			params.delete('event_series_id');
		}
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-route query-only update; the relative "?"+params string preserves the current pathname (resolve() cannot express search params)
		goto(`?${params.toString()}`, { replaceState: true });
	}

	const selectedEventLabel = $derived(() => {
		if (data.filters.eventId) {
			const ev = events.find((e) => e.id === data.filters.eventId);
			return ev?.name ?? data.filters.eventId;
		}
		return m['questionnaireSummaryPage.allEvents']();
	});

	const selectedSeriesLabel = $derived(() => {
		if (data.filters.eventSeriesId) {
			const s = eventSeries.find((es) => es.id === data.filters.eventSeriesId);
			return s?.name ?? data.filters.eventSeriesId;
		}
		return m['questionnaireSummaryPage.allSeries']();
	});

	async function handleExportSubmissions(): Promise<string> {
		const response = await questionnaireExportSubmissions({
			path: { org_questionnaire_id: data.questionnaireId },
			query: {
				event_id: data.filters.eventId ?? undefined,
				event_series_id: data.filters.eventSeriesId ?? undefined
			},
			headers: { Authorization: `Bearer ${authStore.accessToken}` }
		});
		if (response.error || !response.data?.id) {
			throw new Error('Export failed');
		}
		return response.data.id;
	}
</script>

<svelte:head>
	<title>{m['questionnaireSummaryPage.pageTitle']()} - {data.organizationSlug}</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<a
			href={resolve('/(auth)/org/[slug]/admin/questionnaires/[id]', {
				slug: data.organizationSlug,
				id: data.questionnaireId
			})}
			class="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" />
			{m['questionnaireSummaryPage.backToQuestionnaire']()}
		</a>
		<PageHeader
			title={m['questionnaireSummaryPage.title']()}
			subtitle={questionnaire?.questionnaire.name}
			kicker={data.organization.name}
		>
			{#snippet actions()}
				<ExportButton
					label={m['exportButton.exportSubmissions']()}
					onExport={handleExportSubmissions}
					accessToken={authStore.accessToken}
				/>
			{/snippet}
		</PageHeader>
	</div>

	<!-- Filters -->
	{#if events.length > 0 || eventSeries.length > 0}
		<Card class="mb-8">
			<CardContent class="flex flex-col gap-4 py-4 sm:flex-row">
				{#if events.length > 0}
					<div class="flex-1">
						<label for="event-filter" class="mb-1 block text-sm font-medium">
							{m['questionnaireSummaryPage.filterByEvent']()}
						</label>
						<Select
							type="single"
							value={data.filters.eventId ?? ''}
							onValueChange={(v) => setEventFilter(v ?? '')}
						>
							<SelectTrigger id="event-filter">
								{selectedEventLabel()}
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="" label={m['questionnaireSummaryPage.allEvents']()}>
									{m['questionnaireSummaryPage.allEvents']()}
								</SelectItem>
								{#each events as event (event.id)}
									<SelectItem value={event.id} label={event.name}>
										{event.name}
									</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</div>
				{/if}
				{#if eventSeries.length > 0}
					<div class="flex-1">
						<label for="series-filter" class="mb-1 block text-sm font-medium">
							{m['questionnaireSummaryPage.filterByEventSeries']()}
						</label>
						<Select
							type="single"
							value={data.filters.eventSeriesId ?? ''}
							onValueChange={(v) => setSeriesFilter(v ?? '')}
						>
							<SelectTrigger id="series-filter">
								{selectedSeriesLabel()}
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="" label={m['questionnaireSummaryPage.allSeries']()}>
									{m['questionnaireSummaryPage.allSeries']()}
								</SelectItem>
								{#each eventSeries as series (series.id)}
									<SelectItem value={series.id} label={series.name}>
										{series.name}
									</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</div>
				{/if}
			</CardContent>
		</Card>
	{/if}

	{#if summary.total_submissions === 0}
		<!-- Empty state -->
		<EmptyState
			icon={FileText}
			tone="neutral"
			title={m['questionnaireSummaryPage.noSubmissions']()}
			body={m['questionnaireSummaryPage.noSubmissionsDescription']()}
		/>
	{:else}
		<!-- Summary Cards -->
		<div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<!-- Total Submissions -->
			<Card class="p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-muted-foreground">
							{m['questionnaireSummaryPage.totalSubmissions']()}
						</p>
						<p class="text-3xl font-bold">{summary.total_submissions}</p>
					</div>
					<ToneTile tone="info" icon={FileText} size="lg" class="rounded-full" />
				</div>
			</Card>

			<!-- Unique Users -->
			<Card class="p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-muted-foreground">
							{m['questionnaireSummaryPage.uniqueUsers']()}
						</p>
						<p class="text-3xl font-bold">{summary.unique_users}</p>
					</div>
					<ToneTile tone="brand" icon={Users} size="lg" class="rounded-full" />
				</div>
			</Card>

			<!-- Approval Rate -->
			<Card class="p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-muted-foreground">
							{m['questionnaireSummaryPage.approvalRate']()}
						</p>
						<p class="text-3xl font-bold">{approvalRate}%</p>
						<p class="mt-1 text-xs text-muted-foreground">
							{summary.by_status_per_user.approved ?? 0}/{totalEvaluated}
						</p>
					</div>
					<ToneTile tone="success" icon={TrendingUp} size="lg" class="rounded-full" />
				</div>
			</Card>

			<!-- Pending Review -->
			<Card class="p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-muted-foreground">
							{m['questionnaireSummaryPage.pendingReview']()}
						</p>
						<p class="text-3xl font-bold">{summary.by_status_per_user.pending_review ?? 0}</p>
					</div>
					<ToneTile tone="warning" icon={Clock} size="lg" class="rounded-full" />
				</div>
			</Card>
		</div>

		<!-- Status Breakdown -->
		<Card class="mb-8">
			<CardHeader>
				<CardTitle class="text-base">
					{m['questionnaireSummaryPage.statusBreakdown']()}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<StatusBreakdownBar
					approved={summary.by_status_per_user.approved ?? 0}
					rejected={summary.by_status_per_user.rejected ?? 0}
					pendingReview={summary.by_status_per_user.pending_review ?? 0}
					notEvaluated={summary.by_status_per_user.not_evaluated ?? 0}
				/>
			</CardContent>
		</Card>

		<!-- Score Stats -->
		<div class="mb-8">
			<ScoreStatsCard
				min={summary.score_stats.min}
				avg={summary.score_stats.avg}
				max={summary.score_stats.max}
			/>
		</div>

		<!-- Pronoun Distribution -->
		{#if pronounStats}
			<Card class="mb-8">
				<CardHeader>
					<CardTitle class="text-base">{m['pronounDistribution.title']()}</CardTitle>
				</CardHeader>
				<CardContent>
					<PronounDistributionChart
						distribution={pronounStats.distribution}
						totalAttendees={pronounStats.totalAttendees}
						totalWithPronouns={pronounStats.totalWithPronouns}
						totalWithoutPronouns={pronounStats.totalWithoutPronouns}
					/>
				</CardContent>
			</Card>
		{/if}

		<!-- MC Question Distributions -->
		{#if summary.mc_question_stats.length > 0}
			<Card>
				<CardHeader>
					<CardTitle class="text-base">
						{m['questionnaireSummaryPage.mcDistributions']()}
					</CardTitle>
					<CardDescription
						>{m['questionnaireSummaryPage.mcDistributionsDescription']()}</CardDescription
					>
				</CardHeader>
				<CardContent class="space-y-8">
					{#each summary.mc_question_stats as mcStat (mcStat.question_id)}
						<McQuestionChart questionText={mcStat.question_text} options={mcStat.options} />
					{/each}
				</CardContent>
			</Card>
		{/if}
	{/if}
</div>
