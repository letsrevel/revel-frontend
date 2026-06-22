<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
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
			toast.success(m['blacklistAdminPage.toastAdded']());
		},
		onError: () => {
			toast.error(m['blacklistAdminPage.toastAddError']());
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
			toast.success(m['blacklistAdminPage.toastUpdated']());
		},
		onError: () => {
			toast.error(m['blacklistAdminPage.toastUpdateError']());
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
			toast.success(m['blacklistAdminPage.toastRemoved']());
		},
		onError: () => {
			toast.error(m['blacklistAdminPage.toastRemoveError']());
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
			toast.success(m['blacklistAdminPage.toastRequestApproved']());
		},
		onError: () => {
			toast.error(m['blacklistAdminPage.toastRequestApproveError']());
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
			toast.success(m['blacklistAdminPage.toastRequestRejected']());
		},
		onError: () => {
			toast.error(m['blacklistAdminPage.toastRequestRejectError']());
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
			toast.success(m['blacklistAdminPage.toastWhitelistRemoved']());
		},
		onError: () => {
			toast.error(m['blacklistAdminPage.toastWhitelistRemoveError']());
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
	const blacklistEntries = $derived(blacklistQuery.data?.results || []);
	const blacklistPagination = $derived({
		page: blacklistPage,
		totalCount: blacklistQuery.data?.count || 0,
		totalPages: Math.ceil((blacklistQuery.data?.count || 0) / pageSize),
		hasNext: blacklistQuery.data?.next !== null,
		hasPrev: blacklistQuery.data?.previous !== null
	});

	const whitelistRequests = $derived(whitelistRequestsQuery.data?.results || []);
	const requestsPagination = $derived({
		page: requestsPage,
		totalCount: whitelistRequestsQuery.data?.count || 0,
		totalPages: Math.ceil((whitelistRequestsQuery.data?.count || 0) / pageSize),
		hasNext: whitelistRequestsQuery.data?.next !== null,
		hasPrev: whitelistRequestsQuery.data?.previous !== null
	});

	const whitelistEntries = $derived(whitelistQuery.data?.results || []);
	const whitelistPagination = $derived({
		page: whitelistPage,
		totalCount: whitelistQuery.data?.count || 0,
		totalPages: Math.ceil((whitelistQuery.data?.count || 0) / pageSize),
		hasNext: whitelistQuery.data?.next !== null,
		hasPrev: whitelistQuery.data?.previous !== null
	});

	// Count pending requests for badge
	const pendingRequestsCount = $derived(
		requestStatusFilter === 'pending' ? whitelistRequestsQuery.data?.count || 0 : 0
	);
</script>

<svelte:head>
	<title>{m['blacklistAdminPage.metaTitle']({ name: organization.name })}</title>
	<meta
		name="description"
		content={m['blacklistAdminPage.metaDescription']({ name: organization.name })}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6 px-4 md:px-0">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
				{m['blacklistAdminPage.title']()}
			</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{m['blacklistAdminPage.pageDescription']()}
			</p>
		</div>
		<Button onclick={() => (createModalOpen = true)} class="w-full sm:w-auto">
			<Plus class="mr-2 h-4 w-4" aria-hidden="true" />
			{m['blacklistAdminPage.addToBlacklist']()}
		</Button>
	</div>

	<!-- Tabs -->
	<Tabs bind:value={activeTab} class="w-full">
		<div class="sticky top-32 z-20 -mb-px bg-background pb-3 pt-1">
			<TabsList class="h-auto w-full grid-cols-3 gap-0.5 sm:gap-1">
				<TabsTrigger value="blacklist" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
					<Ban class="h-4 w-4 shrink-0" />
					<span class="hidden sm:inline">{m['blacklistAdminPage.tabBlacklist']()}</span>
					<span class="sm:hidden">{m['blacklistAdminPage.tabBlacklistShort']()}</span>
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
					<span class="hidden sm:inline">{m['blacklistAdminPage.tabVerificationRequests']()}</span>
					<span class="sm:hidden">{m['blacklistAdminPage.tabRequestsShort']()}</span>
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
					<span class="hidden sm:inline">{m['blacklistAdminPage.tabVerifiedUsers']()}</span>
					<span class="sm:hidden">{m['blacklistAdminPage.tabVerifiedShort']()}</span>
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
					placeholder={m['blacklistAdminPage.searchPlaceholder']()}
					bind:value={blacklistSearch}
					class="pl-10"
					aria-label={m['blacklistAdminPage.searchAriaLabel']()}
				/>
			</div>

			<!-- Info Box -->
			<div class="rounded-lg border border-amber-500/30 bg-amber-50 p-3 dark:bg-amber-950/30">
				<p class="text-sm text-amber-900 dark:text-amber-100">
					{m['blacklistAdminPage.blacklistInfo']()}
				</p>
			</div>

			<!-- Blacklist List -->
			{#if blacklistQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if blacklistQuery.isError}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
					<p class="text-sm text-destructive">{m['blacklistAdminPage.loadBlacklistError']()}</p>
				</div>
			{:else if blacklistEntries.length === 0}
				<div class="rounded-lg border border-dashed p-12 text-center">
					<Ban class="mx-auto h-12 w-12 text-muted-foreground" />
					<h3 class="mt-4 font-semibold">{m['blacklistAdminPage.noEntries']()}</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						{blacklistSearch
							? m['blacklistAdminPage.noEntriesMatchSearch']()
							: m['blacklistAdminPage.noEntriesHint']()}
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
							{m['blacklistAdminPage.previous']()}
						</Button>
						<span class="text-sm text-muted-foreground">
							{m['blacklistAdminPage.pageOf']({
								page: blacklistPagination.page,
								total: blacklistPagination.totalPages
							})}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={!blacklistPagination.hasNext}
							onclick={() => (blacklistPage = blacklistPage + 1)}
						>
							{m['blacklistAdminPage.next']()}
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
					{m['blacklistAdminPage.filterPending']()}
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
					{m['blacklistAdminPage.filterApproved']()}
				</Button>
				<Button
					variant={requestStatusFilter === 'rejected' ? 'default' : 'outline'}
					size="sm"
					onclick={() => {
						requestStatusFilter = 'rejected';
						requestsPage = 1;
					}}
				>
					{m['blacklistAdminPage.filterRejected']()}
				</Button>
				<Button
					variant={requestStatusFilter === 'all' ? 'default' : 'outline'}
					size="sm"
					onclick={() => {
						requestStatusFilter = 'all';
						requestsPage = 1;
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
			{#if whitelistRequestsQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if whitelistRequestsQuery.isError}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
					<p class="text-sm text-destructive">
						{m['blacklistAdminPage.loadRequestsError']()}
					</p>
				</div>
			{:else if whitelistRequests.length === 0}
				<div class="rounded-lg border border-dashed p-12 text-center">
					<ShieldAlert class="mx-auto h-12 w-12 text-muted-foreground" />
					<h3 class="mt-4 font-semibold">{m['blacklistAdminPage.noRequests']()}</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						{requestStatusFilter === 'pending'
							? m['blacklistAdminPage.noPendingRequests']()
							: m['blacklistAdminPage.noRequestsMatchFilter']()}
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
							{m['blacklistAdminPage.previous']()}
						</Button>
						<span class="text-sm text-muted-foreground">
							{m['blacklistAdminPage.pageOf']({
								page: requestsPagination.page,
								total: requestsPagination.totalPages
							})}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={!requestsPagination.hasNext}
							onclick={() => (requestsPage = requestsPage + 1)}
						>
							{m['blacklistAdminPage.next']()}
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
					{m['blacklistAdminPage.verifiedInfo']()}
				</p>
			</div>

			<!-- Whitelist List -->
			{#if whitelistQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if whitelistQuery.isError}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
					<p class="text-sm text-destructive">{m['blacklistAdminPage.loadVerifiedError']()}</p>
				</div>
			{:else if whitelistEntries.length === 0}
				<div class="rounded-lg border border-dashed p-12 text-center">
					<ShieldCheck class="mx-auto h-12 w-12 text-muted-foreground" />
					<h3 class="mt-4 font-semibold">{m['blacklistAdminPage.noVerifiedUsers']()}</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						{m['blacklistAdminPage.noVerifiedUsersHint']()}
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
							{m['blacklistAdminPage.previous']()}
						</Button>
						<span class="text-sm text-muted-foreground">
							{m['blacklistAdminPage.pageOf']({
								page: whitelistPagination.page,
								total: whitelistPagination.totalPages
							})}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={!whitelistPagination.hasNext}
							onclick={() => (whitelistPage = whitelistPage + 1)}
						>
							{m['blacklistAdminPage.next']()}
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
	title={m['blacklistAdminPage.removeVerifiedTitle']()}
	message={m['blacklistAdminPage.removeVerifiedMessage']({
		name: whitelistEntryToDelete?.user_display_name ?? ''
	})}
	confirmText={m['blacklistAdminPage.removeConfirm']()}
	cancelText={m['blacklistAdminPage.removeCancel']()}
	variant="danger"
	onConfirm={confirmRemoveWhitelistEntry}
	onCancel={() => (whitelistEntryToDelete = null)}
/>
