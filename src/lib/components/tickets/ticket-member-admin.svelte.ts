import * as m from '$lib/paraglide/messages.js';
import { createMutation } from '@tanstack/svelte-query';
import { invalidateAll } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { getUserDisplayName } from '$lib/utils/user-display';
import {
	organizationadminmembersListMembershipTiers,
	organizationadminmembersAddMember,
	organizationadminblacklistCreateBlacklistEntry
} from '$lib/api';
import type { AdminTicketSchema, MembershipTierSchema } from '$lib/api/generated/types.gen';

interface MakeMemberUser {
	id: string;
	displayName: string;
	email?: string;
}

interface Options {
	/** Organization slug for the membership/blacklist endpoints. */
	getSlug: () => string;
	/** Bearer access token, or nullish when unauthenticated. */
	getAccessToken: () => string | null | undefined;
}

/**
 * Membership + blacklist admin actions for the event tickets list.
 *
 * Bundles the two mutations, their dialog state, and the trigger handlers into
 * one cohesive unit. Instantiate once at component init (it uses runes) and
 * read/write via the returned accessors. The MakeMemberModal and blacklist
 * ConfirmDialog stay in the page template, bound to this state.
 */
export function createTicketMemberAdmin(opts: Options) {
	// Make member modal state
	let showMakeMemberModal = $state(false);
	let userToMakeMember = $state<MakeMemberUser | null>(null);
	let membershipTiers = $state<MembershipTierSchema[]>([]);
	let tiersLoading = $state(false);

	// Blacklist confirmation state
	let showBlacklistDialog = $state(false);
	let ticketToBlacklist = $state<AdminTicketSchema | null>(null);

	const addMemberMutation = createMutation(() => ({
		mutationFn: async ({ userId, tierId }: { userId: string; tierId: string }) => {
			const response = await organizationadminmembersAddMember({
				path: { slug: opts.getSlug(), user_id: userId },
				body: { tier_id: tierId },
				headers: { Authorization: `Bearer ${opts.getAccessToken()}` }
			});

			if (response.error) {
				const errorDetail =
					typeof response.error === 'object' &&
					response.error !== null &&
					'detail' in response.error
						? String(response.error.detail)
						: m['makeMemberAction.error']();
				throw new Error(errorDetail);
			}

			return response.data;
		},
		onSuccess: () => {
			const userName = userToMakeMember?.displayName || '';
			showMakeMemberModal = false;
			userToMakeMember = null;
			toast.success(m['makeMemberAction.success']({ name: userName }));
			invalidateAll();
		},
		onError: (error: Error) => {
			toast.error(error.message);
		}
	}));

	const blacklistMutation = createMutation(() => ({
		mutationFn: async (userId: string) => {
			const response = await organizationadminblacklistCreateBlacklistEntry({
				path: { slug: opts.getSlug() },
				body: { user_id: userId, reason: '' },
				headers: { Authorization: `Bearer ${opts.getAccessToken()}` }
			});

			if (response.error) {
				throw new Error(m['eventTicketsAdmin.blacklistError']());
			}

			return response.data;
		},
		onSuccess: () => {
			const userName = ticketToBlacklist ? getUserDisplayName(ticketToBlacklist.user) : '';
			showBlacklistDialog = false;
			ticketToBlacklist = null;
			toast.success(m['eventTicketsAdmin.blacklistSuccess']({ name: userName }));
			invalidateAll();
		},
		onError: () => {
			toast.error(m['eventTicketsAdmin.blacklistError']());
		}
	}));

	/**
	 * Open make member modal
	 */
	async function openMakeMemberModal(ticket: AdminTicketSchema) {
		const user = ticket.user;
		if (!user?.id) {
			toast.error(m['eventTicketsAdmin.userIdNotAvailable']());
			return;
		}

		// Check if already a member
		if (ticket.membership) {
			toast.info(m['makeMemberAction.alreadyMember']());
			return;
		}

		// Set user info
		userToMakeMember = {
			id: user.id,
			displayName: getUserDisplayName(user),
			email: user.email ?? undefined
		};

		// Load membership tiers if not already loaded
		if (membershipTiers.length === 0) {
			tiersLoading = true;
			try {
				const response = await organizationadminmembersListMembershipTiers({
					path: { slug: opts.getSlug() },
					headers: { Authorization: `Bearer ${opts.getAccessToken()}` }
				});
				if (response.error) {
					throw new Error(m['makeMemberAction.tiersLoadError']());
				}
				if (response.data) {
					membershipTiers = response.data;
				}
			} catch (err) {
				console.error('Failed to load membership tiers:', err);
				toast.error(m['makeMemberAction.tiersLoadError']());
			} finally {
				tiersLoading = false;
			}
		}

		showMakeMemberModal = true;
	}

	/**
	 * Handle make member confirm
	 */
	function handleMakeMemberConfirm(userId: string, tierId: string) {
		addMemberMutation.mutate({ userId, tierId });
	}

	/**
	 * Open blacklist dialog
	 */
	function openBlacklistDialog(ticket: AdminTicketSchema) {
		if (!ticket.user?.id) {
			toast.error(m['eventTicketsAdmin.userIdNotAvailable']());
			return;
		}
		ticketToBlacklist = ticket;
		showBlacklistDialog = true;
	}

	/**
	 * Confirm blacklist
	 */
	function confirmBlacklist() {
		if (ticketToBlacklist?.user?.id) {
			blacklistMutation.mutate(ticketToBlacklist.user.id);
		}
	}

	/**
	 * Cancel blacklist
	 */
	function cancelBlacklist() {
		showBlacklistDialog = false;
		ticketToBlacklist = null;
	}

	return {
		get showMakeMemberModal() {
			return showMakeMemberModal;
		},
		set showMakeMemberModal(value: boolean) {
			showMakeMemberModal = value;
		},
		get userToMakeMember() {
			return userToMakeMember;
		},
		set userToMakeMember(value: MakeMemberUser | null) {
			userToMakeMember = value;
		},
		get membershipTiers() {
			return membershipTiers;
		},
		get tiersLoading() {
			return tiersLoading;
		},
		get addMemberPending() {
			return addMemberMutation.isPending;
		},
		get showBlacklistDialog() {
			return showBlacklistDialog;
		},
		get ticketToBlacklist() {
			return ticketToBlacklist;
		},
		openMakeMemberModal,
		handleMakeMemberConfirm,
		openBlacklistDialog,
		confirmBlacklist,
		cancelBlacklist
	};
}
