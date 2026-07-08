<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { ShieldAlert, Loader2, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { WhitelistRequestCard } from '$lib/components/blacklist';
	import type { WhitelistRequestSchema } from '$lib/api/generated/types.gen';
	import type { RequestStatus } from '$lib/types/request-status';

	interface PaginationInfo {
		page: number;
		totalCount: number;
		totalPages: number;
		hasNext: boolean;
		hasPrev: boolean;
	}

	interface Props {
		requests: WhitelistRequestSchema[];
		isLoading: boolean;
		isError: boolean;
		pagination: PaginationInfo;
		statusFilter: RequestStatus | 'all';
		currentPage: number;
		onApprove: (request: WhitelistRequestSchema) => void;
		onReject: (request: WhitelistRequestSchema) => void;
		isProcessing: boolean;
	}

	let {
		requests,
		isLoading,
		isError,
		pagination,
		statusFilter = $bindable(),
		currentPage = $bindable(),
		onApprove,
		onReject,
		isProcessing
	}: Props = $props();
</script>

<!-- Filter Buttons -->
<div class="flex flex-wrap items-center gap-2">
	<Button
		variant={statusFilter === 'pending' ? 'default' : 'outline'}
		size="sm"
		onclick={() => {
			statusFilter = 'pending';
			currentPage = 1;
		}}
	>
		{m['blacklistAdminPage.filterPending']()}
		{#if statusFilter === 'pending' && pagination.totalCount}
			<span class="ml-1.5 rounded-full bg-primary-foreground px-1.5 py-0.5 text-xs text-primary">
				{pagination.totalCount}
			</span>
		{/if}
	</Button>
	<Button
		variant={statusFilter === 'approved' ? 'default' : 'outline'}
		size="sm"
		onclick={() => {
			statusFilter = 'approved';
			currentPage = 1;
		}}
	>
		{m['blacklistAdminPage.filterApproved']()}
	</Button>
	<Button
		variant={statusFilter === 'rejected' ? 'default' : 'outline'}
		size="sm"
		onclick={() => {
			statusFilter = 'rejected';
			currentPage = 1;
		}}
	>
		{m['blacklistAdminPage.filterRejected']()}
	</Button>
	<Button
		variant={statusFilter === 'all' ? 'default' : 'outline'}
		size="sm"
		onclick={() => {
			statusFilter = 'all';
			currentPage = 1;
		}}
	>
		{m['blacklistAdminPage.filterAll']()}
	</Button>
</div>

<!-- Info Box -->
<div class="rounded-lg border border-blue-500/30 bg-blue-50 p-3 dark:bg-blue-950/30">
	<p class="text-sm text-blue-900 dark:text-blue-100">
		{m['blacklistAdminPage.requestsInfo']()}
	</p>
</div>

<!-- Requests List -->
{#if isLoading}
	<div class="flex items-center justify-center py-12">
		<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
	</div>
{:else if isError}
	<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
		<p class="text-sm text-destructive">
			{m['blacklistAdminPage.loadRequestsError']()}
		</p>
	</div>
{:else if requests.length === 0}
	<div class="rounded-lg border border-dashed p-12 text-center">
		<ShieldAlert class="mx-auto h-12 w-12 text-muted-foreground" />
		<h3 class="mt-4 font-semibold">{m['blacklistAdminPage.noRequests']()}</h3>
		<p class="mt-2 text-sm text-muted-foreground">
			{statusFilter === 'pending'
				? m['blacklistAdminPage.noPendingRequests']()
				: m['blacklistAdminPage.noRequestsMatchFilter']()}
		</p>
	</div>
{:else}
	<div class="grid gap-4 md:grid-cols-2">
		{#each requests as request (request.id)}
			<WhitelistRequestCard
				{request}
				{onApprove}
				{onReject}
				{isProcessing}
				showActions={request.status === 'pending'}
			/>
		{/each}
	</div>

	<!-- Pagination -->
	{#if pagination.totalPages > 1}
		<div class="flex items-center justify-center gap-2 pt-4">
			<Button
				variant="outline"
				size="sm"
				disabled={!pagination.hasPrev}
				onclick={() => (currentPage = currentPage - 1)}
			>
				<ChevronLeft class="h-4 w-4" />
				{m['blacklistAdminPage.previous']()}
			</Button>
			<span class="text-sm text-muted-foreground">
				{m['blacklistAdminPage.pageOf']({
					page: pagination.page,
					total: pagination.totalPages
				})}
			</span>
			<Button
				variant="outline"
				size="sm"
				disabled={!pagination.hasNext}
				onclick={() => (currentPage = currentPage + 1)}
			>
				{m['blacklistAdminPage.next']()}
				<ChevronRight class="h-4 w-4" />
			</Button>
		</div>
	{/if}
{/if}
