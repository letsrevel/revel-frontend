<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { OrganizationMembershipRequestRetrieve } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';

	// Note: The API's Status type is for announcements ('draft' | 'sent'), but membership requests use different values
	type RequestStatus = 'pending' | 'approved' | 'rejected';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { CheckCircle, XCircle, MessageSquare } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';

	interface Props {
		request: OrganizationMembershipRequestRetrieve;
		onApprove?: (request: OrganizationMembershipRequestRetrieve) => void;
		onReject?: (request: OrganizationMembershipRequestRetrieve) => void;
		isProcessing?: boolean;
		showActions?: boolean;
	}

	let { request, onApprove, onReject, isProcessing = false, showActions = true }: Props = $props();

	// Dialog state
	let dialogOpen = $state(false);

	// Format created at date
	let createdAt = $derived(formatDistanceToNow(new Date(request.created_at), { addSuffix: true }));

	// Display name
	let displayName = $derived(
		request.user.preferred_name ||
			(request.user.first_name && request.user.last_name
				? `${request.user.first_name} ${request.user.last_name}`
				: request.user.first_name || request.user.email || 'Unknown User')
	);

	function handleApprove() {
		if (onApprove) {
			onApprove(request);
			dialogOpen = false;
		}
	}

	function handleReject() {
		if (onReject) {
			onReject(request);
			dialogOpen = false;
		}
	}

	function openDialog() {
		dialogOpen = true;
	}
</script>

<div
	class="rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
>
	<div class="space-y-3">
		<!-- Request Info -->
		<div class="flex gap-3">
			<!-- Avatar -->
			<UserAvatar
				profilePictureUrl={(request.user as any).profile_picture_url}
				thumbnailUrl={(request.user as any).profile_picture_thumbnail_url}
				{displayName}
				firstName={request.user.first_name}
				lastName={request.user.last_name}
				size="lg"
				class="shrink-0"
			/>

			<div class="min-w-0 flex-1">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0 flex-1">
						<h3 class="truncate font-semibold text-foreground">
							{displayName}
						</h3>
						{#if request.user.pronouns}
							<p class="text-sm text-muted-foreground">({request.user.pronouns})</p>
						{/if}
					</div>
				</div>

				<!-- Name Details -->
				<div class="mt-2 space-y-1 text-sm text-muted-foreground">
					{#if request.user.first_name || request.user.last_name}
						<p class="truncate">
							{#if request.user.first_name}
								<span class="font-medium">{m['membershipRequestCard.first']()}</span>
								{request.user.first_name}
							{/if}
							{#if request.user.first_name && request.user.last_name}
								<span class="mx-2">•</span>
							{/if}
							{#if request.user.last_name}
								<span class="font-medium">{m['membershipRequestCard.last']()}</span>
								{request.user.last_name}
							{/if}
						</p>
					{/if}
					{#if request.user.preferred_name}
						<p class="truncate">
							<span class="font-medium">{m['membershipRequestCard.preferred']()}</span>
							{request.user.preferred_name}
						</p>
					{/if}
				</div>

				{#if request.user.email}
					<p class="mt-2 truncate text-sm text-muted-foreground">{request.user.email}</p>
				{/if}

				{#if (request.user as any).phone_number}
					<p class="mt-1 truncate text-sm text-muted-foreground">
						📞 {(request.user as any).phone_number}
					</p>
				{/if}

				<!-- Request Date and Status -->
				<div class="mt-2 flex items-center gap-2">
					<p class="text-xs text-muted-foreground">
						Requested {createdAt}
					</p>
					{#if !showActions && request.status}
						{@const status = request.status as unknown as RequestStatus}
						<span
							class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {status ===
							'approved'
								? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
								: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'}"
						>
							{status === 'approved' ? 'Approved' : 'Rejected'}
						</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Actions -->
		{#if showActions}
			<div class="flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={openDialog}
					disabled={isProcessing}
					aria-label="View request details from {displayName}"
				>
					<MessageSquare class="h-4 w-4" />
					<span class="ml-2">{m['membershipRequestCard.viewRequest']()}</span>
				</Button>

				<Button
					variant="default"
					size="sm"
					onclick={handleApprove}
					disabled={isProcessing}
					aria-label="Approve request from {displayName}"
					class="bg-green-600 hover:bg-green-700"
				>
					<CheckCircle class="h-4 w-4" />
					<span class="ml-2">{m['membershipRequestCard.approve']()}</span>
				</Button>

				<Button
					variant="destructive"
					size="sm"
					onclick={handleReject}
					disabled={isProcessing}
					aria-label="Reject request from {displayName}"
				>
					<XCircle class="h-4 w-4" />
					<span class="ml-2">{m['membershipRequestCard.reject']()}</span>
				</Button>
			</div>
		{:else}
			<div class="flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={openDialog}
					disabled={isProcessing}
					aria-label="View request details from {displayName}"
				>
					<MessageSquare class="h-4 w-4" />
					<span class="ml-2">{m['membershipRequestCard.viewRequest']()}</span>
				</Button>
			</div>
		{/if}
	</div>
</div>

<!-- Request Details Dialog -->
<Dialog open={dialogOpen} onOpenChange={(open) => (dialogOpen = open)}>
	<DialogContent class="max-w-lg">
		<DialogHeader>
			<DialogTitle>{m['membershipRequestCard.membershipRequestFrom']()} {displayName}</DialogTitle>
			<DialogDescription>
				Review the request details and approve or reject this membership application.
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 py-4">
			<!-- User Information -->
			<div class="space-y-2">
				<h4 class="text-sm font-semibold">{m['membershipRequestCard.applicantInformation']()}</h4>
				<dl class="space-y-1 text-sm">
					{#if request.user.first_name}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">
								{m['membershipRequestCard.firstName']()}
							</dt>
							<dd class="text-foreground">{request.user.first_name}</dd>
						</div>
					{/if}
					{#if request.user.last_name}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">
								{m['membershipRequestCard.lastName']()}
							</dt>
							<dd class="text-foreground">{request.user.last_name}</dd>
						</div>
					{/if}
					{#if request.user.preferred_name}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">
								{m['membershipRequestCard.preferredName']()}
							</dt>
							<dd class="text-foreground">{request.user.preferred_name}</dd>
						</div>
					{/if}
					{#if request.user.pronouns}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">
								{m['membershipRequestCard.pronouns']()}
							</dt>
							<dd class="text-foreground">{request.user.pronouns}</dd>
						</div>
					{/if}
					{#if request.user.email}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">
								{m['membershipRequestCard.email']()}
							</dt>
							<dd class="truncate text-foreground">{request.user.email}</dd>
						</div>
					{/if}
					{#if (request.user as any).phone_number}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">
								{m['membershipRequestCard.phone']()}
							</dt>
							<dd class="text-foreground">{(request.user as any).phone_number}</dd>
						</div>
					{/if}
				</dl>
			</div>

			<!-- Message -->
			{#if request.message}
				<div class="space-y-2">
					<h4 class="text-sm font-semibold">{m['membershipRequestCard.message']()}</h4>
					<div
						class="rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground"
						style="white-space: pre-wrap; word-wrap: break-word;"
					>
						{request.message}
					</div>
				</div>
			{:else}
				<div class="space-y-2">
					<h4 class="text-sm font-semibold">{m['membershipRequestCard.message']()}</h4>
					<p class="text-sm italic text-muted-foreground">
						{m['membershipRequestCard.noMessage']()}
					</p>
				</div>
			{/if}

			<!-- Request Date -->
			<div class="text-xs text-muted-foreground">
				Requested {createdAt}
			</div>
		</div>

		<DialogFooter>
			<Button variant="outline" onclick={() => (dialogOpen = false)} disabled={isProcessing}>
				Close
			</Button>
			<Button variant="destructive" onclick={handleReject} disabled={isProcessing}>
				<XCircle class="mr-2 h-4 w-4" />
				Reject
			</Button>
			<Button
				variant="default"
				onclick={handleApprove}
				disabled={isProcessing}
				class="bg-green-600 hover:bg-green-700"
			>
				<CheckCircle class="mr-2 h-4 w-4" />
				Approve
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
