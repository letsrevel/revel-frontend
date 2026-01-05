<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import SubmissionStats from '$lib/components/questionnaires/SubmissionStats.svelte';
	import SubmissionStatusBadge from '$lib/components/questionnaires/SubmissionStatusBadge.svelte';
	import {
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		ChevronsLeft,
		ChevronsRight,
		ArrowUpDown
	} from 'lucide-svelte';
	import type { QuestionnaireEvaluationStatus } from '$lib/utils/questionnaire-types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Current filter values
	let currentEvaluationStatus = $derived(data.filters.evaluationStatus || '');
	let currentOrderBy = $derived(data.filters.orderBy || '-submitted_at');

	function setEvaluationStatusFilter(status: string) {
		const params = new URLSearchParams($page.url.searchParams);

		if (status) {
			params.set('evaluation_status', status);
		} else {
			params.delete('evaluation_status');
		}

		params.delete('page'); // Reset to first page when filters change
		goto(`?${params.toString()}`, { replaceState: true });
	}

	function setOrderBy(orderBy: string) {
		const params = new URLSearchParams($page.url.searchParams);

		if (orderBy !== '-submitted_at') {
			params.set('order_by', orderBy);
		} else {
			params.delete('order_by');
		}

		params.delete('page'); // Reset to first page when ordering changes
		goto(`?${params.toString()}`, { replaceState: true });
	}

	function goToPage(pageNum: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', pageNum.toString());
		goto(`?${params.toString()}`);
	}

	function formatDate(dateString: string | null | undefined): string {
		if (!dateString) return m['questionnaireSubmissionsPage.notSubmitted']();
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatScore(score: string | number | null | undefined): string {
		if (score === null || score === undefined) return m['questionnaireSubmissionsPage.scoreNA']();
		const numScore = typeof score === 'string' ? parseFloat(score) : score;
		return `${numScore}/100`;
	}
</script>

<svelte:head>
	<title>{m['questionnaireSubmissionsPage.pageTitle']()} - {data.organizationSlug}</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<a
			href="/org/{data.organizationSlug}/admin/questionnaires"
			class="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" />
			{m['questionnaireSubmissionsPage.backToQuestionnaires']()}
		</a>
		<h1 class="text-3xl font-bold">{m['questionnaireSubmissionsPage.title']()}</h1>
		<p class="mt-2 text-muted-foreground">{m['questionnaireSubmissionsPage.subtitle']()}</p>
	</div>

	<!-- Stats -->
	<div class="mb-8">
		<SubmissionStats
			pendingCount={data.stats.pendingCount}
			approvedCount={data.stats.approvedCount}
			rejectedCount={data.stats.rejectedCount}
		/>
	</div>

	<!-- Filters and Sorting -->
	<Card class="mb-6 p-6">
		<!-- Evaluation Status Filter -->
		<div class="mb-6">
			<h3 class="mb-3 text-sm font-medium">{m['questionnaireSubmissionsPage.filterByStatus']()}</h3>
			<div class="flex flex-wrap gap-2">
				<Button
					variant={currentEvaluationStatus === '' ? 'default' : 'outline'}
					size="sm"
					onclick={() => setEvaluationStatusFilter('')}
				>
					{m['questionnaireSubmissionsPage.filter_all']()}
				</Button>
				<Button
					variant={currentEvaluationStatus === 'pending review' ? 'secondary' : 'outline'}
					size="sm"
					onclick={() => setEvaluationStatusFilter('pending review')}
				>
					{m['questionnaireSubmissionsPage.filter_pendingReview']()}
				</Button>
				<Button
					variant={currentEvaluationStatus === 'approved' ? 'default' : 'outline'}
					size="sm"
					onclick={() => setEvaluationStatusFilter('approved')}
				>
					{m['questionnaireSubmissionsPage.filter_approved']()}
				</Button>
				<Button
					variant={currentEvaluationStatus === 'rejected' ? 'destructive' : 'outline'}
					size="sm"
					onclick={() => setEvaluationStatusFilter('rejected')}
				>
					{m['questionnaireSubmissionsPage.filter_rejected']()}
				</Button>
			</div>
		</div>

		<!-- Sort Order -->
		<div>
			<h3 class="mb-3 text-sm font-medium">{m['questionnaireSubmissionsPage.sortBy']()}</h3>
			<div class="flex flex-wrap gap-2">
				<Button
					variant={currentOrderBy === '-submitted_at' ? 'default' : 'outline'}
					size="sm"
					onclick={() => setOrderBy('-submitted_at')}
				>
					<ArrowUpDown class="mr-2 h-4 w-4" />
					{m['questionnaireSubmissionsPage.sort_newestFirst']()}
				</Button>
				<Button
					variant={currentOrderBy === 'submitted_at' ? 'default' : 'outline'}
					size="sm"
					onclick={() => setOrderBy('submitted_at')}
				>
					<ArrowUpDown class="mr-2 h-4 w-4" />
					{m['questionnaireSubmissionsPage.sort_oldestFirst']()}
				</Button>
			</div>
		</div>
	</Card>

	<!-- Submissions List -->
	{#if data.submissions.length === 0}
		<Card class="p-12 text-center">
			<p class="text-lg text-muted-foreground">
				{m['questionnaireSubmissionsPage.noSubmissionsFound']()}
			</p>
			<p class="mt-2 text-sm text-muted-foreground">
				{#if data.filters.search || data.filters.evaluationStatus}
					{m['questionnaireSubmissionsPage.adjustFilters']()}
				{:else}
					{m['questionnaireSubmissionsPage.noSubmissionsYet']()}
				{/if}
			</p>
		</Card>
	{:else}
		<!-- Desktop Table View -->
		<div class="hidden overflow-x-auto md:block">
			<Card>
				<table class="w-full">
					<thead class="border-b bg-muted/50">
						<tr>
							<th class="px-6 py-4 text-left text-sm font-medium"
								>{m['questionnaireSubmissionsPage.header_respondent']()}</th
							>
							<th class="px-6 py-4 text-left text-sm font-medium"
								>{m['questionnaireSubmissionsPage.header_submitted']()}</th
							>
							<th class="px-6 py-4 text-left text-sm font-medium"
								>{m['questionnaireSubmissionsPage.header_evaluationStatus']()}</th
							>
							<th class="px-6 py-4 text-left text-sm font-medium"
								>{m['questionnaireSubmissionsPage.header_score']()}</th
							>
							<th class="px-6 py-4 text-right text-sm font-medium"
								>{m['questionnaireSubmissionsPage.header_actions']()}</th
							>
						</tr>
					</thead>
					<tbody>
						{#each data.submissions as submission (submission.id)}
							<tr class="border-b transition-colors hover:bg-muted/50">
								<td class="px-6 py-4">
									<div class="flex flex-col">
										<span class="font-medium">{submission.user.display_name}</span>
										<span class="text-sm text-muted-foreground">{submission.user.email}</span>
									</div>
								</td>
								<td class="px-6 py-4 text-sm">{formatDate(submission.submitted_at)}</td>
								<td class="px-6 py-4">
									<SubmissionStatusBadge
										status={(submission.evaluation_status ||
											'pending review') as QuestionnaireEvaluationStatus}
									/>
								</td>
								<td class="px-6 py-4 text-sm">{formatScore(submission.evaluation_score)}</td>
								<td class="px-6 py-4 text-right">
									<Button
										href="/org/{data.organizationSlug}/admin/questionnaires/{data.questionnaireId}/submissions/{submission.id}"
										variant="outline"
										size="sm"
									>
										{m['questionnaireSubmissionsPage.reviewButton']()}
									</Button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</Card>
		</div>

		<!-- Mobile Card View -->
		<div class="space-y-4 md:hidden">
			{#each data.submissions as submission (submission.id)}
				<Card class="p-4">
					<div class="mb-3 flex items-start justify-between">
						<div class="flex-1">
							<h3 class="font-semibold">{submission.user.display_name}</h3>
							<p class="text-sm text-muted-foreground">{submission.user.email}</p>
						</div>
						<SubmissionStatusBadge
							status={(submission.evaluation_status ||
								'pending review') as QuestionnaireEvaluationStatus}
						/>
					</div>

					<div class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span class="text-muted-foreground">Submitted:</span>
							<span>{formatDate(submission.submitted_at)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">Score:</span>
							<span>{formatScore(submission.evaluation_score)}</span>
						</div>
					</div>

					<Button
						href="/org/{data.organizationSlug}/admin/questionnaires/{data.questionnaireId}/submissions/{submission.id}"
						variant="outline"
						size="sm"
						class="mt-4 w-full"
					>
						{m['questionnaireSubmissionsPage.reviewButton']()}
					</Button>
				</Card>
			{/each}
		</div>

		<!-- Pagination -->
		<div class="mt-6 flex items-center justify-between">
			<p class="text-sm text-muted-foreground">
				Showing {(data.pagination.currentPage - 1) * data.pagination.pageSize + 1} to {Math.min(
					data.pagination.currentPage * data.pagination.pageSize,
					data.pagination.count
				)} of {data.pagination.count} submissions
			</p>

			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={() => goToPage(1)}
					disabled={data.pagination.currentPage === 1}
					aria-label="Go to first page"
				>
					<ChevronsLeft class="h-4 w-4" />
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => goToPage(data.pagination.currentPage - 1)}
					disabled={!data.pagination.previous}
					aria-label="Go to previous page"
				>
					<ChevronLeft class="h-4 w-4" />
				</Button>

				<span class="text-sm">
					Page {data.pagination.currentPage} of {data.pagination.totalPages}
				</span>

				<Button
					variant="outline"
					size="sm"
					onclick={() => goToPage(data.pagination.currentPage + 1)}
					disabled={!data.pagination.next}
					aria-label="Go to next page"
				>
					<ChevronRight class="h-4 w-4" />
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => goToPage(data.pagination.totalPages)}
					disabled={data.pagination.currentPage === data.pagination.totalPages}
					aria-label="Go to last page"
				>
					<ChevronsRight class="h-4 w-4" />
				</Button>
			</div>
		</div>
	{/if}
</div>
