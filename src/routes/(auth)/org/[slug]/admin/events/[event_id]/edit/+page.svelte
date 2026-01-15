<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import EventWizard from '$lib/components/events/admin/EventWizard.svelte';
	import DuplicateEventModal from '$lib/components/events/admin/DuplicateEventModal.svelte';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { eventadmincoreUpdateEventStatus, eventadmincoreDeleteEvent } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { CheckCircle, XCircle, FileEdit, Trash2, Ban, MoreVertical, Copy } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const event = $derived(data.event);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Current status
	const currentStatus = $derived(event.status as string);

	// Update event status mutation
	const updateStatusMutation = createMutation(() => ({
		mutationFn: async (status: 'draft' | 'open' | 'closed' | 'cancelled') => {
			if (!accessToken) throw new Error(m['eventEditPage.error_notAuthenticated']());

			const response = await eventadmincoreUpdateEventStatus({
				path: { event_id: event.id, status },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				const errorDetail =
					typeof response.error === 'object' &&
					response.error !== null &&
					'detail' in response.error
						? (response.error.detail as string)
						: m['eventEditPage.error_updateStatusFailed']();
				throw new Error(errorDetail);
			}

			if (!response.data) {
				throw new Error(m['eventEditPage.error_updateStatusFailed']());
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['events'] });
			// Reload the page to get updated event data
			window.location.reload();
		},
		onError: (error: Error) => {
			alert(`Failed to update status: ${error.message}`);
		}
	}));

	// Delete event mutation (permanent deletion)
	const deleteEventMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error(m['eventEditPage.error_notAuthenticated']());

			const response = await eventadmincoreDeleteEvent({
				path: { event_id: event.id },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				const errorDetail =
					typeof response.error === 'object' &&
					response.error !== null &&
					'detail' in response.error
						? (response.error.detail as string)
						: 'Failed to delete event';
				throw new Error(errorDetail);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['events'] });
			// Redirect to events list after deletion
			goto(`/org/${organization.slug}/admin/events`);
		},
		onError: (error: Error) => {
			alert(`Failed to delete event: ${error.message}`);
		}
	}));

	/**
	 * Publish event (draft → open)
	 */
	function publishEvent(): void {
		if (confirm(m['eventEditPage.publishConfirm']())) {
			updateStatusMutation.mutate('open');
		}
	}

	/**
	 * Close event (open → closed)
	 */
	function closeEvent(): void {
		if (confirm(m['eventEditPage.closeConfirm']())) {
			updateStatusMutation.mutate('closed');
		}
	}

	/**
	 * Mark as draft (open/closed → draft)
	 */
	function markAsDraft(): void {
		if (confirm(m['eventEditPage.draftConfirm']())) {
			updateStatusMutation.mutate('draft');
		}
	}

	/**
	 * Cancel event (any → cancelled)
	 */
	function cancelEvent(): void {
		if (confirm(m['orgAdmin.events.confirmations.cancel']())) {
			updateStatusMutation.mutate('cancelled');
		}
	}

	/**
	 * Delete event (permanent deletion)
	 */
	function deleteEvent(): void {
		if (confirm(m['orgAdmin.events.confirmations.delete']())) {
			deleteEventMutation.mutate();
		}
	}

	// Duplicate modal state
	let showDuplicateModal = $state(false);

	/**
	 * Open duplicate modal
	 */
	function openDuplicateModal(): void {
		showDuplicateModal = true;
	}

	/**
	 * Close duplicate modal
	 */
	function closeDuplicateModal(): void {
		showDuplicateModal = false;
	}
</script>

<svelte:head>
	<title>Edit Event: {event.name} - {organization.name} Admin | Revel</title>
	<meta name="description" content="Edit event: {event.name}" />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header Section with Status Badge and Actions -->
	<div>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-2xl font-bold tracking-tight md:text-3xl">Edit Event</h1>
					<!-- Status Badge -->
					<span
						class="rounded-full px-3 py-1 text-xs font-medium {currentStatus === 'draft'
							? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
							: currentStatus === 'open'
								? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
								: currentStatus === 'closed'
									? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
									: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}"
					>
						{currentStatus === 'draft'
							? 'Draft'
							: currentStatus === 'open'
								? 'Published'
								: currentStatus === 'closed'
									? 'Closed'
									: currentStatus}
					</span>
				</div>
				<p class="mt-1 text-sm text-muted-foreground">
					Update details for: <span class="font-semibold">{event.name}</span>
				</p>
			</div>

			<!-- Action Buttons -->
			<div class="flex flex-wrap items-center gap-2">
				{#if currentStatus === 'draft'}
					<!-- Publish action -->
					<button
						type="button"
						onclick={publishEvent}
						disabled={updateStatusMutation.isPending}
						class="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<CheckCircle class="h-4 w-4" aria-hidden="true" />
						Publish
					</button>
				{:else if currentStatus === 'open'}
					<!-- Close action -->
					<button
						type="button"
						onclick={closeEvent}
						disabled={updateStatusMutation.isPending}
						class="inline-flex items-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<XCircle class="h-4 w-4" aria-hidden="true" />
						Close
					</button>
					<!-- Mark as Draft -->
					<button
						type="button"
						onclick={markAsDraft}
						disabled={updateStatusMutation.isPending}
						class="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<FileEdit class="h-4 w-4" aria-hidden="true" />
						{m['eventEditPage.draftButton']()}
					</button>
				{:else if currentStatus === 'closed'}
					<!-- Reopen action -->
					<button
						type="button"
						onclick={publishEvent}
						disabled={updateStatusMutation.isPending}
						class="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<CheckCircle class="h-4 w-4" aria-hidden="true" />
						Reopen
					</button>
					<!-- Mark as Draft -->
					<button
						type="button"
						onclick={markAsDraft}
						disabled={updateStatusMutation.isPending}
						class="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<FileEdit class="h-4 w-4" aria-hidden="true" />
						{m['eventEditPage.draftButton']()}
					</button>
				{/if}

				<!-- Delete button (always available) -->
				<button
					type="button"
					onclick={deleteEvent}
					disabled={updateStatusMutation.isPending}
					class="inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Trash2 class="h-4 w-4" aria-hidden="true" />
					Delete
				</button>

				<!-- More Actions Dropdown -->
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								type="button"
								class="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								aria-label={m['orgAdmin.events.actions.moreActions']()}
							>
								<MoreVertical class="h-4 w-4" aria-hidden="true" />
							</button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-48">
						<DropdownMenu.Item onclick={openDuplicateModal}>
							<Copy class="mr-2 h-4 w-4" />
							{m['orgAdmin.events.actions.duplicate']()}
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>
	</div>

	<!-- Event Wizard Component -->
	<div class="rounded-lg border bg-card p-6 text-card-foreground shadow-sm md:p-8">
		<EventWizard
			{organization}
			existingEvent={event}
			userCity={data.userCity}
			orgCity={data.orgCity}
			eventSeries={data.eventSeries}
			questionnaires={data.questionnaires}
		/>
	</div>
</div>

<!-- Duplicate Event Modal -->
<DuplicateEventModal
	bind:open={showDuplicateModal}
	eventId={event.id}
	eventName={event.name}
	eventStart={event.start}
	organizationSlug={organization.slug}
	onClose={closeDuplicateModal}
/>

<style>
	/* Ensure consistent focus states for accessibility */
	:global(button:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
