<script lang="ts">
	import type { WhitelistRequestSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Check, X, Clock, AlertCircle, Calendar, Mail } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';

	interface Props {
		request: WhitelistRequestSchema;
		onApprove: (request: WhitelistRequestSchema) => void;
		onReject: (request: WhitelistRequestSchema) => void;
		isProcessing?: boolean;
		showActions?: boolean;
	}

	let {
		request,
		onApprove,
		onReject,
		isProcessing = false,
		showActions = true
	}: Props = $props();

	// Format created date
	let createdAgo = $derived(
		request.created_at
			? formatDistanceToNow(new Date(request.created_at), { addSuffix: true })
			: 'Unknown'
	);

	// Format decided date
	let decidedAgo = $derived(
		request.decided_at
			? formatDistanceToNow(new Date(request.decided_at), { addSuffix: true })
			: null
	);

	// Status badge styling
	const statusStyles = {
		pending: {
			class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
			icon: Clock
		},
		approved: {
			class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
			icon: Check
		},
		rejected: {
			class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
			icon: X
		}
	};

	let statusStyle = $derived(statusStyles[request.status as keyof typeof statusStyles] || statusStyles.pending);
	let StatusIcon = $derived(statusStyle.icon);

	function handleApprove() {
		onApprove(request);
	}

	function handleReject() {
		onReject(request);
	}
</script>

<div
	class="rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
>
	<div class="flex items-start justify-between gap-4">
		<!-- Request Info -->
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<h3 class="truncate font-semibold text-foreground">
					{request.user_display_name}
				</h3>
				<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {statusStyle.class}">
					<StatusIcon class="h-3 w-3" />
					{request.status}
				</span>
			</div>

			<!-- Email -->
			<div class="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
				<Mail class="h-3.5 w-3.5 shrink-0" />
				<span class="truncate">{request.user_email}</span>
			</div>

			<!-- Matched blacklist entries count -->
			<div class="mt-2">
				<span class="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-200">
					<AlertCircle class="h-3 w-3" />
					Matches {request.matched_entries_count} blacklist {request.matched_entries_count === 1 ? 'entry' : 'entries'}
				</span>
			</div>

			<!-- Message from user -->
			{#if request.message}
				<div class="mt-3 rounded-md bg-muted/50 p-2">
					<p class="text-sm font-medium text-muted-foreground">Message from user:</p>
					<p class="text-sm text-foreground">{request.message}</p>
				</div>
			{/if}

			<!-- Metadata -->
			<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
				<span class="flex items-center gap-1">
					<Calendar class="h-3 w-3" />
					Requested {createdAgo}
				</span>
				{#if request.status !== 'pending' && decidedAgo}
					<span>
						{request.status === 'approved' ? 'Approved' : 'Rejected'} {decidedAgo}
						{#if request.decided_by_name}
							by {request.decided_by_name}
						{/if}
					</span>
				{/if}
			</div>
		</div>

		<!-- Actions -->
		{#if showActions && request.status === 'pending'}
			<div class="flex shrink-0 gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={handleReject}
					disabled={isProcessing}
					class="text-destructive hover:bg-destructive hover:text-destructive-foreground"
				>
					<X class="h-4 w-4" />
					<span class="sr-only md:not-sr-only md:ml-1">Reject</span>
				</Button>
				<Button
					variant="default"
					size="sm"
					onclick={handleApprove}
					disabled={isProcessing}
				>
					<Check class="h-4 w-4" />
					<span class="sr-only md:not-sr-only md:ml-1">Approve</span>
				</Button>
			</div>
		{/if}
	</div>
</div>
