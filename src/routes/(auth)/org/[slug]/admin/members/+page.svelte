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
		organizationadminAddStaff,
		organizationadminUpdateMember,
		organizationadminListMembershipTiers,
		organizationadminCreateMembershipTier,
		organizationadminUpdateMembershipTier,
		organizationadminDeleteMembershipTier,
		organizationadminListOrganizationTokens,
		organizationadminCreateOrganizationToken,
		organizationadminUpdateOrganizationToken,
		organizationadminDeleteOrganizationToken
	} from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationMemberSchema,
		OrganizationStaffSchema,
		OrganizationMembershipRequestRetrieve,
		PermissionMap,
		MembershipStatus,
		MembershipTierSchema,
		OrganizationTokenSchema,
		OrganizationTokenCreateSchema,
		OrganizationTokenUpdateSchema,
		Status
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import { Input } from '$lib/components/ui/input';
	import {
		Search,
		Users,
		UserCog,
		UserPlus,
		Loader2,
		Shield,
		Plus,
		Pencil,
		Trash2,
		Link
	} from 'lucide-svelte';
	import MemberCard from '$lib/components/members/MemberCard.svelte';
	import StaffCard from '$lib/components/members/StaffCard.svelte';
	import MembershipRequestCard from '$lib/components/members/MembershipRequestCard.svelte';
	import PermissionsEditor from '$lib/components/members/PermissionsEditor.svelte';
	import PromoteToStaffDialog from '$lib/components/members/PromoteToStaffDialog.svelte';
	import ManageMemberModal from '$lib/components/members/ManageMemberModal.svelte';
	import TierFormModal from '$lib/components/members/TierFormModal.svelte';
	import ApproveMembershipModal from '$lib/components/members/ApproveMembershipModal.svelte';
	import OrganizationTokenCard from '$lib/components/tokens/OrganizationTokenCard.svelte';
	import OrganizationTokenModal from '$lib/components/tokens/OrganizationTokenModal.svelte';
	import TokenShareDialog from '$lib/components/tokens/TokenShareDialog.svelte';
	import { Label } from '$lib/components/ui/label';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { canPerformAction } from '$lib/utils/permissions';
	import { getOrganizationTokenUrl } from '$lib/utils/tokens';
	import { toast } from 'svelte-sonner';

	let { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Active tab state
	let activeTab = $state('members');

	// Search state for each tab
	let memberSearch = $state('');
	let staffSearch = $state('');

	// Filter state for requests tab
	let requestStatusFilter = $state<Status | 'all'>('pending');
	let requestsPage = $state(1);

	// Filter state for members tab
	let memberStatusFilter = $state<MembershipStatus | 'all'>('all');
	let memberTierFilter = $state<string | 'all'>('all');

	// Permissions editor state
	let selectedStaff = $state<OrganizationStaffSchema | null>(null);
	let permissionsEditorOpen = $state(false);

	// Promote to staff dialog state
	let memberToPromote = $state<OrganizationMemberSchema | null>(null);
	let promoteDialogOpen = $state(false);

	// Manage member modal state
	let memberToManage = $state<OrganizationMemberSchema | null>(null);
	let manageMemberModalOpen = $state(false);

	// Approve membership request modal state
	let requestToApprove = $state<OrganizationMembershipRequestRetrieve | null>(null);
	let approveMembershipModalOpen = $state(false);

	// Tier management state
	let tierToEdit = $state<MembershipTierSchema | null>(null);
	let tierFormOpen = $state(false);
	let tierToDelete = $state<MembershipTierSchema | null>(null);
	let deleteConfirmOpen = $state(false);

	// Token management state
	let tokenSearch = $state('');
	let isCreateTokenModalOpen = $state(false);
	let tokenToEdit = $state<OrganizationTokenSchema | null>(null);
	let tokenToDelete = $state<OrganizationTokenSchema | null>(null);
	let tokenToShare = $state<OrganizationTokenSchema | null>(null);

	// Fetch members
	const membersQuery = createQuery(() => ({
		queryKey: [
			'organization',
			organization.slug,
			'members',
			memberSearch,
			memberStatusFilter,
			memberTierFilter
		],
		queryFn: async () => {
			const response = await organizationadminListMembers({
				path: { slug: organization.slug },
				query: {
					search: memberSearch || undefined,
					status: memberStatusFilter !== 'all' ? memberStatusFilter : undefined,
					tier_id: memberTierFilter !== 'all' ? memberTierFilter : undefined,
					page_size: 100
				},
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
		queryKey: [
			'organization',
			organization.slug,
			'membership-requests',
			requestStatusFilter,
			requestsPage
		],
		queryFn: async () => {
			const response = await organizationadminListMembershipRequests({
				path: { slug: organization.slug },
				query: {
					status: requestStatusFilter !== 'all' ? requestStatusFilter : undefined,
					page: requestsPage,
					page_size: 50
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch membership requests');
			}

			return response.data;
		},
		enabled: !!accessToken
	}));

	// Fetch membership tiers
	const tiersQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'membership-tiers'],
		queryFn: async () => {
			const response = await organizationadminListMembershipTiers({
				path: { slug: organization.slug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch membership tiers');
			}

			return response.data;
		},
		enabled: !!accessToken
	}));

	// Fetch tokens
	const tokensQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'tokens', tokenSearch],
		queryFn: async () => {
			const response = await organizationadminListOrganizationTokens({
				path: { slug: organization.slug },
				query: { search: tokenSearch || undefined, page_size: 100 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch tokens');
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
		mutationFn: async ({
			request,
			tierId
		}: {
			request: OrganizationMembershipRequestRetrieve;
			tierId: string;
		}) => {
			if (!request.id) {
				throw new Error('Request ID not found');
			}

			const response = await organizationadminApproveMembershipRequest({
				path: { slug: organization.slug, request_id: request.id },
				body: { tier_id: tierId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to approve request');
			}

			return response.data;
		},
		onSuccess: () => {
			// Close the modal
			approveMembershipModalOpen = false;
			requestToApprove = null;

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
			manageMemberModalOpen = false;
		},
		onError: (error: Error) => {
			alert(`Failed to promote to staff: ${error.message}`);
		}
	}));

	// Update member mutation (status and/or tier)
	const updateMemberMutation = createMutation(() => ({
		mutationFn: async ({
			member,
			status,
			tierId
		}: {
			member: OrganizationMemberSchema;
			status?: MembershipStatus;
			tierId?: string | null;
		}) => {
			const userId = member.user.id;
			if (!userId) {
				throw new Error('User ID not found in member data');
			}

			const response = await organizationadminUpdateMember({
				path: { slug: organization.slug, user_id: userId },
				body: {
					status: status,
					tier_id: tierId
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to update member');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'members']
			});
			manageMemberModalOpen = false;
		},
		onError: (error: Error) => {
			alert(`Failed to update member: ${error.message}`);
		}
	}));

	// Create tier mutation
	const createTierMutation = createMutation(() => ({
		mutationFn: async ({ name, description }: { name: string; description: string }) => {
			const response = await organizationadminCreateMembershipTier({
				path: { slug: organization.slug },
				body: { name, description },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to create tier');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'membership-tiers']
			});
		},
		onError: (error: Error) => {
			alert(`Failed to create tier: ${error.message}`);
		}
	}));

	// Update tier mutation
	const updateTierMutation = createMutation(() => ({
		mutationFn: async ({
			tierId,
			name,
			description
		}: {
			tierId: string;
			name: string;
			description: string;
		}) => {
			const response = await organizationadminUpdateMembershipTier({
				path: { slug: organization.slug, tier_id: tierId },
				body: { name, description },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to update tier');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'membership-tiers']
			});
			// Also invalidate members since tier names may be displayed
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'members']
			});
		},
		onError: (error: Error) => {
			alert(`Failed to update tier: ${error.message}`);
		}
	}));

	// Delete tier mutation
	const deleteTierMutation = createMutation(() => ({
		mutationFn: async (tierId: string) => {
			const response = await organizationadminDeleteMembershipTier({
				path: { slug: organization.slug, tier_id: tierId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to delete tier');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'membership-tiers']
			});
			// Also invalidate members since their tier assignments may change
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'members']
			});
		},
		onError: (error: Error) => {
			alert(`Failed to delete tier: ${error.message}`);
		}
	}));

	// Create token mutation
	const createTokenMutation = createMutation(() => ({
		mutationFn: async (tokenData: OrganizationTokenCreateSchema) => {
			const response = await organizationadminCreateOrganizationToken({
				path: { slug: organization.slug },
				body: tokenData,
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to create token');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'tokens']
			});
			isCreateTokenModalOpen = false;
			toast.success('Invitation link created successfully');
		},
		onError: () => {
			toast.error('Failed to create invitation link');
		}
	}));

	// Update token mutation
	const updateTokenMutation = createMutation(() => ({
		mutationFn: async ({
			tokenId,
			data: tokenData
		}: {
			tokenId: string;
			data: OrganizationTokenUpdateSchema;
		}) => {
			const response = await organizationadminUpdateOrganizationToken({
				path: { slug: organization.slug, token_id: tokenId },
				body: tokenData,
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to update token');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'tokens']
			});
			tokenToEdit = null;
			toast.success('Invitation link updated successfully');
		},
		onError: () => {
			toast.error('Failed to update invitation link');
		}
	}));

	// Delete token mutation
	const deleteTokenMutation = createMutation(() => ({
		mutationFn: async (tokenId: string) => {
			const response = await organizationadminDeleteOrganizationToken({
				path: { slug: organization.slug, token_id: tokenId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to delete token');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'tokens']
			});
			tokenToDelete = null;
			toast.success('Invitation link deleted successfully');
		},
		onError: () => {
			toast.error('Failed to delete invitation link');
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

	// Manage member handlers
	function handleManageMember(member: OrganizationMemberSchema) {
		memberToManage = member;
		manageMemberModalOpen = true;
	}

	function handleCloseManageMemberModal() {
		if (
			!updateMemberMutation.isPending &&
			!promoteToStaffMutation.isPending &&
			!removeMemberMutation.isPending
		) {
			manageMemberModalOpen = false;
			memberToManage = null;
		}
	}

	function handleUpdateMemberStatus(status: MembershipStatus) {
		if (memberToManage) {
			updateMemberMutation.mutate({ member: memberToManage, status });
		}
	}

	function handleUpdateMemberTier(tierId: string | null) {
		if (memberToManage) {
			updateMemberMutation.mutate({ member: memberToManage, tierId });
		}
	}

	function handleMakeStaffFromModal() {
		if (memberToManage) {
			promoteToStaffMutation.mutate(memberToManage);
		}
	}

	function handleRemoveMemberFromModal() {
		if (memberToManage) {
			removeMemberMutation.mutate(memberToManage);
		}
	}

	// Membership request approval handlers
	function handleApproveRequest(request: OrganizationMembershipRequestRetrieve) {
		// Check if we have tiers available
		if (tiers.length === 0) {
			toast.error('Cannot approve request: No membership tiers available');
			return;
		}

		// If only one tier, approve directly
		if (tiers.length === 1 && tiers[0].id) {
			approveRequestMutation.mutate({ request, tierId: tiers[0].id });
		} else {
			// Multiple tiers, show selection modal
			requestToApprove = request;
			approveMembershipModalOpen = true;
		}
	}

	function handleCloseApproveMembershipModal() {
		if (!approveRequestMutation.isPending) {
			approveMembershipModalOpen = false;
			requestToApprove = null;
		}
	}

	function handleConfirmApproveRequest(tierId: string) {
		if (requestToApprove) {
			approveRequestMutation.mutate({ request: requestToApprove, tierId });
		}
	}

	// Tier management handlers
	function handleCreateTier() {
		tierToEdit = null;
		tierFormOpen = true;
	}

	function handleEditTier(tier: MembershipTierSchema) {
		tierToEdit = tier;
		tierFormOpen = true;
	}

	function handleCloseTierForm() {
		if (!createTierMutation.isPending && !updateTierMutation.isPending) {
			tierFormOpen = false;
			tierToEdit = null;
		}
	}

	function handleSaveTier(name: string, description: string) {
		if (tierToEdit && tierToEdit.id) {
			// Edit mode
			updateTierMutation.mutate(
				{ tierId: tierToEdit.id, name, description },
				{
					onSuccess: () => {
						tierFormOpen = false;
						tierToEdit = null;
					}
				}
			);
		} else {
			// Create mode
			createTierMutation.mutate(
				{ name, description },
				{
					onSuccess: () => {
						tierFormOpen = false;
					}
				}
			);
		}
	}

	function handleDeleteTierClick(tier: MembershipTierSchema) {
		tierToDelete = tier;
		deleteConfirmOpen = true;
	}

	function handleConfirmDelete() {
		if (tierToDelete && tierToDelete.id) {
			deleteTierMutation.mutate(tierToDelete.id, {
				onSuccess: () => {
					deleteConfirmOpen = false;
					tierToDelete = null;
				}
			});
		}
	}

	function handleCancelDelete() {
		if (!deleteTierMutation.isPending) {
			deleteConfirmOpen = false;
			tierToDelete = null;
		}
	}

	// Token handlers
	function handleCreateTokenSave(data: OrganizationTokenCreateSchema) {
		createTokenMutation.mutate(data);
	}

	function handleEditTokenSave(data: OrganizationTokenUpdateSchema) {
		if (tokenToEdit?.id) {
			updateTokenMutation.mutate({ tokenId: tokenToEdit.id, data });
		}
	}

	function handleDeleteToken() {
		if (tokenToDelete?.id) {
			deleteTokenMutation.mutate(tokenToDelete.id);
		}
	}

	// Derived data
	let members = $derived(membersQuery.data?.results || []);
	let staff = $derived(staffQuery.data?.results || []);
	let requests = $derived(requestsQuery.data?.results || []);
	let requestsPagination = $derived({
		page: requestsPage,
		pageSize: 50,
		totalCount: requestsQuery.data?.count || 0,
		totalPages: Math.ceil((requestsQuery.data?.count || 0) / 50),
		hasNext: requestsQuery.data?.next !== null,
		hasPrev: requestsQuery.data?.previous !== null
	});
	let tiers = $derived(tiersQuery.data || []);
	let tokens = $derived(tokensQuery.data?.results || []);

	// Create a Set of staff user IDs for quick lookup
	let staffUserIds = $derived(new Set(staff.map((s) => s.user.id).filter(Boolean)));

	// Count pending requests for badge (need to fetch all pending to get accurate count)
	let pendingRequestsCount = $derived(
		requestStatusFilter === 'pending' ? requestsQuery.data?.count || 0 : 0
	);

	// Token share URL
	let shareUrl = $derived(
		tokenToShare ? getOrganizationTokenUrl(tokenToShare.id || '', organization.slug) : ''
	);
</script>

<svelte:head>
	<title>{m['orgAdmin.members.pageTitle']()} - {organization.name} | Revel</title>
	<meta
		name="description"
		content={m['orgAdmin.members.metaDescription']({ orgName: organization.name })}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6 px-4 md:px-0">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
				{m['orgAdmin.members.pageTitle']()}
			</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{m['orgAdmin.members.pageDescription']()}
			</p>
		</div>
		<Button onclick={() => (isCreateTokenModalOpen = true)} class="w-full sm:w-auto">
			<Plus class="mr-2 h-4 w-4" aria-hidden="true" />
			Invite members
		</Button>
	</div>

	<!-- Tabs -->
	<Tabs bind:value={activeTab} class="w-full">
		<div class="sticky top-32 z-20 -mb-px bg-background pb-3 pt-1">
			<TabsList class="h-auto w-full grid-cols-3 gap-0.5 sm:grid-cols-5 sm:gap-1">
				<TabsTrigger value="members" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
					<Users class="h-4 w-4 shrink-0" />
					<span class="hidden sm:inline">{m['orgAdmin.members.tabs.members']()}</span>
					<span class="sm:hidden">Members</span>
					{#if members.length > 0}
						<span class="hidden text-xs text-muted-foreground lg:inline">({members.length})</span>
					{/if}
				</TabsTrigger>

				<TabsTrigger value="staff" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
					<UserCog class="h-4 w-4 shrink-0" />
					<span class="hidden sm:inline">{m['orgAdmin.members.tabs.staff']()}</span>
					<span class="sm:hidden">Staff</span>
					{#if staff.length > 0}
						<span class="hidden text-xs text-muted-foreground lg:inline">({staff.length})</span>
					{/if}
				</TabsTrigger>

				<TabsTrigger value="requests" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
					<UserPlus class="h-4 w-4 shrink-0" />
					<span class="hidden sm:inline">{m['orgAdmin.members.tabs.requests']()}</span>
					<span class="sm:hidden">Requests</span>
					{#if pendingRequestsCount > 0}
						<span
							class="rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground sm:px-2"
						>
							{pendingRequestsCount}
						</span>
					{/if}
				</TabsTrigger>

				<TabsTrigger value="tiers" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
					<Shield class="h-4 w-4 shrink-0" />
					<span class="hidden sm:inline">{m['orgAdmin.members.tabs.tiers']()}</span>
					<span class="sm:hidden">Tiers</span>
					{#if tiers.length > 0}
						<span class="hidden text-xs text-muted-foreground lg:inline">({tiers.length})</span>
					{/if}
				</TabsTrigger>

				<TabsTrigger value="tokens" class="gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
					<Link class="h-4 w-4 shrink-0" />
					<span class="hidden sm:inline">Invite Links</span>
					<span class="sm:hidden">Links</span>
					{#if tokens.length > 0}
						<span class="hidden text-xs text-muted-foreground lg:inline">({tokens.length})</span>
					{/if}
				</TabsTrigger>
			</TabsList>
		</div>

		<!-- Members Tab -->
		<TabsContent value="members" class="space-y-4">
			<!-- Search and Filters -->
			<div class="space-y-3">
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

				<!-- Filters -->
				<div class="grid gap-3 md:grid-cols-2">
					<!-- Status Filter -->
					<div class="space-y-1.5">
						<Label for="status-filter" class="text-xs">
							{m['orgAdmin.members.filters.status']()}
						</Label>
						<Select
							type="single"
							value={memberStatusFilter}
							onValueChange={(value) => {
								memberStatusFilter = value as MembershipStatus | 'all';
							}}
						>
							<SelectTrigger id="status-filter" aria-label={m['orgAdmin.members.filters.status']()}>
								{memberStatusFilter === 'all'
									? m['orgAdmin.members.filters.allStatuses']()
									: m[`memberStatus.${memberStatusFilter}`]()}
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">{m['orgAdmin.members.filters.allStatuses']()}</SelectItem>
								<SelectItem value="active">{m['memberStatus.active']()}</SelectItem>
								<SelectItem value="paused">{m['memberStatus.paused']()}</SelectItem>
								<SelectItem value="cancelled">{m['memberStatus.cancelled']()}</SelectItem>
								<SelectItem value="banned">{m['memberStatus.banned']()}</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<!-- Tier Filter -->
					<div class="space-y-1.5">
						<Label for="tier-filter" class="text-xs">
							{m['orgAdmin.members.filters.tier']()}
						</Label>
						<Select
							type="single"
							value={memberTierFilter}
							onValueChange={(value) => {
								memberTierFilter = value as string | 'all';
							}}
						>
							<SelectTrigger id="tier-filter" aria-label={m['orgAdmin.members.filters.tier']()}>
								{memberTierFilter === 'all'
									? m['orgAdmin.members.filters.allTiers']()
									: tiers.find((t) => t.id === memberTierFilter)?.name ||
										m['orgAdmin.members.filters.allTiers']()}
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">{m['orgAdmin.members.filters.allTiers']()}</SelectItem>
								{#each tiers as tier}
									{#if tier.id}
										<SelectItem value={tier.id}>{tier.name}</SelectItem>
									{/if}
								{/each}
							</SelectContent>
						</Select>
					</div>
				</div>
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
						{@const canManage =
							data.isOwner || canPerformAction(data.permissions, organization.id, 'manage_members')}
						<MemberCard {member} {isStaff} {canManage} onManage={handleManageMember} />
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
					class="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950 sm:p-4"
				>
					<p class="text-xs leading-relaxed text-blue-900 dark:text-blue-100 sm:text-sm">
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
					{#if requestStatusFilter === 'pending' && requestsQuery.data?.count}
						<span
							class="ml-1.5 rounded-full bg-primary-foreground px-1.5 py-0.5 text-xs text-primary"
						>
							{requestsQuery.data.count}
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
					{#if requestStatusFilter === 'approved' && requestsQuery.data?.count}
						<span
							class="ml-1.5 rounded-full bg-primary-foreground px-1.5 py-0.5 text-xs text-primary"
						>
							{requestsQuery.data.count}
						</span>
					{/if}
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
					{#if requestStatusFilter === 'rejected' && requestsQuery.data?.count}
						<span
							class="ml-1.5 rounded-full bg-primary-foreground px-1.5 py-0.5 text-xs text-primary"
						>
							{requestsQuery.data.count}
						</span>
					{/if}
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
					{#if requestStatusFilter === 'all' && requestsQuery.data?.count}
						<span
							class="ml-1.5 rounded-full bg-primary-foreground px-1.5 py-0.5 text-xs text-primary"
						>
							{requestsQuery.data.count}
						</span>
					{/if}
				</Button>
			</div>

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
							onApprove={handleApproveRequest}
							onReject={(r) => rejectRequestMutation.mutate(r)}
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
							Previous
						</Button>
						<span class="text-sm text-muted-foreground">
							Page {requestsPagination.page} of {requestsPagination.totalPages}
							({requestsPagination.totalCount} total)
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={!requestsPagination.hasNext}
							onclick={() => (requestsPage = requestsPage + 1)}
						>
							Next
						</Button>
					</div>
				{/if}
			{/if}
		</TabsContent>

		<!-- Tiers Tab -->
		<TabsContent value="tiers" class="space-y-4">
			<!-- Header with Create Button -->
			<div class="flex items-center justify-between">
				<p class="text-sm text-muted-foreground">
					{m['orgAdmin.members.tiers.description']()}
				</p>
				<Button size="sm" onclick={handleCreateTier}>
					<Plus class="mr-2 h-4 w-4" />
					{m['orgAdmin.members.tiers.create']()}
				</Button>
			</div>

			<!-- Tiers List -->
			{#if tiersQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if tiersQuery.isError}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
					<p class="text-sm text-destructive">{m['orgAdmin.members.errors.loadTiers']()}</p>
				</div>
			{:else if tiers.length === 0}
				<div class="rounded-lg border border-dashed p-12 text-center">
					<Shield class="mx-auto h-12 w-12 text-muted-foreground" />
					<h3 class="mt-4 font-semibold">{m['orgAdmin.members.empty.tiers.title']()}</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						{m['orgAdmin.members.empty.tiers.description']()}
					</p>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each tiers as tier (tier.id)}
						{@const memberCount = members.filter((m) => m.tier?.id === tier.id).length}
						<div class="rounded-lg border border-border bg-card p-4 shadow-sm">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0 flex-1">
									<h3 class="truncate font-semibold text-foreground">
										{tier.name}
									</h3>
									{#if tier.description_html}
										<div
											class="prose prose-sm dark:prose-invert mt-2 max-w-none text-muted-foreground"
										>
											{@html tier.description_html}
										</div>
									{:else if tier.description}
										<p class="mt-2 text-sm text-muted-foreground">
											{tier.description}
										</p>
									{/if}
									<p class="mt-2 text-xs text-muted-foreground">
										{m['orgAdmin.members.tiers.memberCount']({
											count: memberCount,
											plural: memberCount === 1 ? '' : m['orgAdmin.members.tiers._plural']()
										})}
									</p>
								</div>
								<div class="flex shrink-0 gap-1">
									<Button
										variant="ghost"
										size="icon"
										class="h-8 w-8"
										onclick={() => handleEditTier(tier)}
										aria-label={m['orgAdmin.members.tiers.editAriaLabel']({ name: tier.name })}
									>
										<Pencil class="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										class="h-8 w-8 text-destructive"
										onclick={() => handleDeleteTierClick(tier)}
										aria-label={m['orgAdmin.members.tiers.deleteAriaLabel']({ name: tier.name })}
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</TabsContent>

		<!-- Tokens Tab -->
		<TabsContent value="tokens" class="space-y-4">
			<!-- Search -->
			<div class="relative">
				<Search
					class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					type="search"
					placeholder="Search invitation links..."
					bind:value={tokenSearch}
					class="pl-10"
				/>
			</div>

			<!-- Tokens List -->
			{#if tokensQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
				</div>
			{:else if tokensQuery.isError}
				<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
					<p class="text-sm text-destructive">Failed to load invitation links</p>
				</div>
			{:else if tokens.length === 0}
				<div class="rounded-lg border border-dashed p-12 text-center">
					<Link class="mx-auto h-12 w-12 text-muted-foreground" />
					<h3 class="mt-4 font-semibold">
						{#if tokenSearch}
							No invitation links found
						{:else}
							No invitation links yet
						{/if}
					</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						{#if tokenSearch}
							Try adjusting your search query
						{:else}
							Create shareable links to invite people to join this organization
						{/if}
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each tokens as token (token.id)}
						<OrganizationTokenCard
							{token}
							organizationSlug={organization.slug}
							onEdit={(t) => (tokenToEdit = t)}
							onDelete={(t) => (tokenToDelete = t)}
							onShare={(t) => (tokenToShare = t)}
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

<!-- Manage Member Modal -->
<ManageMemberModal
	member={memberToManage}
	{tiers}
	isStaff={memberToManage?.user.id ? staffUserIds.has(memberToManage.user.id) : false}
	open={manageMemberModalOpen}
	onClose={handleCloseManageMemberModal}
	onUpdateStatus={handleUpdateMemberStatus}
	onUpdateTier={handleUpdateMemberTier}
	onMakeStaff={handleMakeStaffFromModal}
	onRemove={handleRemoveMemberFromModal}
	isUpdating={updateMemberMutation.isPending}
	isPromoting={promoteToStaffMutation.isPending}
	isRemoving={removeMemberMutation.isPending}
/>

<!-- Approve Membership Modal -->
<ApproveMembershipModal
	request={requestToApprove}
	{tiers}
	open={approveMembershipModalOpen}
	onClose={handleCloseApproveMembershipModal}
	onConfirm={handleConfirmApproveRequest}
	isProcessing={approveRequestMutation.isPending}
/>

<!-- Tier Form Modal -->
<TierFormModal
	tier={tierToEdit}
	open={tierFormOpen}
	onClose={handleCloseTierForm}
	onSave={handleSaveTier}
	isSaving={createTierMutation.isPending || updateTierMutation.isPending}
/>

<!-- Delete Tier Confirmation Dialog -->
{#if tierToDelete}
	<Dialog
		open={deleteConfirmOpen}
		onOpenChange={(open) => {
			if (!open) handleCancelDelete();
		}}
	>
		<DialogContent class="sm:max-w-[425px]">
			<DialogHeader>
				<DialogTitle>{m['tierDelete.title']()}</DialogTitle>
			</DialogHeader>
			<div class="space-y-4 py-4">
				<div class="flex gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
					<div class="shrink-0">
						<svg
							class="h-5 w-5 text-destructive"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
					</div>
					<div class="flex-1 space-y-2">
						<p class="text-sm font-medium text-destructive">
							{m['tierDelete.confirmMessage']({ name: tierToDelete.name })}
						</p>
						<p class="text-sm text-muted-foreground">
							{m['tierDelete.consequence']()}
						</p>
					</div>
				</div>
				<div class="flex justify-end gap-2">
					<Button
						variant="outline"
						onclick={handleCancelDelete}
						disabled={deleteTierMutation.isPending}
					>
						{m['tierDelete.cancel']()}
					</Button>
					<Button
						variant="destructive"
						onclick={handleConfirmDelete}
						disabled={deleteTierMutation.isPending}
					>
						{#if deleteTierMutation.isPending}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{/if}
						{m['tierDelete.confirm']()}
					</Button>
				</div>
			</div>
		</DialogContent>
	</Dialog>
{/if}

<!-- Token Create Modal -->
<OrganizationTokenModal
	open={isCreateTokenModalOpen}
	membershipTiers={tiers}
	isLoading={createTokenMutation.isPending}
	onClose={() => (isCreateTokenModalOpen = false)}
	onSave={handleCreateTokenSave}
/>

<!-- Token Edit Modal -->
<OrganizationTokenModal
	open={!!tokenToEdit}
	token={tokenToEdit}
	membershipTiers={tiers}
	isLoading={updateTokenMutation.isPending}
	onClose={() => (tokenToEdit = null)}
	onSave={handleEditTokenSave}
/>

<!-- Token Delete Confirmation -->
<Dialog open={!!tokenToDelete}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Delete Invitation Link</DialogTitle>
			<DialogDescription>
				Are you sure you want to delete this invitation link? This action cannot be undone.
			</DialogDescription>
		</DialogHeader>

		{#if tokenToDelete}
			<div class="space-y-2 text-sm">
				<p>
					<strong>Link:</strong>
					{tokenToDelete.name || 'Unnamed link'}
				</p>
				<p>
					<strong>Uses:</strong>
					{tokenToDelete.uses ?? 0} time{(tokenToDelete.uses ?? 0) === 1 ? '' : 's'}
				</p>
				<p class="text-muted-foreground">Note: People who already joined will keep their access.</p>
			</div>
		{/if}

		<DialogFooter>
			<Button
				variant="outline"
				onclick={() => (tokenToDelete = null)}
				disabled={deleteTokenMutation.isPending}
			>
				Cancel
			</Button>
			<Button
				variant="destructive"
				onclick={handleDeleteToken}
				disabled={deleteTokenMutation.isPending}
			>
				{#if deleteTokenMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				Delete Link
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<!-- Token Share Dialog -->
{#if tokenToShare}
	<TokenShareDialog
		open={!!tokenToShare}
		{shareUrl}
		tokenName={tokenToShare.name || undefined}
		onClose={() => (tokenToShare = null)}
	/>
{/if}
