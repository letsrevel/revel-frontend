<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventInvitationRequestInternalSchema } from '$lib/api/generated/types.gen';
	import { enhance } from '$app/forms';
	import { Users, Check, X, Calendar, Search } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { cn } from '$lib/utils/cn';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';

	interface Pagination {
		page: number;
		pageSize: number;
		totalCount: number;
		totalPages: number;
		hasNext: boolean;
		hasPrev: boolean;
	}

	interface Props {
		invitationRequests: EventInvitationRequestInternalSchema[];
		requestsPagination: Pagination;
		activeStatusFilter: string | null;
		searchQuery: string;
		onFilterByStatus: (status: string | null) => void;
		onSearchInput: (e: Event) => void;
		searchInput: string;
	}

	let {
		invitationRequests,
		requestsPagination,
		activeStatusFilter,
		searchQuery,
		onFilterByStatus,
		onSearchInput,
		searchInput
	}: Props = $props();

	let processingId = $state<string | null>(null);

	function formatDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			return formatDistanceToNow(date, { addSuffix: true });
		} catch {
			return dateString;
		}
	}

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
</script>

<div class="space-y-4">
	<!-- Filters & Search -->
	<div class="space-y-4">
		<!-- Search bar -->
		<div class="relative">
			<Search
				class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<input
				type="search"
				placeholder="Search by name or email..."
				value={searchInput}
				oninput={onSearchInput}
				class="w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			/>
		</div>

		<!-- Filter buttons -->
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				onclick={() => onFilterByStatus(null)}
				class={cn(
					'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
					!activeStatusFilter
						? 'bg-primary text-primary-foreground'
						: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
				)}
			>
				{m['eventInvitationsAdmin.filterAll']({ count: requestsPagination.totalCount })}
			</button>
			<button
				type="button"
				onclick={() => onFilterByStatus('pending')}
				class={cn(
					'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
					activeStatusFilter === 'pending'
						? 'bg-yellow-600 text-white'
						: 'border border-yellow-600 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950'
				)}
			>
				{m['eventInvitationsAdmin.filterPending']()}
			</button>
			<button
				type="button"
				onclick={() => onFilterByStatus('approved')}
				class={cn(
					'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
					activeStatusFilter === 'approved'
						? 'bg-green-600 text-white'
						: 'border border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950'
				)}
			>
				{m['eventInvitationsAdmin.filterApproved']()}
			</button>
			<button
				type="button"
				onclick={() => onFilterByStatus('rejected')}
				class={cn(
					'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
					activeStatusFilter === 'rejected'
						? 'bg-red-600 text-white'
						: 'border border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
				)}
			>
				{m['eventInvitationsAdmin.filterRejected']()}
			</button>
		</div>
	</div>

	<!-- Requests List -->
	{#if invitationRequests.length === 0}
		<div class="rounded-lg border bg-card p-12 text-center">
			<Users class="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<h3 class="mb-2 text-lg font-semibold">{m['eventInvitationsAdmin.noRequests']()}</h3>
			<p class="text-sm text-muted-foreground">
				{#if activeStatusFilter || searchQuery}
					{m['eventInvitationsAdmin.noRequestsFiltered']()}
				{:else}
					{m['eventInvitationsAdmin.noRequestsEmpty']()}
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
								{m['eventInvitationsAdmin.headerUser']()}
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
							>
								{m['eventInvitationsAdmin.headerMessage']()}
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
							>
								{m['eventInvitationsAdmin.headerStatus']()}
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
							>
								{m['eventInvitationsAdmin.headerRequested']()}
							</th>
							<th
								class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
							>
								{m['eventInvitationsAdmin.headerActions']()}
							</th>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each invitationRequests as request (request.id)}
							<tr class="transition-colors hover:bg-muted/50">
								<!-- User -->
								<td class="px-6 py-4">
									<div class="flex items-center gap-3">
										<UserAvatar
											profilePictureUrl={request.user.profile_picture_url}
											previewUrl={request.user.profile_picture_preview_url}
											thumbnailUrl={request.user.profile_picture_thumbnail_url}
											displayName={getUserDisplayName(
												request.user,
												m['eventInvitationsAdmin.unknownUser']()
											)}
											firstName={request.user.first_name}
											lastName={request.user.last_name}
											size="md"
											clickable={true}
										/>
										<div>
											<p class="font-medium">
												{getUserDisplayName(request.user, m['eventInvitationsAdmin.unknownUser']())}
											</p>
											{#if 'username' in request.user && request.user.username}
												<p class="text-sm text-muted-foreground">@{request.user.username}</p>
											{/if}
										</div>
									</div>
								</td>

								<!-- Message -->
								<td class="max-w-xs px-6 py-4">
									{#if request.message}
										<p class="truncate text-sm">{request.message}</p>
									{:else}
										<p class="text-sm italic text-muted-foreground">
											{m['eventInvitationsAdmin.noMessage']()}
										</p>
									{/if}
								</td>

								<!-- Status -->
								<td class="px-6 py-4">
									<span
										class="inline-flex rounded-full px-2 py-1 text-xs font-semibold {getStatusBadge(
											request.status ?? ''
										)}"
									>
										{(request.status ?? '').charAt(0).toUpperCase() +
											(request.status ?? '').slice(1)}
									</span>
								</td>

								<!-- Requested -->
								<td class="px-6 py-4">
									<div class="flex items-center gap-1 text-sm text-muted-foreground">
										<Calendar class="h-4 w-4" aria-hidden="true" />
										{formatDate(request.created_at)}
									</div>
								</td>

								<!-- Actions -->
								<td class="px-6 py-4 text-right">
									{#if request.status === 'pending'}
										<div class="flex items-center justify-end gap-2">
											<form
												method="POST"
												action="?/approveRequest"
												use:enhance={() => {
													processingId = request.id ?? null;
													return async ({ update }) => {
														await update();
														processingId = null;
													};
												}}
											>
												<input type="hidden" name="request_id" value={request.id ?? ''} />
												<button
													type="submit"
													disabled={processingId === request.id}
													class="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
												>
													<Check class="h-3.5 w-3.5" aria-hidden="true" />
													{m['eventInvitationsAdmin.approve']()}
												</button>
											</form>

											<form
												method="POST"
												action="?/rejectRequest"
												use:enhance={() => {
													processingId = request.id ?? null;
													return async ({ update }) => {
														await update();
														processingId = null;
													};
												}}
											>
												<input type="hidden" name="request_id" value={request.id ?? ''} />
												<button
													type="submit"
													disabled={processingId === request.id}
													class="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
												>
													<X class="h-3.5 w-3.5" aria-hidden="true" />
													{m['eventInvitationsAdmin.reject']()}
												</button>
											</form>
										</div>
									{:else}
										<span class="text-sm text-muted-foreground">
											{request.status === 'approved'
												? m['eventInvitationsAdmin.approved']()
												: m['eventInvitationsAdmin.rejected']()}
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
		{#if requestsPagination.totalPages > 1}
			<div class="flex items-center justify-between">
				<p class="text-sm text-muted-foreground">
					Showing {(requestsPagination.page - 1) * requestsPagination.pageSize + 1} to
					{Math.min(
						requestsPagination.page * requestsPagination.pageSize,
						requestsPagination.totalCount
					)} of {requestsPagination.totalCount} requests
				</p>

				<div class="flex gap-2">
					{#if requestsPagination.hasPrev}
						<a
							href="?tab=requests&page={requestsPagination.page -
								1}&page_size={requestsPagination.pageSize}{activeStatusFilter
								? `&status=${activeStatusFilter}`
								: ''}{searchQuery ? `&search=${searchQuery}` : ''}"
							class="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							{m['eventInvitationsAdmin.previous']()}
						</a>
					{/if}

					{#if requestsPagination.hasNext}
						<a
							href="?tab=requests&page={requestsPagination.page +
								1}&page_size={requestsPagination.pageSize}{activeStatusFilter
								? `&status=${activeStatusFilter}`
								: ''}{searchQuery ? `&search=${searchQuery}` : ''}"
							class="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							{m['eventInvitationsAdmin.next']()}
						</a>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>
