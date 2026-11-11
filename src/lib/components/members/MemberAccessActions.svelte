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
	import { planChangeRefusalCode } from '$lib/utils/plan-change';
	import { invalidateAfterMemberWrite } from '$lib/member-register/member-access';
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
		/** Hand over to the member's subscription (only for viewers who manage them). */
		onManageSubscription?: () => void;
	}

	const { slug, accessToken, member, tiers, isStaff, open, onClose, onManageSubscription }: Props =
		$props();

	const queryClient = useQueryClient();

	function refreshAll(): void {
		void invalidateAfterMemberWrite(queryClient, slug);
	}

	/** The 409 `tier_follows_subscription`: the tier belongs to a live subscription. */
	class TierLockedError extends Error {}
	let tierLockDetail = $state<string | null>(null);

	// A 409 lock belongs to one editing session of one person: drop it whenever the
	// dialog is closed (by ANY path, including a successful save) or the member
	// changes. Keyed on the user id, so a refreshed object for the same member keeps it.
	$effect(() => {
		void member?.user.id;
		if (!open) tierLockDetail = null;
	});
	let lockedFor: string | null | undefined;
	$effect(() => {
		const id = member?.user.id;
		if (id !== lockedFor) {
			lockedFor = id;
			tierLockDetail = null;
		}
	});

	/** Every way out of the dialog resets the session lock. */
	function finish(): void {
		tierLockDetail = null;
		onClose();
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
				throw new Error(backendMessage(response.error) || m['membersTab.removeMemberError']());
			}
			return response.data;
		},
		onSuccess: () => {
			refreshAll();
			finish();
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
				if (planChangeRefusalCode(response.error) === 'tier_follows_subscription') {
					throw new TierLockedError(
						backendMessage(response.error) || m['manageMemberModal.tierLockedReason']()
					);
				}
				throw new Error(backendMessage(response.error) || m['membersTab.updateMemberError']());
			}
			return response.data;
		},
		onSuccess: () => {
			refreshAll();
			finish();
		},
		onError: (error: Error) => {
			if (error instanceof TierLockedError) {
				// Not a failure to report: the form locks and says why. Refresh so the
				// member row carries the flag from now on.
				tierLockDetail = error.message;
				refreshAll();
				return;
			}
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
				throw new Error(backendMessage(response.error) || m['membersTab.promoteStaffError']());
			}
			return response.data;
		},
		onSuccess: () => {
			refreshAll();
			void queryClient.invalidateQueries({ queryKey: ['organization', slug, 'staff'] });
			finish();
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
			finish();
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
		if (pending) return;
		finish();
	}
</script>

<ManageMemberModal
	{member}
	{tiers}
	{isStaff}
	{open}
	onClose={handleClose}
	{onManageSubscription}
	{tierLockDetail}
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
