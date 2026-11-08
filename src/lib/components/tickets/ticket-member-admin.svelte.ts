import { listStandardTiers } from '$lib/queries/membership-tiers';
import * as m from '$lib/paraglide/messages.js';
import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { invalidateAll } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { getUserDisplayName } from '$lib/utils/user-display';
import {
	organizationadminmembersAddMember,
	organizationadminblacklistCreateBlacklistEntry
} from '$lib/api';
import type { AdminTicketSchema, MembershipTierSchema } from '$lib/api/generated/types.gen';
import { extractApiErrorDetail } from '$lib/utils/api-error-detail';

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
 * Lazy loader for the standard tiers offered by the "make member" modal.
 * Shared by every page that opens that modal so there is ONE implementation:
 * it loads once on demand (tracked by a `loaded` flag, NOT `tiers.length`, so
 * an org with only temporary tiers is not refetched on every click) and toasts
 * on failure, leaving `loaded` false so the next open retries.
 */
export function createStandardTiersLoader(opts: Options) {
	let tiers = $state<MembershipTierSchema[]>([]);
	let loading = $state(false);
	let loaded = false;

	async function ensureLoaded(): Promise<void> {
		if (loaded || loading) return;
		loading = true;
		try {
			tiers = await listStandardTiers(opts.getSlug(), opts.getAccessToken());
			loaded = true;
		} catch (err) {
			console.error('Failed to load membership tiers:', err);
			toast.error(m['makeMemberAction.tiersLoadError']());
		} finally {
			loading = false;
		}
	}

	return {
		get tiers() {
			return tiers;
		},
		get loading() {
			return loading;
		},
		ensureLoaded
	};
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
	// Reads the QueryClient from context — this factory runs at component init.
	const queryClient = useQueryClient();

	// Make member modal state
	let showMakeMemberModal = $state(false);
	let userToMakeMember = $state<MakeMemberUser | null>(null);
	const tiersLoader = createStandardTiersLoader(opts);

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
				const errorDetail = extractApiErrorDetail(response.error) ?? m['makeMemberAction.error']();
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
			// Blacklisting revokes org membership, which cancels the user's subscription
			// and stops Stripe billing server-side. `invalidateAll()` only reruns load
			// functions, so the org admin's cached subscription list + revenue metrics
			// would otherwise still show them as an active payer.
			queryClient.invalidateQueries({
				queryKey: ['organization', opts.getSlug(), 'subscriptions']
			});
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

		await tiersLoader.ensureLoaded();

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
			return tiersLoader.tiers;
		},
		get tiersLoading() {
			return tiersLoader.loading;
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
