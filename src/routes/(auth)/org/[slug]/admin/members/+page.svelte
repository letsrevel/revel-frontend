<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminListMembers,
		organizationadminListStaff,
		organizationadminListMembershipRequests,
		organizationadminRemoveMember,
		organizationadminRemoveStaff,
		organizationadminApproveMembershipRequest,
		organizationadminRejectMembershipRequest,
		organizationadminUpdateStaffPermissions,
		organizationadminAddStaff
	} from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationMemberSchema,
		OrganizationStaffSchema,
		OrganizationMembershipRequestRetrieve,
		PermissionMap
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import { Input } from '$lib/components/ui/input';
	import { Search, Users, UserCog, UserPlus, Loader2 } from 'lucide-svelte';
	import MemberCard from '$lib/components/members/MemberCard.svelte';
	import StaffCard from '$lib/components/members/StaffCard.svelte';
	import MembershipRequestCard from '$lib/components/members/MembershipRequestCard.svelte';
	import PermissionsEditor from '$lib/components/members/PermissionsEditor.svelte';
	import PromoteToStaffDialog from '$lib/components/members/PromoteToStaffDialog.svelte';

	let { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Active tab state
	let activeTab = $state('members');

	// Search state for each tab
	let memberSearch = $state('');
	let staffSearch = $state('');

	// Permissions editor state
	let selectedStaff = $state<OrganizationStaffSchema | null>(null);
	let permissionsEditorOpen = $state(false);

	// Promote to staff dialog state
	let memberToPromote = $state<OrganizationMemberSchema | null>(null);
	let promoteDialogOpen = $state(false);

	// Fetch members
	const membersQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'members', memberSearch],
		queryFn: async () => {
			const response = await organizationadminListMembers({
				path: { slug: organization.slug },
				query: { search: memberSearch || undefined, page_size: 100 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch members');
			}

			return response.data;
		},
		enabled: !!accessToken
	}));

	// Fetch staff (use max page size to get all staff for cross-referencing)
	const staffQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'staff', staffSearch],
		queryFn: async () => {
			const response = await organizationadminListStaff({
				path: { slug: organization.slug },
				query: { search: staffSearch || undefined, page_size: 100 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch staff');
			}

			return response.data;
		},
		enabled: !!accessToken
	}));

	// Fetch membership requests
	const requestsQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'membership-requests'],
		queryFn: async () => {
			const response = await organizationadminListMembershipRequests({
				path: { slug: organization.slug },
				query: { page_size: 100 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch membership requests');
			}

			return response.data;
		},
		enabled: !!accessToken
	}));

	// Remove member mutation
	const removeMemberMutation = createMutation(() => ({
		mutationFn: async (member: OrganizationMemberSchema) => {
			const userId = member.user.id;
			if (!userId) {
				throw new Error('User ID not found in member data');
			}

			const response = await organizationadminRemoveMember({
				path: { slug: organization.slug, user_id: userId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to remove member');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'members']
			});
		},
		onError: (error: Error) => {
			alert(`Failed to remove member: ${error.message}`);
		}
	}));

	// Remove staff mutation
	const removeStaffMutation = createMutation(() => ({
		mutationFn: async (staff: OrganizationStaffSchema) => {
			const userId = staff.user.id;
			if (!userId) {
				throw new Error('User ID not found in staff data');
			}

			const response = await organizationadminRemoveStaff({
				path: { slug: organization.slug, user_id: userId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to remove staff');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['organization', organization.slug, 'staff'] });
		},
		onError: (error: Error) => {
			alert(`Failed to remove staff: ${error.message}`);
		}
	}));

	// Approve request mutation
	const approveRequestMutation = createMutation(() => ({
		mutationFn: async (request: OrganizationMembershipRequestRetrieve) => {
			if (!request.id) {
				throw new Error('Request ID not found');
			}

			const response = await organizationadminApproveMembershipRequest({
				path: { slug: organization.slug, request_id: request.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to approve request');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'membership-requests']
			});
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'members']
			});
		},
		onError: (error: Error) => {
			alert(`Failed to approve request: ${error.message}`);
		}
	}));

	// Reject request mutation
	const rejectRequestMutation = createMutation(() => ({
		mutationFn: async (request: OrganizationMembershipRequestRetrieve) => {
			if (!request.id) {
				throw new Error('Request ID not found');
			}

			const response = await organizationadminRejectMembershipRequest({
				path: { slug: organization.slug, request_id: request.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to reject request');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'membership-requests']
			});
		},
		onError: (error: Error) => {
			alert(`Failed to reject request: ${error.message}`);
		}
	}));

	// Update staff permissions mutation
	const updatePermissionsMutation = createMutation(() => ({
		mutationFn: async ({
			staff,
			permissions
		}: {
			staff: OrganizationStaffSchema;
			permissions: PermissionMap;
		}) => {
			const userId = staff.user.id;
			if (!userId) {
				throw new Error('User ID not found in staff data');
			}

			const response = await organizationadminUpdateStaffPermissions({
				path: { slug: organization.slug, user_id: userId },
				body: { default: permissions },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to update permissions');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['organization', organization.slug, 'staff'] });
			permissionsEditorOpen = false;
			selectedStaff = null;
		},
		onError: (error: Error) => {
			alert(`Failed to update permissions: ${error.message}`);
		}
	}));

	// Promote member to staff mutation
	const promoteToStaffMutation = createMutation(() => ({
		mutationFn: async (member: OrganizationMemberSchema) => {
			const userId = member.user.id;
			if (!userId) {
				throw new Error('User ID not found in member data');
			}

			const response = await organizationadminAddStaff({
				path: { slug: organization.slug, user_id: userId },
				// Pass null for default permissions
				body: null,
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to promote member to staff');
			}

			return response.data;
		},
		onSuccess: () => {
			// Invalidate both members and staff queries to refresh the lists
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'members']
			});
			queryClient.invalidateQueries({ queryKey: ['organization', organization.slug, 'staff'] });
			promoteDialogOpen = false;
			memberToPromote = null;
		},
		onError: (error: Error) => {
			alert(`Failed to promote to staff: ${error.message}`);
		}
	}));

	// Handlers
	function handleEditPermissions(staff: OrganizationStaffSchema) {
		selectedStaff = staff;
		permissionsEditorOpen = true;
	}

	function handleSavePermissions(permissions: PermissionMap) {
		if (selectedStaff) {
			updatePermissionsMutation.mutate({ staff: selectedStaff, permissions });
		}
	}

	function handleClosePermissionsEditor() {
		permissionsEditorOpen = false;
		selectedStaff = null;
	}

	function handleMakeStaff(member: OrganizationMemberSchema) {
		memberToPromote = member;
		promoteDialogOpen = true;
	}

	function handleConfirmPromotion() {
		if (memberToPromote) {
			promoteToStaffMutation.mutate(memberToPromote);
		}
	}

	function handleClosePromoteDialog() {
		if (!promoteToStaffMutation.isPending) {
			promoteDialogOpen = false;
			memberToPromote = null;
		}
	}

	// Derived data
	let members = $derived(membersQuery.data?.results || []);
	let staff = $derived(staffQuery.data?.results || []);
	let requests = $derived(requestsQuery.data?.results || []);

	// Create a Set of staff user IDs for quick lookup
	let staffUserIds = $derived(new Set(staff.map((s) => s.user.id).filter(Boolean)));

	// Count pending requests for badge
	let pendingRequestsCount = $derived(requests.length);
</script>

<svelte:head>
	<title>{m['orgAdmin.members.pageTitle']()} - {organization.name} | Revel</title>
	<meta name="description" content={m['orgAdmin.members.metaDescription']({ orgName: organization.name })} />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6 px-4 md:px-0">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold tracking-tight md:text-3xl">{m['orgAdmin.members.pageTitle']()}</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			{m['orgAdmin.members.pageDescription']()}
		</p>
	</div>

	<!-- Tabs -->
	<Tabs bind:value={activeTab} class="w-full">
		<TabsList class="grid w-full grid-cols-3 lg:w-auto">
			<TabsTrigger value="members" class="gap-2">
				<Users class="h-4 w-4" />
				<span>{m['orgAdmin.members.tabs.members']()}</span>
				{#if members.length > 0}
					<span class="text-xs text-muted-foreground">({members.length})</span>
				{/if}
			</TabsTrigger>

			<TabsTrigger value="staff" class="gap-2">
				<UserCog class="h-4 w-4" />
				<span>{m['orgAdmin.members.tabs.staff']()}</span>
				{#if staff.length > 0}
					<span class="text-xs text-muted-foreground">({staff.length})</span>
				{/if}
			</TabsTrigger>

			<TabsTrigger value="requests" class="gap-2">
				<UserPlus class="h-4 w-4" />
				<span>{m['orgAdmin.members.tabs.requests']()}</span>
				{#if pendingRequestsCount > 0}
					<span class="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
						{pendingRequestsCount}
					</span>
				{/if}
			</TabsTrigger>
		</TabsList>

		<!-- Members Tab -->
		<TabsContent value="members" class="space-y-4">
			<!-- Search -->
			<div class="relative">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					type="search"
					placeholder={m['orgAdmin.members.search.members']()}
					bind:value={memberSearch}
					class="pl-10"
					aria-label={m['orgAdmin.members.search.members']()}
				/>
			</div>

			<!-- Members List -->
			{#if membersQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if membersQuery.isError}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
					<p class="text-sm text-destructive">{m['orgAdmin.members.errors.loadMembers']()}</p>
				</div>
			{:else if members.length === 0}
				<div class="rounded-lg border border-dashed p-12 text-center">
					<Users class="mx-auto h-12 w-12 text-muted-foreground" />
					<h3 class="mt-4 font-semibold">{m['orgAdmin.members.empty.members.title']()}</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						{memberSearch
							? m['orgAdmin.members.empty.members.withSearch']()
							: m['orgAdmin.members.empty.members.noSearch']()}
					</p>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2">
					{#each members as member (member.user.email)}
						{@const isStaff = member.user.id ? staffUserIds.has(member.user.id) : false}
						<MemberCard
							{member}
							{isStaff}
							canRemove={data.isOwner}
							canMakeStaff={data.isOwner && !isStaff}
							onRemove={(m) => removeMemberMutation.mutate(m)}
							onMakeStaff={handleMakeStaff}
							isRemoving={removeMemberMutation.isPending}
							isPromoting={promoteToStaffMutation.isPending}
						/>
					{/each}
				</div>
			{/if}
		</TabsContent>

		<!-- Staff Tab -->
		<TabsContent value="staff" class="space-y-4">
			<!-- Search -->
			<div class="relative">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					type="search"
					placeholder={m['orgAdmin.members.search.staff']()}
					bind:value={staffSearch}
					class="pl-10"
					aria-label={m['orgAdmin.members.search.staff']()}
				/>
			</div>

			<!-- Owner Notice -->
			{#if data.isOwner}
				<div
					class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950"
				>
					<p class="text-sm text-blue-900 dark:text-blue-100">
						{m['orgAdmin.members.ownerNotice']()}
					</p>
				</div>
			{/if}

			<!-- Staff List -->
			{#if staffQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if staffQuery.isError}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
					<p class="text-sm text-destructive">{m['orgAdmin.members.errors.loadStaff']()}</p>
				</div>
			{:else if staff.length === 0}
				<div class="rounded-lg border border-dashed p-12 text-center">
					<UserCog class="mx-auto h-12 w-12 text-muted-foreground" />
					<h3 class="mt-4 font-semibold">{m['orgAdmin.members.empty.staff.title']()}</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						{staffSearch
							? m['orgAdmin.members.empty.staff.withSearch']()
							: m['orgAdmin.members.empty.staff.noSearch']()}
					</p>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2">
					{#each staff as staffMember (staffMember.user.email)}
						<StaffCard
							staff={staffMember}
							canRemove={data.isOwner}
							canEditPermissions={data.isOwner}
							onRemove={(s) => removeStaffMutation.mutate(s)}
							onEditPermissions={handleEditPermissions}
							isRemoving={removeStaffMutation.isPending}
						/>
					{/each}
				</div>
			{/if}
		</TabsContent>

		<!-- Requests Tab -->
		<TabsContent value="requests" class="space-y-4">
			{#if requestsQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if requestsQuery.isError}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
					<p class="text-sm text-destructive">{m['orgAdmin.members.errors.loadRequests']()}</p>
				</div>
			{:else if requests.length === 0}
				<div class="rounded-lg border border-dashed p-12 text-center">
					<UserPlus class="mx-auto h-12 w-12 text-muted-foreground" />
					<h3 class="mt-4 font-semibold">{m['orgAdmin.members.empty.requests.title']()}</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						{m['orgAdmin.members.empty.requests.description']()}
					</p>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2">
					{#each requests as request (request.id)}
						<MembershipRequestCard
							{request}
							onApprove={(r) => approveRequestMutation.mutate(r)}
							onReject={(r) => rejectRequestMutation.mutate(r)}
							isProcessing={approveRequestMutation.isPending || rejectRequestMutation.isPending}
						/>
					{/each}
				</div>
			{/if}
		</TabsContent>
	</Tabs>
</div>

<!-- Permissions Editor Dialog -->
<PermissionsEditor
	staff={selectedStaff}
	open={permissionsEditorOpen}
	onClose={handleClosePermissionsEditor}
	onSave={handleSavePermissions}
	isSaving={updatePermissionsMutation.isPending}
/>

<!-- Promote to Staff Dialog -->
<PromoteToStaffDialog
	member={memberToPromote}
	open={promoteDialogOpen}
	onClose={handleClosePromoteDialog}
	onConfirm={handleConfirmPromotion}
	isPromoting={promoteToStaffMutation.isPending}
/>
