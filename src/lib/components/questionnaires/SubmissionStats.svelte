<script lang="ts">
	import { Clock, Check, TrendingUp } from 'lucide-svelte';
	import { Card } from '$lib/components/ui/card';

	interface Props {
		pendingCount: number;
		approvedCount: number;
		rejectedCount: number;
	}

	let { pendingCount, approvedCount, rejectedCount }: Props = $props();

	// Calculate approval rate
	let totalEvaluated = $derived(approvedCount + rejectedCount);
	let approvalRate = $derived(
		totalEvaluated > 0 ? Math.round((approvedCount / totalEvaluated) * 100) : 0
	);
</script>

<!--
  Submission Statistics Component

  Displays aggregate stats for questionnaire submissions including pending count,
  approved count, and approval rate.

  @component
  @example
  <SubmissionStats pendingCount={12} approvedCount={45} rejectedCount={3} />
-->
<div class="grid gap-4 md:grid-cols-3">
	<!-- Pending Submissions -->
	<Card class="p-6">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm font-medium text-muted-foreground">Pending Review</p>
				<p class="text-3xl font-bold">{pendingCount}</p>
				<p class="mt-1 text-xs text-muted-foreground">Need attention</p>
			</div>
			<div class="rounded-full bg-yellow-100 p-3 dark:bg-yellow-950">
				<Clock class="h-6 w-6 text-yellow-900 dark:text-yellow-100" aria-hidden="true" />
			</div>
		</div>
	</Card>

	<!-- Approved Submissions -->
	<Card class="p-6">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm font-medium text-muted-foreground">Approved</p>
				<p class="text-3xl font-bold">{approvedCount}</p>
				<p class="mt-1 text-xs text-muted-foreground">Total approved</p>
			</div>
			<div class="rounded-full bg-green-100 p-3 dark:bg-green-950">
				<Check class="h-6 w-6 text-green-900 dark:text-green-100" aria-hidden="true" />
			</div>
		</div>
	</Card>

	<!-- Approval Rate -->
	<Card class="p-6">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm font-medium text-muted-foreground">Approval Rate</p>
				<p class="text-3xl font-bold">{approvalRate}%</p>
				<p class="mt-1 text-xs text-muted-foreground">
					{approvedCount}/{totalEvaluated} approved
				</p>
			</div>
			<div class="rounded-full bg-blue-100 p-3 dark:bg-blue-950">
				<TrendingUp class="h-6 w-6 text-blue-900 dark:text-blue-100" aria-hidden="true" />
			</div>
		</div>
	</Card>
</div>
