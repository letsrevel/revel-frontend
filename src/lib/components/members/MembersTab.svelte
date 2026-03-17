<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminmembersListMembers,
		organizationadminmembersRemoveMember,
		organizationadminmembersUpdateMember,
		organizationadminmembersAddStaff,
		organizationadminblacklistCreateBlacklistEntry
	} from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationMemberSchema,
		MembershipStatus,
		MembershipTierSchema,
		OrganizationAdminDetailSchema
	} from '$lib/api/generated/types.gen';
	import type { OrganizationPermissionsSchema } from '$lib/types/auth';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Search, Users, Loader2 } from 'lucide-svelte';
	import MemberCard from '$lib/components/members/MemberCard.svelte';
	import ManageMemberModal from '$lib/components/members/ManageMemberModal.svelte';
	import PromoteToStaffDialog from '$lib/components/members/PromoteToStaffDialog.svelte';
	import { canPerformAction } from '$lib/utils/permissions';
	import { toast } from 'svelte-sonner';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		isOwner: boolean;
		permissions: OrganizationPermissionsSchema | null;
		tiers: MembershipTierSchema[];
		staffUserIds: Set<string>;
	}

	const { organization, isOwner, permissions, tiers, staffUserIds }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Search and filter state
	let memberSearch = $state('');
	let memberStatusFilter = $state<MembershipStatus | 'all'>('all');
	let memberTierFilter = $state<string | 'all'>('all');

	// Manage member modal state
	let memberToManage = $state<OrganizationMemberSchema | null>(null);
	let manageMemberModalOpen = $state(false);

	// Promote to staff dialog state
	let memberToPromote = $state<OrganizationMemberSchema | null>(null);
	let promoteDialogOpen = $state(false);

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
			const response = await organizationadminmembersListMembers({
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

	// Remove member mutation
	const removeMemberMutation = createMutation(() => ({
		mutationFn: async (member: OrganizationMemberSchema) => {
			const userId = member.user.id;
			if (!userId) {
				throw new Error('User ID not found in member data');
			}

			const response = await organizationadminmembersRemoveMember({
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

	// Update member mutation
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

			const response = await organizationadminmembersUpdateMember({
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

	// Promote member to staff mutation
	const promoteToStaffMutation = createMutation(() => ({
		mutationFn: async (member: OrganizationMemberSchema) => {
			const userId = member.user.id;
			if (!userId) {
				throw new Error('User ID not found in member data');
			}

			const response = await organizationadminmembersAddStaff({
				path: { slug: organization.slug, user_id: userId },
				body: null,
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to promote member to staff');
			}

			return response.data;
		},
		onSuccess: () => {
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

	// Blacklist member mutation
	const blacklistMemberMutation = createMutation(() => ({
		mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
			const response = await organizationadminblacklistCreateBlacklistEntry({
				path: { slug: organization.slug },
				body: { user_id: userId, reason: reason || '' },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to blacklist member');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'members']
			});
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'blacklist']
			});
			manageMemberModalOpen = false;
			memberToManage = null;
			toast.success('Member has been blacklisted');
		},
		onError: () => {
			toast.error('Failed to blacklist member');
		}
	}));

	// Derived data
	const members = $derived(membersQuery.data?.results || []);

	// Handlers
	function handleManageMember(member: OrganizationMemberSchema) {
		memberToManage = member;
		manageMemberModalOpen = true;
	}

	function handleCloseManageMemberModal() {
		if (
			!updateMemberMutation.isPending &&
			!promoteToStaffMutation.isPending &&
			!removeMemberMutation.isPending &&
			!blacklistMemberMutation.isPending
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

	function handleBlacklistMemberFromModal(reason: string) {
		if (memberToManage?.user.id) {
			blacklistMemberMutation.mutate({ userId: memberToManage.user.id, reason });
		}
	}

	function handleClosePromoteDialog() {
		if (!promoteToStaffMutation.isPending) {
			promoteDialogOpen = false;
			memberToPromote = null;
		}
	}

	function handleConfirmPromotion() {
		if (memberToPromote) {
			promoteToStaffMutation.mutate(memberToPromote);
		}
	}
</script>

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
				isOwner || canPerformAction(permissions, organization.id, 'manage_members')}
			<MemberCard {member} {isStaff} {canManage} onManage={handleManageMember} />
		{/each}
	</div>
{/if}

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
	onBlacklist={handleBlacklistMemberFromModal}
	isUpdating={updateMemberMutation.isPending}
	isPromoting={promoteToStaffMutation.isPending}
	isRemoving={removeMemberMutation.isPending}
	isBlacklisting={blacklistMemberMutation.isPending}
/>
