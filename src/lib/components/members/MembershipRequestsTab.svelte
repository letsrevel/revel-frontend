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
		Status
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { UserPlus, Loader2 } from 'lucide-svelte';
	import MembershipRequestCard from '$lib/components/members/MembershipRequestCard.svelte';
	import ApproveMembershipModal from '$lib/components/members/ApproveMembershipModal.svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		tiers: MembershipTierSchema[];
	}

	let { organization, tiers }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Filter state
	let requestStatusFilter = $state<Status | 'all'>('pending');
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
			tierId: string;
		}) => {
			if (!request.id) {
				throw new Error('Request ID not found');
			}

			const response = await organizationadminmembershiprequestsApproveMembershipRequest({
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

			const response = await organizationadminmembershiprequestsRejectMembershipRequest({
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

	// Derived data
	let requests = $derived(requestsQuery.data?.results || []);
	let requestsPagination = $derived({
		page: requestsPage,
		pageSize: 50,
		totalCount: requestsQuery.data?.count || 0,
		totalPages: Math.ceil((requestsQuery.data?.count || 0) / 50),
		hasNext: requestsQuery.data?.next !== null,
		hasPrev: requestsQuery.data?.previous !== null
	});

	// Handlers
	function handleApproveRequest(request: OrganizationMembershipRequestRetrieve) {
		if (tiers.length === 0) {
			toast.error('Cannot approve request: No membership tiers available');
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
			<span class="ml-1.5 rounded-full bg-primary-foreground px-1.5 py-0.5 text-xs text-primary">
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
			<span class="ml-1.5 rounded-full bg-primary-foreground px-1.5 py-0.5 text-xs text-primary">
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
			<span class="ml-1.5 rounded-full bg-primary-foreground px-1.5 py-0.5 text-xs text-primary">
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
			<span class="ml-1.5 rounded-full bg-primary-foreground px-1.5 py-0.5 text-xs text-primary">
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

<!-- Approve Membership Modal -->
<ApproveMembershipModal
	request={requestToApprove}
	{tiers}
	open={approveMembershipModalOpen}
	onClose={handleCloseApproveMembershipModal}
	onConfirm={handleConfirmApproveRequest}
	isProcessing={approveRequestMutation.isPending}
/>
