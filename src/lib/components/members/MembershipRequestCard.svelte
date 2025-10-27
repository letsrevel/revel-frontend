<script lang="ts">
	import type { OrganizationMembershipRequestRetrieve } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
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

	interface Props {
		request: OrganizationMembershipRequestRetrieve;
		onApprove: (request: OrganizationMembershipRequestRetrieve) => void;
		onReject: (request: OrganizationMembershipRequestRetrieve) => void;
		isProcessing?: boolean;
	}

	let { request, onApprove, onReject, isProcessing = false }: Props = $props();

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
		onApprove(request);
		dialogOpen = false;
	}

	function handleReject() {
		onReject(request);
		dialogOpen = false;
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
		<div class="min-w-0">
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
							<span class="font-medium">First:</span>
							{request.user.first_name}
						{/if}
						{#if request.user.first_name && request.user.last_name}
							<span class="mx-2">•</span>
						{/if}
						{#if request.user.last_name}
							<span class="font-medium">Last:</span>
							{request.user.last_name}
						{/if}
					</p>
				{/if}
				{#if request.user.preferred_name}
					<p class="truncate">
						<span class="font-medium">Preferred:</span>
						{request.user.preferred_name}
					</p>
				{/if}
			</div>

			{#if request.user.email}
				<p class="mt-2 truncate text-sm text-muted-foreground">{request.user.email}</p>
			{/if}

			{#if (request.user as any).phone_number}
				<p class="mt-1 truncate text-sm text-muted-foreground">📞 {(request.user as any).phone_number}</p>
			{/if}

			<!-- Request Date -->
			<p class="mt-2 text-xs text-muted-foreground">
				Requested {createdAt}
			</p>
		</div>

		<!-- Actions -->
		<div class="flex flex-wrap gap-2">
			<Button
				variant="outline"
				size="sm"
				onclick={openDialog}
				disabled={isProcessing}
				aria-label="View request details from {displayName}"
			>
				<MessageSquare class="h-4 w-4" />
				<span class="ml-2">View Request</span>
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
				<span class="ml-2">Approve</span>
			</Button>

			<Button
				variant="destructive"
				size="sm"
				onclick={handleReject}
				disabled={isProcessing}
				aria-label="Reject request from {displayName}"
			>
				<XCircle class="h-4 w-4" />
				<span class="ml-2">Reject</span>
			</Button>
		</div>
	</div>
</div>

<!-- Request Details Dialog -->
<Dialog open={dialogOpen} onOpenChange={(open) => (dialogOpen = open)}>
	<DialogContent class="max-w-lg">
		<DialogHeader>
			<DialogTitle>Membership Request from {displayName}</DialogTitle>
			<DialogDescription>
				Review the request details and approve or reject this membership application.
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 py-4">
			<!-- User Information -->
			<div class="space-y-2">
				<h4 class="text-sm font-semibold">Applicant Information</h4>
				<dl class="space-y-1 text-sm">
					{#if request.user.first_name}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">First Name:</dt>
							<dd class="text-foreground">{request.user.first_name}</dd>
						</div>
					{/if}
					{#if request.user.last_name}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">Last Name:</dt>
							<dd class="text-foreground">{request.user.last_name}</dd>
						</div>
					{/if}
					{#if request.user.preferred_name}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">Preferred Name:</dt>
							<dd class="text-foreground">{request.user.preferred_name}</dd>
						</div>
					{/if}
					{#if request.user.pronouns}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">Pronouns:</dt>
							<dd class="text-foreground">{request.user.pronouns}</dd>
						</div>
					{/if}
					{#if request.user.email}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">Email:</dt>
							<dd class="truncate text-foreground">{request.user.email}</dd>
						</div>
					{/if}
					{#if (request.user as any).phone_number}
						<div class="flex gap-2">
							<dt class="font-medium text-muted-foreground">Phone:</dt>
							<dd class="text-foreground">{(request.user as any).phone_number}</dd>
						</div>
					{/if}
				</dl>
			</div>

			<!-- Message -->
			{#if request.message}
				<div class="space-y-2">
					<h4 class="text-sm font-semibold">Message</h4>
					<div
						class="rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground"
						style="white-space: pre-wrap; word-wrap: break-word;"
					>
						{request.message}
					</div>
				</div>
			{:else}
				<div class="space-y-2">
					<h4 class="text-sm font-semibold">Message</h4>
					<p class="text-sm italic text-muted-foreground">No message provided</p>
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
