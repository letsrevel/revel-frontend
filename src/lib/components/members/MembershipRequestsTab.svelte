<script lang="ts" module>
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipApprovalRefusalCode } from '$lib/api/generated/types.gen';

	/**
	 * Localized copy per coded refusal. A `Record` over the generated union, so a
	 * code the backend adds fails the type check here instead of silently falling
	 * back. The backend `detail` is only the fallback for uncoded 400s.
	 */
	const REFUSAL_COPY: Record<MembershipApprovalRefusalCode, () => string> = {
		subscription_active: () => m['membershipRequestsTab.refusalSubscriptionActive'](),
		membership_paused: () => m['membershipRequestsTab.refusalMembershipPaused'](),
		link_paid_application: () => m['membershipRequestsTab.refusalLinkPaidApplication'](),
		link_future_dated: () => m['membershipRequestsTab.refusalLinkFutureDated'](),
		link_unavailable: () => m['membershipRequestsTab.refusalLinkUnavailable'](),
		applicant_has_entry: () => m['membershipRequestsTab.refusalApplicantHasEntry']()
	};

	/**
	 * Carries the backend's `forceable` flag past the mutation boundary: TanStack
	 * only hands `onError` the thrown error. Only a 400 body with
	 * `forceable === true` may offer "approve anyway"; every other failure
	 * (uncoded 400, non-forceable coded refusal, 403, ...) is not forceable.
	 */
	class ApproveRequestError extends Error {
		forceable: boolean;

		constructor(message: string, forceable: boolean) {
			super(message);
			this.name = 'ApproveRequestError';
			this.forceable = forceable;
		}
	}

	function isRefusalCode(code: unknown): code is MembershipApprovalRefusalCode {
		return typeof code === 'string' && Object.hasOwn(REFUSAL_COPY, code);
	}

	/** Builds the error for a failed approve from the (typed or unknown) body. */
	function approveErrorFrom(body: unknown, fallback: string, detail: string | null) {
		const refusal =
			typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
		const forceable = refusal.forceable === true;
		// A forceable refusal keeps the backend's own sentence: it names the member
		// and goes into the confirm dialog. Non-forceable ones use localized copy.
		const copy = !forceable && isRefusalCode(refusal.code) ? REFUSAL_COPY[refusal.code]() : null;
		return new ApproveRequestError(copy ?? detail ?? fallback, forceable);
	}
</script>

<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminmembershiprequestsListMembershipRequests,
		organizationadminmembershiprequestsApproveMembershipRequest,
		organizationadminmembershiprequestsRejectMembershipRequest
	} from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationMembershipRequestRetrieve,
		MembershipRecordSchema,
		MembershipTierSchema,
		OrganizationAdminDetailSchema,
		MembershipRequestStatus
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { UserPlus, Loader2 } from '@lucide/svelte';
	import MembershipRequestCard from '$lib/components/members/MembershipRequestCard.svelte';
	import ApproveMembershipModal from '$lib/components/members/ApproveMembershipModal.svelte';
	import { toast } from 'svelte-sonner';
	import { backendMessage } from '$lib/utils/api-error-detail';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { invalidateDuplicates } from '$lib/member-register/api';
	import { standardTiers } from '$lib/utils/membership-tier-kind';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		tiers: MembershipTierSchema[];
	}

	interface ApproveVariables {
		request: OrganizationMembershipRequestRetrieve;
		// `null` when the application already carries its own tier — the backend
		// then resolves the tier itself and `tier_id` is omitted.
		tierId: string | null;
		// Set only by the "approve anyway" retry; the backend treats the body with
		// exclude_unset semantics, so the flag is omitted rather than sent false.
		force?: boolean;
		// Unlinked register entry to adopt ("Approve and link").
		linkRecordId?: string;
		// The caller shows a refusal itself (the card's inline error), so the
		// error toast is skipped. Set only on the first attempt from the card.
		inline?: boolean;
	}

	const { organization, tiers }: Props = $props();

	// Every status the backend can put an application in, plus the "all" escape
	// hatch. Order is the display order of the filter row.
	const REQUEST_FILTERS = [
		{ value: 'pending', label: () => m['membershipRequestsTab.filterPending']() },
		{ value: 'approved', label: () => m['membershipRequestsTab.filterApproved']() },
		{ value: 'completed', label: () => m['membershipRequestsTab.filterCompleted']() },
		{ value: 'rejected', label: () => m['membershipRequestsTab.filterRejected']() },
		{ value: 'cancelled', label: () => m['membershipRequestsTab.filterCancelled']() },
		{ value: 'all', label: () => m['membershipRequestsTab.filterAll']() }
	] as const satisfies ReadonlyArray<{
		value: MembershipRequestStatus | 'all';
		label: () => string;
	}>;

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Filter state
	let requestStatusFilter = $state<MembershipRequestStatus | 'all'>('pending');
	let requestsPage = $state(1);

	// Approve membership request modal state
	let requestToApprove = $state<OrganizationMembershipRequestRetrieve | null>(null);
	let approveMembershipModalOpen = $state(false);
	// Register entry carried along when the tier picker was opened by "Approve and link".
	let linkRecordToApprove = $state<string | null>(null);

	// Set when the backend refuses a free approval with a `forceable` 400 (active
	// subscription or paused membership); holds everything the forced retry needs.
	let forceConfirm = $state<{
		request: OrganizationMembershipRequestRetrieve;
		tierId: string | null;
		linkRecordId?: string;
		detail: string;
	} | null>(null);

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
			const response = await organizationadminmembershiprequestsListMembershipRequests({
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

	// Approve request mutation
	const approveRequestMutation = createMutation(() => ({
		mutationFn: async ({ request, tierId, force, linkRecordId }: ApproveVariables) => {
			if (!request.id) {
				throw new ApproveRequestError(m['membershipRequestsTab.approveFailedGeneric'](), false);
			}

			const response = await organizationadminmembershiprequestsApproveMembershipRequest({
				path: { slug: organization.slug, request_id: request.id },
				body: {
					...(tierId ? { tier_id: tierId } : {}),
					...(force ? { force: true } : {}),
					...(linkRecordId ? { link_record_id: linkRecordId } : {})
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw approveErrorFrom(
					response.error,
					m['membershipRequestsTab.approveFailedGeneric'](),
					backendMessage(response.error)
				);
			}

			return response.data;
		},
		onSuccess: (_data, variables: ApproveVariables) => {
			approveMembershipModalOpen = false;
			requestToApprove = null;
			linkRecordToApprove = null;
			forceConfirm = null;

			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'membership-requests']
			});
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'members']
			});
			// Linking changes the register, and every cached match list is now stale.
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'member-register']
			});
			if (variables.linkRecordId) void invalidateDuplicates(queryClient, organization.slug);
		},
		onError: (error: Error, variables: ApproveVariables) => {
			// Offer the override only when the backend says it can bypass the refusal
			// (`forceable`: active subscription, paused membership). Uncoded 400s and
			// the non-forceable coded ones (link_*, applicant_has_entry) fail again on
			// a forced retry, so they go to the inline error / toast below instead.
			// Localized text is never matched. A refused forced retry also falls through.
			if (!variables.force && error instanceof ApproveRequestError && error.forceable) {
				// Close the tier picker first: the confirm dialog carries the tier
				// itself, and stacking the two dialogs would trap focus in the wrong one.
				approveMembershipModalOpen = false;
				requestToApprove = null;
				linkRecordToApprove = null;
				forceConfirm = {
					request: variables.request,
					tierId: variables.tierId,
					linkRecordId: variables.linkRecordId,
					detail: error.message
				};
				return;
			}

			// The forced retry failed, so the card the admin acted on is provably out
			// of date (the 400 is a state guard `force` cannot bypass). Refetch the
			// list, otherwise the stale card keeps offering approve → 400 → force →
			// 400 forever with the UI never converging.
			if (variables.force) {
				queryClient.invalidateQueries({
					queryKey: ['organization', organization.slug, 'membership-requests']
				});
			}

			// The register changed under the admin (entry linked/ended meanwhile): refresh the hints.
			if (variables.linkRecordId) {
				queryClient.invalidateQueries({
					queryKey: ['organization', organization.slug, 'member-register']
				});
			}

			forceConfirm = null;
			// The card shows an inline refusal itself; the toast would duplicate it.
			if (!variables.inline) toast.error(error.message);
		}
	}));

	// Reject request mutation
	const rejectRequestMutation = createMutation(() => ({
		mutationFn: async (request: OrganizationMembershipRequestRetrieve) => {
			if (!request.id) {
				throw new Error(m['membershipRequestsTab.rejectFailedGeneric']());
			}

			const response = await organizationadminmembershiprequestsRejectMembershipRequest({
				path: { slug: organization.slug, request_id: request.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error(
					backendMessage(response.error) || m['membershipRequestsTab.rejectFailedGeneric']()
				);
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'membership-requests']
			});
		},
		onError: (error: Error) => {
			toast.error(error.message);
		}
	}));

	// Derived data
	const requests = $derived(requestsQuery.data?.results || []);
	const requestsPagination = $derived({
		page: requestsPage,
		pageSize: 50,
		totalCount: requestsQuery.data?.count || 0,
		totalPages: Math.ceil((requestsQuery.data?.count || 0) / 50),
		hasNext: requestsQuery.data?.next !== null,
		hasPrev: requestsQuery.data?.previous !== null
	});

	// Handlers
	function handleApproveRequest(request: OrganizationMembershipRequestRetrieve) {
		// New-flow applications carry the tier they applied for — approve straight
		// through and let the backend use it, whatever the org's tier count is.
		if (request.tier) {
			approveRequestMutation.mutate({ request, tierId: null });
			return;
		}

		if (tiers.length === 0) {
			toast.error(m['membershipRequestsTab.noTiersAvailable']());
			return;
		}

		if (tiers.length === 1 && tiers[0].id) {
			approveRequestMutation.mutate({ request, tierId: tiers[0].id });
		} else {
			requestToApprove = request;
			approveMembershipModalOpen = true;
		}
	}

	/**
	 * "Approve and link". Resolves when the card may close its dialog: the
	 * approval went through, or control moved to another dialog (tier picker,
	 * force confirm). Rejects with the refusal, which the card shows inline.
	 *
	 * Tier, in order: the application's own, the register entry's tier (the
	 * backend's intended default), the org's single standard tier; otherwise the
	 * same picker plain approve uses.
	 */
	async function handleApproveAndLink(
		request: OrganizationMembershipRequestRetrieve,
		record: MembershipRecordSchema
	): Promise<void> {
		const linkRecordId = record.id;
		if (!linkRecordId) return;

		let tierId: string | null = null;
		if (!request.tier) {
			const standard = standardTiers(tiers);
			if (record.tier_id) {
				tierId = record.tier_id;
			} else if (standard.length === 1 && standard[0].id) {
				tierId = standard[0].id;
			} else if (standard.length === 0) {
				throw new Error(m['membershipRequestsTab.noTiersAvailable']());
			} else {
				requestToApprove = request;
				linkRecordToApprove = linkRecordId;
				approveMembershipModalOpen = true;
				return;
			}
		}

		try {
			await approveRequestMutation.mutateAsync({ request, tierId, linkRecordId, inline: true });
		} catch (error) {
			// The force-able refusal moved to the confirm dialog; nothing to show inline.
			if (forceConfirm !== null) return;
			throw error;
		}
	}

	function handleCloseApproveMembershipModal() {
		if (!approveRequestMutation.isPending) {
			approveMembershipModalOpen = false;
			requestToApprove = null;
			linkRecordToApprove = null;
		}
	}

	function handleConfirmApproveRequest(tierId: string) {
		if (requestToApprove) {
			approveRequestMutation.mutate({
				request: requestToApprove,
				tierId,
				...(linkRecordToApprove ? { linkRecordId: linkRecordToApprove } : {})
			});
		}
	}

	// Both operands are read unconditionally — short-circuiting over the query's
	// tracked `isPending` would leave it untracked once the dialog is closed.
	const isForcing = $derived.by(() => {
		const pending = approveRequestMutation.isPending;
		const open = forceConfirm !== null;
		return pending && open;
	});

	function handleForceConfirmOpenChange(next: boolean) {
		// The forced approval is in flight; closing now would hide its outcome.
		if (!next && !isForcing) {
			forceConfirm = null;
		}
	}

	function handleForceApprove() {
		if (forceConfirm) {
			approveRequestMutation.mutate({
				request: forceConfirm.request,
				tierId: forceConfirm.tierId,
				...(forceConfirm.linkRecordId ? { linkRecordId: forceConfirm.linkRecordId } : {}),
				force: true
			});
		}
	}
</script>

<!-- Filter Buttons -->
<div class="flex flex-wrap items-center gap-2">
	{#each REQUEST_FILTERS as filter (filter.value)}
		<Button
			variant={requestStatusFilter === filter.value ? 'default' : 'outline'}
			size="sm"
			aria-pressed={requestStatusFilter === filter.value}
			onclick={() => {
				requestStatusFilter = filter.value;
				requestsPage = 1;
			}}
		>
			{filter.label()}
			{#if requestStatusFilter === filter.value && requestsQuery.data?.count}
				<span class="ml-1.5 rounded-full bg-primary-foreground px-1.5 py-0.5 text-xs text-primary">
					{requestsQuery.data.count}
				</span>
			{/if}
		</Button>
	{/each}
</div>

{#if requestsQuery.isLoading}
	<!-- House spinner idiom (cf. SeriesPassesTab): the icon is decoration, the
	     `sr-only` text is the whole announcement. A bare spinning glyph says
	     nothing at all to a screen reader — WCAG 4.1.3. -->
	<div class="flex items-center justify-center py-12" role="status">
		<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
		<span class="sr-only">{m['common.loading']()}</span>
	</div>
{:else if requestsQuery.isError}
	<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
		<!-- `role="alert"`: the failure arrives *after* first paint, replacing the
		     spinner, so without a live region it lands silently for anyone who has
		     already moved focus on. -->
		<p role="alert" class="text-sm text-destructive">
			{m['orgAdmin.members.errors.loadRequests']()}
		</p>
	</div>
{:else if requests.length === 0}
	<EmptyState
		icon={UserPlus}
		title={m['orgAdmin.members.empty.requests.title']()}
		body={m['orgAdmin.members.empty.requests.description']()}
	/>
{:else}
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		{#each requests as request (request.id)}
			<MembershipRequestCard
				{request}
				orgSlug={organization.slug}
				onApprove={handleApproveRequest}
				onApproveAndLink={handleApproveAndLink}
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
				{m['membershipRequestsTab.previous']()}
			</Button>
			<span class="text-sm text-muted-foreground">
				{m['membershipRequestsTab.pageInfo']({
					page: requestsPagination.page,
					totalPages: requestsPagination.totalPages,
					total: requestsPagination.totalCount
				})}
			</span>
			<Button
				variant="outline"
				size="sm"
				disabled={!requestsPagination.hasNext}
				onclick={() => (requestsPage = requestsPage + 1)}
			>
				{m['membershipRequestsTab.next']()}
			</Button>
		</div>
	{/if}
{/if}

<!-- Approve Membership Modal -->
<ApproveMembershipModal
	request={requestToApprove}
	{tiers}
	open={approveMembershipModalOpen}
	onClose={handleCloseApproveMembershipModal}
	onConfirm={handleConfirmApproveRequest}
	isProcessing={approveRequestMutation.isPending}
/>

<!-- Force-approve confirmation (backend refused a free grant over a paid state) -->
<Dialog open={forceConfirm !== null} onOpenChange={handleForceConfirmOpenChange}>
	<DialogContent
		class="max-h-[90vh] overflow-y-auto sm:max-w-md"
		escapeKeydownBehavior={isForcing ? 'ignore' : 'close'}
		interactOutsideBehavior={isForcing ? 'ignore' : 'close'}
		showCloseButton={!isForcing}
	>
		<DialogHeader>
			<DialogTitle>{m['membershipRequestsTab.forceApproveTitle']()}</DialogTitle>
			<!-- The backend's own refusal first, then the cause-neutral consequence;
			     both live in the description so they join `aria-describedby`. -->
			<DialogDescription>
				{forceConfirm?.detail}
				<span class="mt-2 block">{m['membershipRequestsTab.forceApproveExplainer']()}</span>
			</DialogDescription>
		</DialogHeader>

		<DialogFooter class="gap-2">
			<Button
				variant="outline"
				onclick={() => handleForceConfirmOpenChange(false)}
				disabled={isForcing}
			>
				{m['membershipRequestsTab.forceApproveCancel']()}
			</Button>
			<Button variant="destructive" onclick={handleForceApprove} disabled={isForcing}>
				{#if isForcing}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				{m['membershipRequestsTab.forceApproveConfirm']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
