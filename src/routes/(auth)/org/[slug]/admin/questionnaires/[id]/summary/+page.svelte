<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { ArrowLeft, Users, FileText, TrendingUp, Clock } from 'lucide-svelte';
	import StatusBreakdownBar from '$lib/components/questionnaires/StatusBreakdownBar.svelte';
	import McQuestionChart from '$lib/components/questionnaires/McQuestionChart.svelte';
	import ScoreStatsCard from '$lib/components/questionnaires/ScoreStatsCard.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let summary = $derived(data.summary!);
	let questionnaire = $derived(data.questionnaire!);
	let events = $derived(questionnaire?.events ?? []);
	let eventSeries = $derived(questionnaire?.event_series ?? []);

	// Derived stats
	let totalEvaluated = $derived(
		(summary?.by_status_per_user.approved ?? 0) + (summary?.by_status_per_user.rejected ?? 0)
	);
	let approvalRate = $derived(
		totalEvaluated > 0
			? Math.round(((summary?.by_status_per_user.approved ?? 0) / totalEvaluated) * 100)
			: 0
	);

	function setEventFilter(eventId: string) {
		const params = new URLSearchParams($page.url.searchParams);
		if (eventId) {
			params.set('event_id', eventId);
			params.delete('event_series_id');
		} else {
			params.delete('event_id');
		}
		goto(`?${params.toString()}`, { replaceState: true });
	}

	function setSeriesFilter(seriesId: string) {
		const params = new URLSearchParams($page.url.searchParams);
		if (seriesId) {
			params.set('event_series_id', seriesId);
			params.delete('event_id');
		} else {
			params.delete('event_series_id');
		}
		goto(`?${params.toString()}`, { replaceState: true });
	}

	let selectedEventLabel = $derived(() => {
		if (data.filters.eventId) {
			const ev = events.find((e) => e.id === data.filters.eventId);
			return ev?.name ?? data.filters.eventId;
		}
		return m['questionnaireSummaryPage.allEvents']();
	});

	let selectedSeriesLabel = $derived(() => {
		if (data.filters.eventSeriesId) {
			const s = eventSeries.find((es) => es.id === data.filters.eventSeriesId);
			return s?.name ?? data.filters.eventSeriesId;
		}
		return m['questionnaireSummaryPage.allSeries']();
	});
</script>

<svelte:head>
	<title>{m['questionnaireSummaryPage.pageTitle']()} - {data.organizationSlug}</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<a
			href="/org/{data.organizationSlug}/admin/questionnaires/{data.questionnaireId}"
			class="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" />
			{m['questionnaireSummaryPage.backToQuestionnaire']()}
		</a>
		<h1 class="text-3xl font-bold">{m['questionnaireSummaryPage.title']()}</h1>
		<p class="mt-1 text-muted-foreground">{questionnaire?.questionnaire.name}</p>
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
		<Card class="p-12 text-center">
			<FileText class="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<p class="text-lg font-medium">{m['questionnaireSummaryPage.noSubmissions']()}</p>
			<p class="mt-2 text-sm text-muted-foreground">
				{m['questionnaireSummaryPage.noSubmissionsDescription']()}
			</p>
		</Card>
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
					<div class="rounded-full bg-blue-100 p-3 dark:bg-blue-950">
						<FileText class="h-6 w-6 text-blue-900 dark:text-blue-100" aria-hidden="true" />
					</div>
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
					<div class="rounded-full bg-purple-100 p-3 dark:bg-purple-950">
						<Users class="h-6 w-6 text-purple-900 dark:text-purple-100" aria-hidden="true" />
					</div>
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
					<div class="rounded-full bg-green-100 p-3 dark:bg-green-950">
						<TrendingUp class="h-6 w-6 text-green-900 dark:text-green-100" aria-hidden="true" />
					</div>
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
					<div class="rounded-full bg-yellow-100 p-3 dark:bg-yellow-950">
						<Clock class="h-6 w-6 text-yellow-900 dark:text-yellow-100" aria-hidden="true" />
					</div>
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

		<!-- MC Question Distributions -->
		{#if summary.mc_question_stats.length > 0}
			<Card>
				<CardHeader>
					<CardTitle class="text-base">
						{m['questionnaireSummaryPage.mcDistributions']()}
					</CardTitle>
					<CardDescription>Answer distribution for multiple choice questions</CardDescription>
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
