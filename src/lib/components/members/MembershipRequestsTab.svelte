<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminmembershiprequestsListMembershipRequests,
		organizationadminmembershiprequestsApproveMembershipRequest,
		organizationadminmembershiprequestsRejectMembershipRequest
	} from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationMembershipRequestRetrieve,
		MembershipTierSchema,
		OrganizationAdminDetailSchema,
		MembershipRequestStatus
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { UserPlus, Loader2 } from '@lucide/svelte';
	import MembershipRequestCard from '$lib/components/members/MembershipRequestCard.svelte';
	import ApproveMembershipModal from '$lib/components/members/ApproveMembershipModal.svelte';
	import { toast } from 'svelte-sonner';
	import { backendMessage } from '$lib/utils/api-error-detail';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		tiers: MembershipTierSchema[];
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
		mutationFn: async ({
			request,
			tierId
		}: {
			request: OrganizationMembershipRequestRetrieve;
			// `null` when the application already carries its own tier — the
			// backend then resolves the tier itself and `tier_id` is omitted.
			tierId: string | null;
		}) => {
			if (!request.id) {
				throw new Error(m['membershipRequestsTab.approveFailedGeneric']());
			}

			const response = await organizationadminmembershiprequestsApproveMembershipRequest({
				path: { slug: organization.slug, request_id: request.id },
				body: tierId ? { tier_id: tierId } : {},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error(
					backendMessage(response.error) || m['membershipRequestsTab.approveFailedGeneric']()
				);
			}

			return response.data;
		},
		onSuccess: () => {
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
			toast.error(error.message);
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
				orgSlug={organization.slug}
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
