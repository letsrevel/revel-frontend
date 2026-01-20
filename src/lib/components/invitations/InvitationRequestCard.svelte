<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventInvitationRequestSchema } from '$lib/api/generated/types.gen';
	import { Card } from '$lib/components/ui/card';
	import { Calendar, MapPin, Ticket, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-svelte';
	import { getImageUrl } from '$lib/utils/url';
	import { formatEventDateRange } from '$lib/utils/date';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { eventpublicdiscoveryDeleteInvitationRequest } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		request: EventInvitationRequestSchema;
	}

	let { request }: Props = $props();

	const queryClient = useQueryClient();
	let accessToken = $derived(authStore.accessToken);

	// Format event date
	let eventDate = $derived.by(() => {
		if (!request.event.start) return null;
		return formatEventDateRange(request.event.start, request.event.start);
	});

	// Get event location
	let eventLocation = $derived.by(() => {
		const event = request.event as any;
		return event.venue_name || event.location || null;
	});

	// Format created date
	let createdDate = $derived.by(() => {
		const date = new Date(request.created_at);
		return date.toLocaleDateString();
	});

	// Status display
	let statusDisplay = $derived.by(() => {
		switch (request.status) {
			case 'pending':
				return {
					label: 'Pending',
					class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
					icon: Clock
				};
			case 'approved':
				return {
					label: 'Approved',
					class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
					icon: CheckCircle2
				};
			case 'rejected':
				return {
					label: 'Rejected',
					class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
					icon: XCircle
				};
			default:
				return {
					label: request.status,
					class: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
					icon: Clock
				};
		}
	});

	// Cancel mutation
	const cancelMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken || !request.id) {
				throw new Error('Missing authentication or request ID');
			}
			await eventpublicdiscoveryDeleteInvitationRequest({
				headers: { Authorization: `Bearer ${accessToken}` },
				path: { request_id: request.id }
			});
		},
		onSuccess: () => {
			toast.success('Invitation request cancelled');
			// Invalidate queries to refresh the list
			queryClient.invalidateQueries({ queryKey: ['my-invitation-requests'] });
		},
		onError: (error: any) => {
			console.error('Failed to cancel request:', error);
			toast.error('Failed to cancel request', {
				description: error.message || 'Please try again'
			});
		}
	}));

	function handleCancel() {
		if (confirm('Are you sure you want to cancel this invitation request?')) {
			cancelMutation.mutate();
		}
	}
</script>

<Card class="group overflow-hidden transition-shadow hover:shadow-lg">
	<div class="flex flex-col gap-4 p-4 md:p-6">
		<!-- Header with Event Info -->
		<div class="flex items-start gap-4">
			<!-- Event Logo/Icon (prefer thumbnail for card display) -->
			<div class="shrink-0">
				{#if (request.event as any).logo_thumbnail_url || request.event.logo}
					<img
						src={getImageUrl((request.event as any).logo_thumbnail_url || request.event.logo)}
						alt=""
						class="h-16 w-16 rounded-lg border object-cover"
					/>
				{:else}
					<div
						class="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary"
					>
						<Ticket class="h-8 w-8" aria-hidden="true" />
					</div>
				{/if}
			</div>

			<!-- Event Details -->
			<div class="min-w-0 flex-1">
				<div class="mb-2 flex items-start justify-between gap-2">
					<div class="min-w-0">
						<h3 class="truncate text-lg font-semibold">
							<a
								href="/events/{request.event.id}"
								class="hover:underline focus:underline focus:outline-none"
							>
								{request.event.name}
							</a>
						</h3>
					</div>
					<div
						class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {statusDisplay.class}"
					>
						<svelte:component this={statusDisplay.icon} class="h-3 w-3" aria-hidden="true" />
						{statusDisplay.label}
					</div>
				</div>

				<!-- Event Metadata -->
				<dl class="space-y-1.5 text-sm">
					{#if eventDate}
						<div class="flex items-center gap-2 text-muted-foreground">
							<Calendar class="h-4 w-4 shrink-0" aria-hidden="true" />
							<dd class="truncate">{eventDate}</dd>
						</div>
					{/if}
					{#if eventLocation}
						<div class="flex items-center gap-2 text-muted-foreground">
							<MapPin class="h-4 w-4 shrink-0" aria-hidden="true" />
							<dd class="truncate">{eventLocation}</dd>
						</div>
					{/if}
				</dl>
			</div>
		</div>

		<!-- User's Message -->
		{#if request.message}
			<div class="rounded-md border bg-muted/50 p-3">
				<p class="text-sm text-muted-foreground">
					<span class="font-medium">{m['invitationRequestCard.yourMessage']()}</span>
					"{request.message}"
				</p>
			</div>
		{/if}

		<!-- Footer -->
		<div
			class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm"
		>
			<div class="text-muted-foreground">
				<span class="font-medium">{m['invitationRequestCard.requested']()}</span>
				{createdDate}
			</div>

			<div class="flex gap-2">
				{#if request.status === 'pending'}
					<button
						type="button"
						onclick={handleCancel}
						disabled={cancelMutation.isPending}
						class="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if cancelMutation.isPending}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							Cancelling...
						{:else}
							Cancel Request
						{/if}
					</button>
				{/if}
				<a
					href="/events/{request.event.id}"
					class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					View Event
				</a>
			</div>
		</div>
	</div>
</Card>
