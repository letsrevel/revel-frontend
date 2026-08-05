<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventInvitationRequestInternalSchema } from '$lib/api/generated/types.gen';
	import { enhance } from '$app/forms';
	import { Users, Check, X, Calendar, Search } from '@lucide/svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { cn } from '$lib/utils/cn';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import type { Tone } from '$lib/components/common/tones';

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

	const {
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

	function getStatusTone(status: string): Tone {
		switch (status) {
			case 'pending':
				return 'warning';
			case 'approved':
				return 'success';
			case 'rejected':
				return 'danger';
			default:
				return 'neutral';
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
				placeholder={m['invitationRequestsTab.searchPlaceholder']()}
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
					'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
					activeStatusFilter === 'pending'
						? 'border-highlight bg-highlight text-highlight-foreground'
						: 'border-highlight/50 bg-card text-foreground hover:bg-highlight/10'
				)}
			>
				{m['eventInvitationsAdmin.filterPending']()}
			</button>
			<button
				type="button"
				onclick={() => onFilterByStatus('approved')}
				class={cn(
					'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
					activeStatusFilter === 'approved'
						? 'border-success bg-success text-success-foreground'
						: 'border-success/50 bg-card text-foreground hover:bg-success/10'
				)}
			>
				{m['eventInvitationsAdmin.filterApproved']()}
			</button>
			<button
				type="button"
				onclick={() => onFilterByStatus('rejected')}
				class={cn(
					'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
					activeStatusFilter === 'rejected'
						? 'border-destructive bg-destructive text-destructive-foreground'
						: 'border-destructive/50 bg-card text-foreground hover:bg-destructive/10'
				)}
			>
				{m['eventInvitationsAdmin.filterRejected']()}
			</button>
		</div>
	</div>

	<!-- Requests List -->
	{#if invitationRequests.length === 0}
		<EmptyState
			icon={Users}
			title={m['eventInvitationsAdmin.noRequests']()}
			body={activeStatusFilter || searchQuery
				? m['eventInvitationsAdmin.noRequestsFiltered']()
				: m['eventInvitationsAdmin.noRequestsEmpty']()}
			level={2}
		/>
	{:else}
		<!-- Requests Table -->
		<div class="overflow-hidden rounded-lg border bg-card">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="border-b bg-muted/50">
						<tr>
							<th
								class="px-6 py-3 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
							>
								{m['eventInvitationsAdmin.headerUser']()}
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
							>
								{m['eventInvitationsAdmin.headerMessage']()}
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
							>
								{m['eventInvitationsAdmin.headerStatus']()}
							</th>
							<th
								class="px-6 py-3 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
							>
								{m['eventInvitationsAdmin.headerRequested']()}
							</th>
							<th
								class="px-6 py-3 text-right text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
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
									<StatusBadge
										tone={getStatusTone(request.status ?? '')}
										label={(request.status ?? '').charAt(0).toUpperCase() +
											(request.status ?? '').slice(1)}
									/>
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
													class="inline-flex items-center gap-1 rounded-md bg-success px-3 py-1.5 text-xs font-medium text-success-foreground transition-colors hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
													class="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
					{m['invitationRequestsTab.showingRange']({
						from: (requestsPagination.page - 1) * requestsPagination.pageSize + 1,
						to: Math.min(
							requestsPagination.page * requestsPagination.pageSize,
							requestsPagination.totalCount
						),
						total: requestsPagination.totalCount
					})}
				</p>

				<div class="flex gap-2">
					{#if requestsPagination.hasPrev}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() validates the path; the appended query/fragment cannot be expressed through resolve() -->
						<a
							href="?tab=requests&page={requestsPagination.page -
								1}&page_size={requestsPagination.pageSize}{activeStatusFilter
								? `&status=${activeStatusFilter}`
								: ''}{searchQuery ? `&search=${searchQuery}` : ''}"
							class="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							{m['eventInvitationsAdmin.previous']()}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}

					{#if requestsPagination.hasNext}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() validates the path; the appended query/fragment cannot be expressed through resolve() -->
						<a
							href="?tab=requests&page={requestsPagination.page +
								1}&page_size={requestsPagination.pageSize}{activeStatusFilter
								? `&status=${activeStatusFilter}`
								: ''}{searchQuery ? `&search=${searchQuery}` : ''}"
							class="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							{m['eventInvitationsAdmin.next']()}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>
