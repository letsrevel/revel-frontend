<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import {
		organizationadminmembersRemoveMember,
		organizationadminmembersUpdateMember,
		organizationadminmembersAddStaff,
		organizationadminblacklistCreateBlacklistEntry
	} from '$lib/api/generated/sdk.gen';
	import type {
		MembershipStatus,
		MembershipTierSchema,
		OrganizationMemberSchema
	} from '$lib/api/generated/types.gen';
	import { backendMessage } from '$lib/utils/api-error-detail';
	import { memberRegisterKeys } from '$lib/member-register/api';
	import ManageMemberModal from './ManageMemberModal.svelte';

	/**
	 * The member actions of one linked, current member: change tier, pause /
	 * resume (status), make staff, remove and ban (blacklist). Owns the mutations
	 * and the shared `ManageMemberModal`; keyed on the member's USER id.
	 *
	 * Every action changes what the register shows (the entry ends, the member
	 * status flips), so each success also refreshes the register queries.
	 */
	interface Props {
		slug: string;
		accessToken: string | null | undefined;
		member: OrganizationMemberSchema | null;
		tiers: MembershipTierSchema[];
		isStaff: boolean;
		open: boolean;
		onClose: () => void;
	}

	const { slug, accessToken, member, tiers, isStaff, open, onClose }: Props = $props();

	const queryClient = useQueryClient();

	function refreshAll(): void {
		void queryClient.invalidateQueries({ queryKey: ['organization', slug, 'members'] });
		void queryClient.invalidateQueries({ queryKey: memberRegisterKeys.all(slug) });
		// Losing membership, a ban or a tier move acts on the member's subscription
		// (billing is stopped / moved server-side), so the Subscriptions tab and its
		// metrics (nested under this prefix) are stale the moment this resolves.
		void queryClient.invalidateQueries({ queryKey: ['organization', slug, 'subscriptions'] });
	}

	function userIdOf(target: OrganizationMemberSchema): string {
		const id = target.user.id;
		if (!id) throw new Error('User ID not found in member data');
		return id;
	}

	const removeMutation = createMutation(() => ({
		mutationFn: async (target: OrganizationMemberSchema) => {
			const response = await organizationadminmembersRemoveMember({
				path: { slug, user_id: userIdOf(target) },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				throw new Error(backendMessage(response.error) || 'Failed to remove member');
			}
			return response.data;
		},
		onSuccess: () => {
			refreshAll();
			onClose();
		},
		onError: (error: Error) => {
			toast.error(m['membersTab.removeMemberFailed']({ error: error.message }));
		}
	}));

	const updateMutation = createMutation(() => ({
		mutationFn: async ({
			target,
			status,
			tierId
		}: {
			target: OrganizationMemberSchema;
			status?: MembershipStatus;
			tierId?: string | null;
		}) => {
			const response = await organizationadminmembersUpdateMember({
				path: { slug, user_id: userIdOf(target) },
				body: { status, tier_id: tierId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				throw new Error(backendMessage(response.error) || 'Failed to update member');
			}
			return response.data;
		},
		onSuccess: () => {
			refreshAll();
			onClose();
		},
		onError: (error: Error) => {
			toast.error(m['membersTab.updateMemberFailed']({ error: error.message }));
		}
	}));

	const promoteMutation = createMutation(() => ({
		mutationFn: async (target: OrganizationMemberSchema) => {
			const response = await organizationadminmembersAddStaff({
				path: { slug, user_id: userIdOf(target) },
				body: null,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				throw new Error(backendMessage(response.error) || 'Failed to promote member to staff');
			}
			return response.data;
		},
		onSuccess: () => {
			refreshAll();
			void queryClient.invalidateQueries({ queryKey: ['organization', slug, 'staff'] });
			onClose();
		},
		onError: (error: Error) => {
			toast.error(m['membersTab.promoteStaffFailed']({ error: error.message }));
		}
	}));

	const blacklistMutation = createMutation(() => ({
		mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
			const response = await organizationadminblacklistCreateBlacklistEntry({
				path: { slug },
				body: { user_id: userId, reason: reason || '' },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error('Failed to blacklist member');
			return response.data;
		},
		onSuccess: () => {
			refreshAll();
			void queryClient.invalidateQueries({ queryKey: ['organization', slug, 'blacklist'] });
			toast.success(m['membersTab.memberBlacklisted']());
			onClose();
		},
		onError: () => {
			toast.error(m['membersTab.blacklistFailed']());
		}
	}));

	const pending = $derived(
		updateMutation.isPending ||
			promoteMutation.isPending ||
			removeMutation.isPending ||
			blacklistMutation.isPending
	);

	function handleClose(): void {
		if (!pending) onClose();
	}
</script>

<ManageMemberModal
	{member}
	{tiers}
	{isStaff}
	{open}
	onClose={handleClose}
	onUpdateStatus={(status) => member && updateMutation.mutate({ target: member, status })}
	onUpdateTier={(tierId) => member && updateMutation.mutate({ target: member, tierId })}
	onMakeStaff={() => member && promoteMutation.mutate(member)}
	onRemove={() => member && removeMutation.mutate(member)}
	onBlacklist={(reason) => {
		if (member?.user.id) blacklistMutation.mutate({ userId: member.user.id, reason });
	}}
	isUpdating={updateMutation.isPending}
	isPromoting={promoteMutation.isPending}
	isRemoving={removeMutation.isPending}
	isBlacklisting={blacklistMutation.isPending}
/>
