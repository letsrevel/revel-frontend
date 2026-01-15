<script lang="ts">
	import { page } from '$app/stores';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminblacklistListBlacklist,
		organizationadminblacklistCreateBlacklistEntry,
		organizationadminblacklistUpdateBlacklistEntry,
		organizationadminblacklistDeleteBlacklistEntry,
		organizationadminwhitelistListWhitelistRequests,
		organizationadminwhitelistApproveWhitelistRequest,
		organizationadminwhitelistRejectWhitelistRequest,
		organizationadminwhitelistListWhitelist,
		organizationadminwhitelistDeleteWhitelistEntry
	} from '$lib/api/generated/sdk.gen';
	import type {
		BlacklistEntrySchema,
		BlacklistCreateSchema,
		WhitelistRequestSchema,
		WhitelistEntrySchema,
		Status
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import {
		Search,
		Ban,
		ShieldCheck,
		ShieldAlert,
		Plus,
		Loader2,
		ChevronLeft,
		ChevronRight
	} from 'lucide-svelte';
	import {
		BlacklistEntryCard,
		BlacklistEntryModal,
		CreateBlacklistModal,
		WhitelistRequestCard,
		WhitelistEntryCard
	} from '$lib/components/blacklist';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import { toast } from 'svelte-sonner';

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Active tab state
	let activeTab = $state('blacklist');

	// Search state
	let blacklistSearch = $state('');

	// Filter state for whitelist requests
	let requestStatusFilter = $state<Status | 'all'>('pending');
	let requestsPage = $state(1);

	// Pagination state
	let blacklistPage = $state(1);
	let whitelistPage = $state(1);
	const pageSize = 20;

	// Modal states
	let createModalOpen = $state(false);
	let editEntry = $state<BlacklistEntrySchema | null>(null);
	let editModalOpen = $state(false);

	// Delete confirmation states
	let entryToDelete = $state<BlacklistEntrySchema | null>(null);
	let whitelistEntryToDelete = $state<WhitelistEntrySchema | null>(null);

	// Fetch blacklist entries
	const blacklistQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'blacklist', blacklistSearch, blacklistPage],
		queryFn: async () => {
			const response = await organizationadminblacklistListBlacklist({
				path: { slug: organization.slug },
				query: {
					search: blacklistSearch || undefined,
					page: blacklistPage,
					page_size: pageSize
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch blacklist');
			}

			return response.data;
		},
		enabled: !!accessToken
	}));

	// Fetch whitelist requests
	const whitelistRequestsQuery = createQuery(() => ({
		queryKey: [
			'organization',
			organization.slug,
			'whitelist-requests',
			requestStatusFilter,
			requestsPage
		],
		queryFn: async () => {
			const response = await organizationadminwhitelistListWhitelistRequests({
				path: { slug: organization.slug },
				query: {
					status: requestStatusFilter !== 'all' ? requestStatusFilter : undefined,
					page: requestsPage,
					page_size: pageSize
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch whitelist requests');
			}

			return response.data;
		},
		enabled: !!accessToken
	}));

	// Fetch whitelist entries
	const whitelistQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'whitelist', whitelistPage],
		queryFn: async () => {
			const response = await organizationadminwhitelistListWhitelist({
				path: { slug: organization.slug },
				query: {
					page: whitelistPage,
					page_size: pageSize
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch whitelist');
			}

			return response.data;
		},
		enabled: !!accessToken
	}));

	// Create blacklist entry mutation
	const createBlacklistMutation = createMutation(() => ({
		mutationFn: async (data: BlacklistCreateSchema) => {
			const response = await organizationadminblacklistCreateBlacklistEntry({
				path: { slug: organization.slug },
				body: data,
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to create blacklist entry');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'blacklist']
			});
			createModalOpen = false;
			toast.success('Added to blacklist');
		},
		onError: () => {
			toast.error('Failed to add to blacklist');
		}
	}));

	// Update blacklist entry mutation
	const updateBlacklistMutation = createMutation(() => ({
		mutationFn: async ({
			entryId,
			data
		}: {
			entryId: string;
			data: { reason?: string; first_name?: string; last_name?: string; preferred_name?: string };
		}) => {
			const response = await organizationadminblacklistUpdateBlacklistEntry({
				path: { slug: organization.slug, entry_id: entryId },
				body: data,
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to update blacklist entry');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'blacklist']
			});
			editModalOpen = false;
			editEntry = null;
			toast.success('Blacklist entry updated');
		},
		onError: () => {
			toast.error('Failed to update blacklist entry');
		}
	}));

	// Delete blacklist entry mutation
	const deleteBlacklistMutation = createMutation(() => ({
		mutationFn: async (entryId: string) => {
			const response = await organizationadminblacklistDeleteBlacklistEntry({
				path: { slug: organization.slug, entry_id: entryId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to delete blacklist entry');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'blacklist']
			});
			editModalOpen = false;
			editEntry = null;
			entryToDelete = null;
			toast.success('Removed from blacklist');
		},
		onError: () => {
			toast.error('Failed to remove from blacklist');
		}
	}));

	// Approve whitelist request mutation
	const approveRequestMutation = createMutation(() => ({
		mutationFn: async (requestId: string) => {
			const response = await organizationadminwhitelistApproveWhitelistRequest({
				path: { slug: organization.slug, request_id: requestId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to approve whitelist request');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'whitelist-requests']
			});
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'whitelist']
			});
			toast.success('Whitelist request approved');
		},
		onError: () => {
			toast.error('Failed to approve whitelist request');
		}
	}));

	// Reject whitelist request mutation
	const rejectRequestMutation = createMutation(() => ({
		mutationFn: async (requestId: string) => {
			const response = await organizationadminwhitelistRejectWhitelistRequest({
				path: { slug: organization.slug, request_id: requestId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to reject whitelist request');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'whitelist-requests']
			});
			toast.success('Whitelist request rejected');
		},
		onError: () => {
			toast.error('Failed to reject whitelist request');
		}
	}));

	// Delete whitelist entry mutation
	const deleteWhitelistMutation = createMutation(() => ({
		mutationFn: async (entryId: string) => {
			const response = await organizationadminwhitelistDeleteWhitelistEntry({
				path: { slug: organization.slug, entry_id: entryId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to remove from whitelist');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'whitelist']
			});
			whitelistEntryToDelete = null;
			toast.success('Removed from whitelist');
		},
		onError: () => {
			toast.error('Failed to remove from whitelist');
		}
	}));

	// Handlers
	function handleManageEntry(entry: BlacklistEntrySchema) {
		editEntry = entry;
		editModalOpen = true;
	}

	function handleUpdateEntry(updates: {
		reason?: string;
		first_name?: string;
		last_name?: string;
		preferred_name?: string;
	}) {
		if (editEntry?.id) {
			updateBlacklistMutation.mutate({ entryId: editEntry.id, data: updates });
		}
	}

	function handleDeleteEntry() {
		if (editEntry?.id) {
			deleteBlacklistMutation.mutate(editEntry.id);
		}
	}

	function handleApproveRequest(request: WhitelistRequestSchema) {
		if (request.id) {
			approveRequestMutation.mutate(request.id);
		}
	}

	function handleRejectRequest(request: WhitelistRequestSchema) {
		if (request.id) {
			rejectRequestMutation.mutate(request.id);
		}
	}

	function handleRemoveWhitelistEntry(entry: WhitelistEntrySchema) {
		whitelistEntryToDelete = entry;
	}

	function confirmRemoveWhitelistEntry() {
		if (whitelistEntryToDelete?.id) {
			deleteWhitelistMutation.mutate(whitelistEntryToDelete.id);
		}
	}

	// Derived data
	let blacklistEntries = $derived(blacklistQuery.data?.results || []);
	let blacklistPagination = $derived({
		page: blacklistPage,
		totalCount: blacklistQuery.data?.count || 0,
		totalPages: Math.ceil((blacklistQuery.data?.count || 0) / pageSize),
		hasNext: blacklistQuery.data?.next !== null,
		hasPrev: blacklistQuery.data?.previous !== null
	});

	let whitelistRequests = $derived(whitelistRequestsQuery.data?.results || []);
	let requestsPagination = $derived({
		page: requestsPage,
		totalCount: whitelistRequestsQuery.data?.count || 0,
		totalPages: Math.ceil((whitelistRequestsQuery.data?.count || 0) / pageSize),
		hasNext: whitelistRequestsQuery.data?.next !== null,
		hasPrev: whitelistRequestsQuery.data?.previous !== null
	});

	let whitelistEntries = $derived(whitelistQuery.data?.results || []);
	let whitelistPagination = $derived({
		page: whitelistPage,
		totalCount: whitelistQuery.data?.count || 0,
		totalPages: Math.ceil((whitelistQuery.data?.count || 0) / pageSize),
		hasNext: whitelistQuery.data?.next !== null,
		hasPrev: whitelistQuery.data?.previous !== null
	});

	// Count pending requests for badge
	let pendingRequestsCount = $derived(
		requestStatusFilter === 'pending' ? whitelistRequestsQuery.data?.count || 0 : 0
	);
</script>

<svelte:head>
	<title>Blacklist Management - {organization.name} | Revel</title>
	<meta name="description" content="Manage blacklisted users for {organization.name}" />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6 px-4 md:px-0">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">Blacklist Management</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Manage blacklisted users and verification requests for your organization.
			</p>
		</div>
		<Button onclick={() => (createModalOpen = true)} class="w-full sm:w-auto">
			<Plus class="mr-2 h-4 w-4" aria-hidden="true" />
			Add to Blacklist
		</Button>
	</div>

	<!-- Tabs -->
	<Tabs bind:value={activeTab} class="w-full">
		<div class="sticky top-32 z-20 -mb-px bg-background pb-3 pt-1">
			<TabsList class="h-auto w-full grid-cols-3 gap-0.5 sm:gap-1">
				<TabsTrigger value="blacklist" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
					<Ban class="h-4 w-4 shrink-0" />
					<span class="hidden sm:inline">Blacklist</span>
					<span class="sm:hidden">Blocked</span>
					{#if blacklistPagination.totalCount > 0}
						<span class="hidden text-xs text-muted-foreground lg:inline">
							({blacklistPagination.totalCount})
						</span>
					{/if}
				</TabsTrigger>

				<TabsTrigger
					value="verification-requests"
					class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
				>
					<ShieldAlert class="h-4 w-4 shrink-0" />
					<span class="hidden sm:inline">Verification Requests</span>
					<span class="sm:hidden">Requests</span>
					{#if pendingRequestsCount > 0}
						<span
							class="rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground sm:px-2"
						>
							{pendingRequestsCount}
						</span>
					{/if}
				</TabsTrigger>

				<TabsTrigger value="verified" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
					<ShieldCheck class="h-4 w-4 shrink-0" />
					<span class="hidden sm:inline">Verified Users</span>
					<span class="sm:hidden">Verified</span>
					{#if whitelistPagination.totalCount > 0}
						<span class="hidden text-xs text-muted-foreground lg:inline">
							({whitelistPagination.totalCount})
						</span>
					{/if}
				</TabsTrigger>
			</TabsList>
		</div>

		<!-- Blacklist Tab -->
		<TabsContent value="blacklist" class="space-y-4">
			<!-- Search -->
			<div class="relative">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					type="search"
					placeholder="Search by name, email, or telegram..."
					bind:value={blacklistSearch}
					class="pl-10"
					aria-label="Search blacklist"
				/>
			</div>

			<!-- Info Box -->
			<div class="rounded-lg border border-amber-500/30 bg-amber-50 p-3 dark:bg-amber-950/30">
				<p class="text-sm text-amber-900 dark:text-amber-100">
					Blacklisted users cannot access any events from this organization. If someone's name
					fuzzy-matches a blacklist entry, they will need to request verification.
				</p>
			</div>

			<!-- Blacklist List -->
			{#if blacklistQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if blacklistQuery.isError}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
					<p class="text-sm text-destructive">Failed to load blacklist</p>
				</div>
			{:else if blacklistEntries.length === 0}
				<div class="rounded-lg border border-dashed p-12 text-center">
					<Ban class="mx-auto h-12 w-12 text-muted-foreground" />
					<h3 class="mt-4 font-semibold">No blacklist entries</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						{blacklistSearch
							? 'No entries match your search'
							: 'Add people to the blacklist to prevent them from accessing your events'}
					</p>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2">
					{#each blacklistEntries as entry (entry.id)}
						<BlacklistEntryCard {entry} onManage={handleManageEntry} />
					{/each}
				</div>

				<!-- Pagination -->
				{#if blacklistPagination.totalPages > 1}
					<div class="flex items-center justify-center gap-2 pt-4">
						<Button
							variant="outline"
							size="sm"
							disabled={!blacklistPagination.hasPrev}
							onclick={() => (blacklistPage = blacklistPage - 1)}
						>
							<ChevronLeft class="h-4 w-4" />
							Previous
						</Button>
						<span class="text-sm text-muted-foreground">
							Page {blacklistPagination.page} of {blacklistPagination.totalPages}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={!blacklistPagination.hasNext}
							onclick={() => (blacklistPage = blacklistPage + 1)}
						>
							Next
							<ChevronRight class="h-4 w-4" />
						</Button>
					</div>
				{/if}
			{/if}
		</TabsContent>

		<!-- Verification Requests Tab -->
		<TabsContent value="verification-requests" class="space-y-4">
			<!-- Filter Buttons -->
			<div class="flex flex-wrap items-center gap-2">
				<Button
					variant={requestStatusFilter === 'pending' ? 'default' : 'outline'}
					size="sm"
					onclick={() => {
						requestStatusFilter = 'pending';
						requestsPage = 1;
					}}
				>
					Pending
					{#if requestStatusFilter === 'pending' && whitelistRequestsQuery.data?.count}
						<span
							class="ml-1.5 rounded-full bg-primary-foreground px-1.5 py-0.5 text-xs text-primary"
						>
							{whitelistRequestsQuery.data.count}
						</span>
					{/if}
				</Button>
				<Button
					variant={requestStatusFilter === 'approved' ? 'default' : 'outline'}
					size="sm"
					onclick={() => {
						requestStatusFilter = 'approved';
						requestsPage = 1;
					}}
				>
					Approved
				</Button>
				<Button
					variant={requestStatusFilter === 'rejected' ? 'default' : 'outline'}
					size="sm"
					onclick={() => {
						requestStatusFilter = 'rejected';
						requestsPage = 1;
					}}
				>
					Rejected
				</Button>
				<Button
					variant={requestStatusFilter === 'all' ? 'default' : 'outline'}
					size="sm"
					onclick={() => {
						requestStatusFilter = 'all';
						requestsPage = 1;
					}}
				>
					All
				</Button>
			</div>

			<!-- Info Box -->
			<div class="rounded-lg border border-blue-500/30 bg-blue-50 p-3 dark:bg-blue-950/30">
				<p class="text-sm text-blue-900 dark:text-blue-100">
					Users whose names fuzzy-match blacklist entries can request verification. Approving a
					request adds them to the verified users list, allowing full access.
				</p>
			</div>

			<!-- Requests List -->
			{#if whitelistRequestsQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if whitelistRequestsQuery.isError}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
					<p class="text-sm text-destructive">Failed to load verification requests</p>
				</div>
			{:else if whitelistRequests.length === 0}
				<div class="rounded-lg border border-dashed p-12 text-center">
					<ShieldAlert class="mx-auto h-12 w-12 text-muted-foreground" />
					<h3 class="mt-4 font-semibold">No verification requests</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						{requestStatusFilter === 'pending'
							? 'No pending verification requests'
							: 'No requests match your filter'}
					</p>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2">
					{#each whitelistRequests as request (request.id)}
						<WhitelistRequestCard
							{request}
							onApprove={handleApproveRequest}
							onReject={handleRejectRequest}
							isProcessing={approveRequestMutation.isPending || rejectRequestMutation.isPending}
							showActions={request.status === 'pending'}
						/>
					{/each}
				</div>

				<!-- Pagination -->
				{#if requestsPagination.totalPages > 1}
					<div class="flex items-center justify-center gap-2 pt-4">
						<Button
							variant="outline"
							size="sm"
							disabled={!requestsPagination.hasPrev}
							onclick={() => (requestsPage = requestsPage - 1)}
						>
							<ChevronLeft class="h-4 w-4" />
							Previous
						</Button>
						<span class="text-sm text-muted-foreground">
							Page {requestsPagination.page} of {requestsPagination.totalPages}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={!requestsPagination.hasNext}
							onclick={() => (requestsPage = requestsPage + 1)}
						>
							Next
							<ChevronRight class="h-4 w-4" />
						</Button>
					</div>
				{/if}
			{/if}
		</TabsContent>

		<!-- Verified Users Tab -->
		<TabsContent value="verified" class="space-y-4">
			<!-- Info Box -->
			<div class="rounded-lg border border-green-500/30 bg-green-50 p-3 dark:bg-green-950/30">
				<p class="text-sm text-green-900 dark:text-green-100">
					Verified users have been cleared to access your organization despite their names
					fuzzy-matching blacklist entries. Removing them will require them to request verification
					again.
				</p>
			</div>

			<!-- Whitelist List -->
			{#if whitelistQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if whitelistQuery.isError}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
					<p class="text-sm text-destructive">Failed to load verified users</p>
				</div>
			{:else if whitelistEntries.length === 0}
				<div class="rounded-lg border border-dashed p-12 text-center">
					<ShieldCheck class="mx-auto h-12 w-12 text-muted-foreground" />
					<h3 class="mt-4 font-semibold">No verified users</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						Users approved through the verification process will appear here
					</p>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2">
					{#each whitelistEntries as entry (entry.id)}
						<WhitelistEntryCard
							{entry}
							onRemove={handleRemoveWhitelistEntry}
							isRemoving={deleteWhitelistMutation.isPending}
						/>
					{/each}
				</div>

				<!-- Pagination -->
				{#if whitelistPagination.totalPages > 1}
					<div class="flex items-center justify-center gap-2 pt-4">
						<Button
							variant="outline"
							size="sm"
							disabled={!whitelistPagination.hasPrev}
							onclick={() => (whitelistPage = whitelistPage - 1)}
						>
							<ChevronLeft class="h-4 w-4" />
							Previous
						</Button>
						<span class="text-sm text-muted-foreground">
							Page {whitelistPagination.page} of {whitelistPagination.totalPages}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={!whitelistPagination.hasNext}
							onclick={() => (whitelistPage = whitelistPage + 1)}
						>
							Next
							<ChevronRight class="h-4 w-4" />
						</Button>
					</div>
				{/if}
			{/if}
		</TabsContent>
	</Tabs>
</div>

<!-- Create Blacklist Entry Modal -->
<CreateBlacklistModal
	open={createModalOpen}
	onClose={() => (createModalOpen = false)}
	onCreate={(data) => createBlacklistMutation.mutate(data)}
	isCreating={createBlacklistMutation.isPending}
/>

<!-- Edit Blacklist Entry Modal -->
<BlacklistEntryModal
	entry={editEntry}
	open={editModalOpen}
	onClose={() => {
		editModalOpen = false;
		editEntry = null;
	}}
	onUpdate={handleUpdateEntry}
	onDelete={handleDeleteEntry}
	isUpdating={updateBlacklistMutation.isPending}
	isDeleting={deleteBlacklistMutation.isPending}
/>

<!-- Whitelist Entry Delete Confirmation -->
<ConfirmDialog
	isOpen={!!whitelistEntryToDelete}
	title="Remove from Verified Users"
	message="Are you sure you want to remove {whitelistEntryToDelete?.user_display_name} from the verified users list? They will need to request verification again to access your organization."
	confirmText="Remove"
	cancelText="Cancel"
	variant="danger"
	onConfirm={confirmRemoveWhitelistEntry}
	onCancel={() => (whitelistEntryToDelete = null)}
/>
