<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { Users, Check, X, Calendar, AlertCircle } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { cn } from '$lib/utils/cn';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	// Track which request is being processed
	let processingRequestId = $state<string | null>(null);

	// Get active status filter from URL
	let activeStatusFilter = $state<string | null>(data.filters?.status || null);

	// Format date helper
	function formatDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			return formatDistanceToNow(date, { addSuffix: true });
		} catch {
			return dateString;
		}
	}

	// Get status badge styling
	function getStatusBadge(status: string) {
		switch (status) {
			case 'pending':
				return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
			case 'approved':
				return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
			case 'rejected':
				return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
			default:
				return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
		}
	}

	/**
	 * Apply status filter
	 */
	function filterByStatus(status: string | null) {
		const params = new URLSearchParams(window.location.search);

		if (status) {
			params.set('status', status);
		} else {
			params.delete('status');
		}

		// Reset to page 1 when filtering
		params.delete('page');

		const newUrl = `?${params.toString()}`;
		window.location.href = newUrl;
	}
</script>

<svelte:head>
	<title>{m['membershipRequestsPage.pageTitle']()} - {data.organization.name} Admin | Revel</title>
	<meta name="description" content={m['membershipRequestsPage.pageDescription']()} />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
			{m['membershipRequestsPage.title']()}
		</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			{m['membershipRequestsPage.subtitle']({ organizationName: data.organization.name })}
		</p>
	</div>

	<!-- Success Message -->
	{#if form?.success}
		<div
			class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
			role="alert"
		>
			<Check class="h-5 w-5 shrink-0" aria-hidden="true" />
			<p class="text-sm font-medium">
				{form.action === 'approved'
					? m['membershipRequestsPage.success_approved']()
					: m['membershipRequestsPage.success_rejected']()}
			</p>
		</div>
	{/if}

	<!-- Error Message -->
	{#if form?.errors?.form}
		<div
			class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
			role="alert"
		>
			<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
			<p class="text-sm font-medium">{form.errors.form}</p>
		</div>
	{/if}

	<!-- Filter Buttons -->
	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			onclick={() => filterByStatus(null)}
			class={cn(
				'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
				!activeStatusFilter
					? 'bg-primary text-primary-foreground'
					: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
			)}
		>
			{m['membershipRequestsPage.filter_all']()}
		</button>
		<button
			type="button"
			onclick={() => filterByStatus('pending')}
			class={cn(
				'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
				activeStatusFilter === 'pending'
					? 'bg-yellow-600 text-white'
					: 'border border-yellow-600 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950'
			)}
		>
			{m['membershipRequestsPage.filter_pending']()}
		</button>
		<button
			type="button"
			onclick={() => filterByStatus('approved')}
			class={cn(
				'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
				activeStatusFilter === 'approved'
					? 'bg-green-600 text-white'
					: 'border border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950'
			)}
		>
			{m['membershipRequestsPage.filter_approved']()}
		</button>
		<button
			type="button"
			onclick={() => filterByStatus('rejected')}
			class={cn(
				'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
				activeStatusFilter === 'rejected'
					? 'bg-red-600 text-white'
					: 'border border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
			)}
		>
			{m['membershipRequestsPage.filter_rejected']()}
		</button>
	</div>

	<!-- Requests List -->
	{#if data.membershipRequests.length === 0}
		<!-- Empty State -->
		<div class="rounded-lg border bg-card p-12 text-center">
			<Users class="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<h3 class="mb-2 text-lg font-semibold">{m['membershipRequestsPage.empty_title']()}</h3>
			<p class="text-sm text-muted-foreground">
				{#if activeStatusFilter}
					{m['membershipRequestsPage.empty_description_filtered']({ status: activeStatusFilter })}
				{:else}
					{m['membershipRequestsPage.empty_description']()}
				{/if}
			</p>
		</div>
	{:else}
		<!-- Requests Table -->
		<div class="overflow-hidden rounded-lg border bg-card">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="border-b bg-muted/50">
						<tr>
							<th
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
							>
								{m['membershipRequestsPage.table_user']()}
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
							>
								{m['membershipRequestsPage.table_message']()}
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
							>
								{m['membershipRequestsPage.table_status']()}
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
							>
								{m['membershipRequestsPage.table_submitted']()}
							</th>
							<th
								class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
							>
								{m['membershipRequestsPage.table_actions']()}
							</th>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each data.membershipRequests as request (request.id)}
							<tr class="transition-colors hover:bg-muted/50">
								<!-- User -->
								<td class="px-6 py-4">
									<div class="flex items-center gap-3">
										{#if (request.user as any).profile_picture}
											<img
												src={(request.user as any).profile_picture}
												alt="{request.user.first_name} {request.user.last_name}"
												class="h-10 w-10 rounded-full object-cover"
											/>
										{:else}
											<div
												class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-sm font-bold text-primary-foreground"
											>
												{request.user.first_name?.charAt(0) ||
													((request.user as any).username?.charAt(0).toUpperCase() ?? '?')}
											</div>
										{/if}
										<div>
											<p class="font-medium">
												{request.user.first_name}
												{request.user.last_name}
											</p>
											<p class="text-sm text-muted-foreground">
												@{(request.user as any).username ?? 'N/A'}
											</p>
										</div>
									</div>
								</td>

								<!-- Message -->
								<td class="max-w-xs px-6 py-4">
									{#if request.message}
										<p class="truncate text-sm">{request.message}</p>
									{:else}
										<p class="text-sm italic text-muted-foreground">
											{m['membershipRequestsPage.noMessage']()}
										</p>
									{/if}
								</td>

								<!-- Status -->
								<td class="px-6 py-4">
									<span
										class="inline-flex rounded-full px-2 py-1 text-xs font-semibold {getStatusBadge(
											request.status ?? 'pending'
										)}"
									>
										{(request.status ?? 'pending').charAt(0).toUpperCase() +
											(request.status ?? 'pending').slice(1)}
									</span>
								</td>

								<!-- Submitted -->
								<td class="px-6 py-4">
									<div class="flex items-center gap-1 text-sm text-muted-foreground">
										<Calendar class="h-4 w-4" aria-hidden="true" />
										{formatDate(request.created_at)}
									</div>
								</td>

								<!-- Actions -->
								<td class="px-6 py-4 text-right">
									{#if (request.status ?? 'pending') === 'pending'}
										<div class="flex items-center justify-end gap-2">
											<!-- Approve Form -->
											<form
												method="POST"
												action="?/approve"
												use:enhance={() => {
													processingRequestId = request.id ?? null;
													return async ({ update }) => {
														await update();
														processingRequestId = null;
													};
												}}
											>
												<input type="hidden" name="request_id" value={request.id} />
												<button
													type="submit"
													disabled={processingRequestId === request.id}
													class="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
													aria-label="Approve request from {request.user.first_name} {request.user
														.last_name}"
												>
													<Check class="h-3.5 w-3.5" aria-hidden="true" />
													{m['membershipRequestsPage.approveButton']()}
												</button>
											</form>

											<!-- Reject Form -->
											<form
												method="POST"
												action="?/reject"
												use:enhance={() => {
													processingRequestId = request.id ?? null;
													return async ({ update }) => {
														await update();
														processingRequestId = null;
													};
												}}
											>
												<input type="hidden" name="request_id" value={request.id} />
												<button
													type="submit"
													disabled={processingRequestId === request.id}
													class="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
													aria-label="Reject request from {request.user.first_name} {request.user
														.last_name}"
												>
													<X class="h-3.5 w-3.5" aria-hidden="true" />
													{m['membershipRequestsPage.rejectButton']()}
												</button>
											</form>
										</div>
									{:else}
										<span class="text-sm text-muted-foreground">
											{(request.status ?? 'pending') === 'approved' ? 'Approved' : 'Rejected'}
										</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Pagination -->
		{#if data.pagination.totalPages > 1}
			<div class="flex items-center justify-between">
				<p class="text-sm text-muted-foreground">
					{m['membershipRequestsPage.pagination_showing']({
						from: (data.pagination.page - 1) * data.pagination.pageSize + 1,
						to: Math.min(
							data.pagination.page * data.pagination.pageSize,
							data.pagination.totalCount
						),
						total: data.pagination.totalCount
					})}
				</p>

				<div class="flex gap-2">
					{#if data.pagination.hasPrev}
						<a
							href="?page={data.pagination.page - 1}&page_size={data.pagination.pageSize}"
							class="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							{m['membershipRequestsPage.pagination_previous']()}
						</a>
					{/if}

					{#if data.pagination.hasNext}
						<a
							href="?page={data.pagination.page + 1}&page_size={data.pagination.pageSize}"
							class="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							{m['membershipRequestsPage.pagination_next']()}
						</a>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>
