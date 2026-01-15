<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { eventadmincoreUpdateEventStatus, eventadmincoreDeleteEvent } from '$lib/api/generated/sdk.gen';
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { cn } from '$lib/utils/cn';
	import { formatEventDateRange } from '$lib/utils/date';
	import EventCoverImage from '$lib/components/events/EventCoverImage.svelte';
	import EventBadges from '$lib/components/events/EventBadges.svelte';
	import DuplicateEventModal from '$lib/components/events/admin/DuplicateEventModal.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import {
		Plus,
		Calendar,
		MapPin,
		Users,
		Edit,
		Eye,
		Trash2,
		CheckCircle,
		XCircle,
		UserCheck,
		Mail,
		ListPlus,
		Ban,
		MoreVertical,
		Copy
	} from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Update event status mutation
	const updateStatusMutation = createMutation(() => ({
		mutationFn: async ({
			eventId,
			status
		}: {
			eventId: string;
			status: 'draft' | 'open' | 'closed' | 'cancelled';
		}) => {
			const response = await eventadmincoreUpdateEventStatus({
				path: { event_id: eventId, status },
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
						: 'Failed to update status';
				throw new Error(errorDetail);
			}

			if (!response.data) {
				throw new Error('Failed to update status');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['events'] });
			// Reload page data
			window.location.reload();
		},
		onError: (error: Error) => {
			alert(`Failed to update status: ${error.message}`);
		}
	}));

	// Delete event mutation
	const deleteEventMutation = createMutation(() => ({
		mutationFn: async (eventId: string) => {
			const response = await eventadmincoreDeleteEvent({
				path: { event_id: eventId },
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
			// Reload page data
			window.location.reload();
		},
		onError: (error: Error) => {
			alert(`Failed to delete event: ${error.message}`);
		}
	}));

	/**
	 * Navigate to create event page
	 */
	function createEvent(): void {
		goto(`/org/${organization.slug}/admin/events/new`);
	}

	/**
	 * Navigate to edit event page
	 */
	function editEvent(eventId: string): void {
		goto(`/org/${organization.slug}/admin/events/${eventId}/edit`);
	}

	/**
	 * Navigate to public event page
	 */
	function viewEvent(eventSlug: string): void {
		goto(`/events/${organization.slug}/${eventSlug}`);
	}

	/**
	 * Navigate to attendees management page
	 */
	function manageAttendees(eventId: string): void {
		goto(`/org/${organization.slug}/admin/events/${eventId}/attendees`);
	}

	/**
	 * Navigate to tickets management page
	 */
	function manageTickets(eventId: string): void {
		goto(`/org/${organization.slug}/admin/events/${eventId}/tickets`);
	}

	/**
	 * Navigate to invitations management page
	 */
	function manageInvitations(eventId: string): void {
		goto(`/org/${organization.slug}/admin/events/${eventId}/invitations`);
	}

	/**
	 * Navigate to waitlist management page
	 */
	function manageWaitlist(eventId: string): void {
		goto(`/org/${organization.slug}/admin/events/${eventId}/waitlist`);
	}

	/**
	 * Publish event (draft → open)
	 */
	function publishEvent(eventId: string): void {
		if (confirm(m['orgAdmin.events.confirmations.publish']())) {
			updateStatusMutation.mutate({ eventId, status: 'open' });
		}
	}

	/**
	 * Close event (open → closed)
	 */
	function closeEvent(eventId: string): void {
		if (confirm(m['orgAdmin.events.confirmations.close']())) {
			updateStatusMutation.mutate({ eventId, status: 'closed' });
		}
	}

	/**
	 * Cancel event (any → cancelled)
	 */
	function cancelEvent(eventId: string): void {
		if (confirm(m['orgAdmin.events.confirmations.cancel']())) {
			updateStatusMutation.mutate({ eventId, status: 'cancelled' });
		}
	}

	/**
	 * Delete event (permanently delete)
	 */
	function deleteEvent(eventId: string): void {
		if (confirm(m['orgAdmin.events.confirmations.delete']())) {
			deleteEventMutation.mutate(eventId);
		}
	}

	/**
	 * Reopen event (closed → open)
	 */
	function reopenEvent(eventId: string): void {
		if (confirm(m['orgAdmin.events.confirmations.reopen']())) {
			updateStatusMutation.mutate({ eventId, status: 'open' });
		}
	}

	/**
	 * Get status badge color
	 */
	function getStatusColor(status: string): string {
		switch (status) {
			case 'draft':
				return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
			case 'open':
				return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
			case 'closed':
				return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
			case 'cancelled':
				return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	/**
	 * Format date
	 */
	function formatDate(date: string): string {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	// Helper to check if event is past (ended)
	function isPastEvent(event: EventInListSchema): boolean {
		if (!event.end) return false;
		return new Date(event.end) < new Date();
	}

	// Derived state: group events by status and time
	// Note: Status type in OpenAPI is incorrect, using string comparison
	// Past events are separated regardless of status
	let draftEvents = $derived(
		data.events.filter(
			(e: EventInListSchema) => (e.status as string) === 'draft' && !isPastEvent(e)
		)
	);
	let openEvents = $derived(
		data.events.filter((e: EventInListSchema) => (e.status as string) === 'open' && !isPastEvent(e))
	);
	let closedEvents = $derived(
		data.events.filter(
			(e: EventInListSchema) => (e.status as string) === 'closed' && !isPastEvent(e)
		)
	);
	let cancelledEvents = $derived(
		data.events.filter(
			(e: EventInListSchema) => (e.status as string) === 'cancelled' && !isPastEvent(e)
		)
	);
	let pastEvents = $derived(data.events.filter((e: EventInListSchema) => isPastEvent(e)));

	// Duplicate modal state
	let showDuplicateModal = $state(false);
	let duplicateEventData = $state<{
		id: string;
		name: string;
		start: string;
	} | null>(null);

	/**
	 * Open duplicate modal for an event
	 */
	function openDuplicateModal(event: EventInListSchema): void {
		duplicateEventData = {
			id: event.id,
			name: event.name,
			start: event.start
		};
		showDuplicateModal = true;
	}

	/**
	 * Close duplicate modal
	 */
	function closeDuplicateModal(): void {
		showDuplicateModal = false;
		duplicateEventData = null;
	}
</script>

<svelte:head>
	<title>{m['orgAdmin.events.pageTitle']()} - {organization.name} Admin | Revel</title>
	<meta
		name="description"
		content={m['orgAdmin.events.metaDescription']({ orgName: organization.name })}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
				{m['orgAdmin.events.pageTitle']()}
			</h1>
			<p class="mt-1 text-sm text-muted-foreground">{m['orgAdmin.events.pageDescription']()}</p>
		</div>

		{#if data.canCreateEvent}
			<button
				type="button"
				onclick={createEvent}
				class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<Plus class="h-5 w-5" aria-hidden="true" />
				{m['orgAdmin.events.createEventButton']()}
			</button>
		{/if}
	</div>

	<!-- Empty state -->
	{#if data.events.length === 0}
		<div class="rounded-lg border border-border bg-card p-12 text-center">
			<Calendar class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<h3 class="mt-4 text-lg font-semibold">{m['orgAdmin.events.empty.title']()}</h3>
			<p class="mt-2 text-sm text-muted-foreground">{m['orgAdmin.events.empty.description']()}</p>
			{#if data.canCreateEvent}
				<button
					type="button"
					onclick={createEvent}
					class="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
				>
					<Plus class="h-5 w-5" aria-hidden="true" />
					{m['orgAdmin.events.createEventButton']()}
				</button>
			{/if}
		</div>
	{:else}
		<!-- Draft Events -->
		{#if draftEvents.length > 0}
			<div class="space-y-4">
				<h2 class="text-lg font-semibold">
					{m['orgAdmin.events.sections.drafts']({
						count: draftEvents.length,
						plural: draftEvents.length === 1 ? '' : m['orgAdmin.events.sections.drafts_plural']()
					})}
				</h2>
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each draftEvents as event (event.id)}
						<div
							class="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
						>
							<!-- Cover Image -->
							<EventCoverImage {event} />

							<!-- Card Content -->
							<div class="flex flex-1 flex-col gap-3 p-4">
								<!-- Header -->
								<div class="flex items-start justify-between gap-2">
									<h3 class="flex-1 font-semibold">{event.name}</h3>
									<div class="flex items-center gap-2">
										<span
											class={cn(
												'rounded-full px-2 py-1 text-xs font-medium',
												getStatusColor(event.status)
											)}
										>
											{m['orgAdmin.events.status.draft']()}
										</span>
										<!-- More Actions Dropdown -->
										<DropdownMenu.Root>
											<DropdownMenu.Trigger>
												{#snippet child({ props })}
													<button
														{...props}
														type="button"
														class="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
														aria-label={m['orgAdmin.events.actions.moreActions']()}
													>
														<MoreVertical class="h-4 w-4" aria-hidden="true" />
													</button>
												{/snippet}
											</DropdownMenu.Trigger>
											<DropdownMenu.Content align="end" class="w-48">
												<DropdownMenu.Item onclick={() => openDuplicateModal(event)}>
													<Copy class="mr-2 h-4 w-4" />
													{m['orgAdmin.events.actions.duplicate']()}
												</DropdownMenu.Item>
												<DropdownMenu.Separator />
												<DropdownMenu.Item
													onclick={() => cancelEvent(event.id)}
													class="text-orange-600 focus:text-orange-600"
												>
													<Ban class="mr-2 h-4 w-4" />
													{m['orgAdmin.events.actions.cancel']()}
												</DropdownMenu.Item>
												<DropdownMenu.Item
													onclick={() => deleteEvent(event.id)}
													class="text-destructive focus:text-destructive"
												>
													<Trash2 class="mr-2 h-4 w-4" />
													{m['orgAdmin.events.actions.delete']()}
												</DropdownMenu.Item>
											</DropdownMenu.Content>
										</DropdownMenu.Root>
									</div>
								</div>

								<!-- Event details -->
								<div class="space-y-2 text-sm text-muted-foreground">
									<div class="flex items-center gap-2">
										<Calendar class="h-4 w-4" aria-hidden="true" />
										{formatDate(event.start)}
									</div>
									{#if event.city}
										<div class="flex items-center gap-2">
											<MapPin class="h-4 w-4" aria-hidden="true" />
											{event.city.name}, {event.city.country}
										</div>
									{/if}
								</div>

								<!-- Actions -->
								<div class="flex flex-wrap gap-2 border-t border-border pt-3">
									<button
										type="button"
										onclick={() => viewEvent(event.slug)}
										class="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
									>
										<Eye class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.preview']()}
									</button>
									<button
										type="button"
										onclick={() => editEvent(event.id)}
										class="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
									>
										<Edit class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.edit']()}
									</button>
									<button
										type="button"
										onclick={() => publishEvent(event.id)}
										class="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-700"
									>
										<CheckCircle class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.publish']()}
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Open Events -->
		{#if openEvents.length > 0}
			<div class="space-y-4">
				<h2 class="text-lg font-semibold">
					{m['orgAdmin.events.sections.open']({
						count: openEvents.length,
						plural: openEvents.length === 1 ? '' : m['orgAdmin.events.sections.open_plural']()
					})}
				</h2>
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each openEvents as event (event.id)}
						<div
							class="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
						>
							<!-- Cover Image -->
							<EventCoverImage {event} />

							<!-- Card Content -->
							<div class="flex flex-1 flex-col gap-3 p-4">
								<!-- Header -->
								<div class="flex items-start justify-between gap-2">
									<h3 class="flex-1 font-semibold">{event.name}</h3>
									<div class="flex items-center gap-2">
										<span
											class={cn(
												'rounded-full px-2 py-1 text-xs font-medium',
												getStatusColor(event.status)
											)}
										>
											{m['orgAdmin.events.status.published']()}
										</span>
										<!-- More Actions Dropdown -->
										<DropdownMenu.Root>
											<DropdownMenu.Trigger>
												{#snippet child({ props })}
													<button
														{...props}
														type="button"
														class="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
														aria-label={m['orgAdmin.events.actions.moreActions']()}
													>
														<MoreVertical class="h-4 w-4" aria-hidden="true" />
													</button>
												{/snippet}
											</DropdownMenu.Trigger>
											<DropdownMenu.Content align="end" class="w-48">
												<DropdownMenu.Item onclick={() => openDuplicateModal(event)}>
													<Copy class="mr-2 h-4 w-4" />
													{m['orgAdmin.events.actions.duplicate']()}
												</DropdownMenu.Item>
												<DropdownMenu.Separator />
												<DropdownMenu.Item
													onclick={() => closeEvent(event.id)}
													class="text-red-600 focus:text-red-600"
												>
													<XCircle class="mr-2 h-4 w-4" />
													{m['orgAdmin.events.actions.close']()}
												</DropdownMenu.Item>
												<DropdownMenu.Item
													onclick={() => cancelEvent(event.id)}
													class="text-orange-600 focus:text-orange-600"
												>
													<Ban class="mr-2 h-4 w-4" />
													{m['orgAdmin.events.actions.cancel']()}
												</DropdownMenu.Item>
												<DropdownMenu.Item
													onclick={() => deleteEvent(event.id)}
													class="text-destructive focus:text-destructive"
												>
													<Trash2 class="mr-2 h-4 w-4" />
													{m['orgAdmin.events.actions.delete']()}
												</DropdownMenu.Item>
											</DropdownMenu.Content>
										</DropdownMenu.Root>
									</div>
								</div>

								<!-- Event details -->
								<div class="space-y-2 text-sm text-muted-foreground">
									<div class="flex items-center gap-2">
										<Calendar class="h-4 w-4" aria-hidden="true" />
										{formatDate(event.start)}
									</div>
									{#if event.city}
										<div class="flex items-center gap-2">
											<MapPin class="h-4 w-4" aria-hidden="true" />
											{event.city.name}, {event.city.country}
										</div>
									{/if}
									{#if event.attendee_count !== undefined}
										<div class="flex items-center gap-2">
											<Users class="h-4 w-4" aria-hidden="true" />
											{event.attendee_count}
											{event.requires_ticket
												? m['orgAdmin.events.attendeeCount.attendees']()
												: m['orgAdmin.events.attendeeCount.rsvps']()}
										</div>
									{/if}
								</div>

								<!-- Actions -->
								<div class="flex flex-wrap gap-2 border-t border-border pt-3">
									<button
										type="button"
										onclick={() => viewEvent(event.slug)}
										class="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
									>
										<Eye class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.view']()}
									</button>
									<button
										type="button"
										onclick={() => editEvent(event.id)}
										class="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
									>
										<Edit class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.edit']()}
									</button>
									{#if event.requires_ticket}
										<button
											type="button"
											onclick={() => manageTickets(event.id)}
											class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
										>
											<UserCheck class="h-4 w-4" aria-hidden="true" />
											{m['orgAdmin.events.actions.tickets']()}
										</button>
									{:else}
										<button
											type="button"
											onclick={() => manageAttendees(event.id)}
											class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
										>
											<UserCheck class="h-4 w-4" aria-hidden="true" />
											{m['orgAdmin.events.actions.attendees']()}
										</button>
									{/if}
									<button
										type="button"
										onclick={() => manageInvitations(event.id)}
										class="inline-flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-purple-700"
									>
										<Mail class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.invitations']()}
									</button>
									{#if event.waitlist_open}
										<button
											type="button"
											onclick={() => manageWaitlist(event.id)}
											class="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-amber-700"
										>
											<ListPlus class="h-4 w-4" aria-hidden="true" />
											{m['orgAdmin.events.actions.waitlist']()}
										</button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Closed Events -->
		{#if closedEvents.length > 0}
			<div class="space-y-4">
				<h2 class="text-lg font-semibold">
					{m['orgAdmin.events.sections.closed']({
						count: closedEvents.length,
						plural: closedEvents.length === 1 ? '' : m['orgAdmin.events.sections.closed_plural']()
					})}
				</h2>
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each closedEvents as event (event.id)}
						<div
							class="flex flex-col overflow-hidden rounded-lg border border-border bg-card opacity-75 shadow-sm transition-shadow hover:shadow-md"
						>
							<!-- Cover Image -->
							<EventCoverImage {event} />

							<!-- Card Content -->
							<div class="flex flex-1 flex-col gap-3 p-4">
								<!-- Header -->
								<div class="flex items-start justify-between gap-2">
									<h3 class="flex-1 font-semibold">{event.name}</h3>
									<div class="flex items-center gap-2">
										<span
											class={cn(
												'rounded-full px-2 py-1 text-xs font-medium',
												getStatusColor(event.status)
											)}
										>
											{m['orgAdmin.events.status.closed']()}
										</span>
										<!-- More Actions Dropdown -->
										<DropdownMenu.Root>
											<DropdownMenu.Trigger>
												{#snippet child({ props })}
													<button
														{...props}
														type="button"
														class="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
														aria-label={m['orgAdmin.events.actions.moreActions']()}
													>
														<MoreVertical class="h-4 w-4" aria-hidden="true" />
													</button>
												{/snippet}
											</DropdownMenu.Trigger>
											<DropdownMenu.Content align="end" class="w-48">
												<DropdownMenu.Item onclick={() => openDuplicateModal(event)}>
													<Copy class="mr-2 h-4 w-4" />
													{m['orgAdmin.events.actions.duplicate']()}
												</DropdownMenu.Item>
												<DropdownMenu.Separator />
												<DropdownMenu.Item
													onclick={() => cancelEvent(event.id)}
													class="text-orange-600 focus:text-orange-600"
												>
													<Ban class="mr-2 h-4 w-4" />
													{m['orgAdmin.events.actions.cancel']()}
												</DropdownMenu.Item>
												<DropdownMenu.Item
													onclick={() => deleteEvent(event.id)}
													class="text-destructive focus:text-destructive"
												>
													<Trash2 class="mr-2 h-4 w-4" />
													{m['orgAdmin.events.actions.delete']()}
												</DropdownMenu.Item>
											</DropdownMenu.Content>
										</DropdownMenu.Root>
									</div>
								</div>

								<!-- Event details -->
								<div class="space-y-2 text-sm text-muted-foreground">
									<div class="flex items-center gap-2">
										<Calendar class="h-4 w-4" aria-hidden="true" />
										{formatDate(event.start)}
									</div>
									{#if event.city}
										<div class="flex items-center gap-2">
											<MapPin class="h-4 w-4" aria-hidden="true" />
											{event.city.name}, {event.city.country}
										</div>
									{/if}
									{#if event.attendee_count !== undefined}
										<div class="flex items-center gap-2">
											<Users class="h-4 w-4" aria-hidden="true" />
											{event.attendee_count}
											{event.requires_ticket
												? m['orgAdmin.events.attendeeCount.attendees']()
												: m['orgAdmin.events.attendeeCount.rsvps']()}
										</div>
									{/if}
								</div>

								<!-- Actions -->
								<div class="flex flex-wrap gap-2 border-t border-border pt-3">
									<button
										type="button"
										onclick={() => viewEvent(event.slug)}
										class="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
									>
										<Eye class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.view']()}
									</button>
									{#if event.requires_ticket}
										<button
											type="button"
											onclick={() => manageTickets(event.id)}
											class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
										>
											<UserCheck class="h-4 w-4" aria-hidden="true" />
											{m['orgAdmin.events.actions.tickets']()}
										</button>
									{:else}
										<button
											type="button"
											onclick={() => manageAttendees(event.id)}
											class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
										>
											<UserCheck class="h-4 w-4" aria-hidden="true" />
											{m['orgAdmin.events.actions.attendees']()}
										</button>
									{/if}
									<button
										type="button"
										onclick={() => manageInvitations(event.id)}
										class="inline-flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-purple-700"
									>
										<Mail class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.invitations']()}
									</button>
									{#if event.waitlist_open}
										<button
											type="button"
											onclick={() => manageWaitlist(event.id)}
											class="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-amber-700"
										>
											<ListPlus class="h-4 w-4" aria-hidden="true" />
											{m['orgAdmin.events.actions.waitlist']()}
										</button>
									{/if}
									<button
										type="button"
										onclick={() => reopenEvent(event.id)}
										class="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-700"
									>
										<CheckCircle class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.reopen']()}
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Cancelled Events -->
		{#if cancelledEvents.length > 0}
			<div class="space-y-4">
				<h2 class="text-lg font-semibold">
					{m['orgAdmin.events.sections.cancelled']({
						count: cancelledEvents.length,
						plural:
							cancelledEvents.length === 1 ? '' : m['orgAdmin.events.sections.cancelled_plural']()
					})}
				</h2>
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each cancelledEvents as event (event.id)}
						<div
							class="flex flex-col overflow-hidden rounded-lg border border-border bg-card opacity-75 shadow-sm transition-shadow hover:shadow-md"
						>
							<!-- Cover Image -->
							<EventCoverImage {event} />

							<!-- Card Content -->
							<div class="flex flex-1 flex-col gap-3 p-4">
								<!-- Header -->
								<div class="flex items-start justify-between gap-2">
									<h3 class="flex-1 font-semibold">{event.name}</h3>
									<div class="flex items-center gap-2">
										<span
											class={cn(
												'rounded-full px-2 py-1 text-xs font-medium',
												getStatusColor(event.status)
											)}
										>
											{m['orgAdmin.events.status.cancelled']()}
										</span>
										<!-- More Actions Dropdown -->
										<DropdownMenu.Root>
											<DropdownMenu.Trigger>
												{#snippet child({ props })}
													<button
														{...props}
														type="button"
														class="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
														aria-label={m['orgAdmin.events.actions.moreActions']()}
													>
														<MoreVertical class="h-4 w-4" aria-hidden="true" />
													</button>
												{/snippet}
											</DropdownMenu.Trigger>
											<DropdownMenu.Content align="end" class="w-48">
												<DropdownMenu.Item onclick={() => openDuplicateModal(event)}>
													<Copy class="mr-2 h-4 w-4" />
													{m['orgAdmin.events.actions.duplicate']()}
												</DropdownMenu.Item>
												<DropdownMenu.Separator />
												<DropdownMenu.Item
													onclick={() => deleteEvent(event.id)}
													class="text-destructive focus:text-destructive"
												>
													<Trash2 class="mr-2 h-4 w-4" />
													{m['orgAdmin.events.actions.delete']()}
												</DropdownMenu.Item>
											</DropdownMenu.Content>
										</DropdownMenu.Root>
									</div>
								</div>

								<!-- Event details -->
								<div class="space-y-2 text-sm text-muted-foreground">
									<div class="flex items-center gap-2">
										<Calendar class="h-4 w-4" aria-hidden="true" />
										{formatDate(event.start)}
									</div>
									{#if event.city}
										<div class="flex items-center gap-2">
											<MapPin class="h-4 w-4" aria-hidden="true" />
											{event.city.name}, {event.city.country}
										</div>
									{/if}
									{#if event.attendee_count !== undefined}
										<div class="flex items-center gap-2">
											<Users class="h-4 w-4" aria-hidden="true" />
											{event.attendee_count}
											{event.requires_ticket
												? m['orgAdmin.events.attendeeCount.attendees']()
												: m['orgAdmin.events.attendeeCount.rsvps']()}
										</div>
									{/if}
								</div>

								<!-- Actions -->
								<div class="flex flex-wrap gap-2 border-t border-border pt-3">
									<button
										type="button"
										onclick={() => viewEvent(event.slug)}
										class="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
									>
										<Eye class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.view']()}
									</button>
									{#if event.requires_ticket}
										<button
											type="button"
											onclick={() => manageTickets(event.id)}
											class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
										>
											<UserCheck class="h-4 w-4" aria-hidden="true" />
											{m['orgAdmin.events.actions.tickets']()}
										</button>
									{:else}
										<button
											type="button"
											onclick={() => manageAttendees(event.id)}
											class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
										>
											<UserCheck class="h-4 w-4" aria-hidden="true" />
											{m['orgAdmin.events.actions.attendees']()}
										</button>
									{/if}
									<button
										type="button"
										onclick={() => manageInvitations(event.id)}
										class="inline-flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-purple-700"
									>
										<Mail class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.invitations']()}
									</button>
									{#if event.waitlist_open}
										<button
											type="button"
											onclick={() => manageWaitlist(event.id)}
											class="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-amber-700"
										>
											<ListPlus class="h-4 w-4" aria-hidden="true" />
											{m['orgAdmin.events.actions.waitlist']()}
										</button>
									{/if}
									<button
										type="button"
										onclick={() => reopenEvent(event.id)}
										class="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-700"
									>
										<CheckCircle class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.reopen']()}
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Past Events -->
		{#if pastEvents.length > 0}
			<div class="space-y-4 opacity-75">
				<h2 class="text-lg font-semibold">
					{m['orgAdmin.events.sections.past']({
						count: pastEvents.length,
						plural: pastEvents.length === 1 ? '' : m['orgAdmin.events.sections.past_plural']()
					})}
				</h2>
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each pastEvents as event (event.id)}
						<div
							class="flex flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md"
						>
							<!-- Cover Image -->
							<EventCoverImage {event} />
							<div class="flex flex-1 flex-col gap-4 p-4">
								<div class="space-y-2">
									<div class="flex items-start justify-between gap-2">
										<h3 class="line-clamp-2 flex-1 text-lg font-semibold leading-tight">
											{event.name}
										</h3>
										<div class="flex items-center gap-2">
											<EventBadges {event} />
											<!-- More Actions Dropdown -->
											<DropdownMenu.Root>
												<DropdownMenu.Trigger>
													{#snippet child({ props })}
														<button
															{...props}
															type="button"
															class="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
															aria-label={m['orgAdmin.events.actions.moreActions']()}
														>
															<MoreVertical class="h-4 w-4" aria-hidden="true" />
														</button>
													{/snippet}
												</DropdownMenu.Trigger>
												<DropdownMenu.Content align="end" class="w-48">
													<DropdownMenu.Item onclick={() => openDuplicateModal(event)}>
														<Copy class="mr-2 h-4 w-4" />
														{m['orgAdmin.events.actions.duplicate']()}
													</DropdownMenu.Item>
													<DropdownMenu.Separator />
													<DropdownMenu.Item
														onclick={() => deleteEvent(event.id)}
														class="text-destructive focus:text-destructive"
													>
														<Trash2 class="mr-2 h-4 w-4" />
														{m['orgAdmin.events.actions.delete']()}
													</DropdownMenu.Item>
												</DropdownMenu.Content>
											</DropdownMenu.Root>
										</div>
									</div>
									<div class="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
										<div class="flex items-center gap-1.5">
											<Calendar class="h-4 w-4" aria-hidden="true" />
											<time datetime={event.start}>
												{formatEventDateRange(event.start, event.end)}
											</time>
										</div>
										<!-- Location not available in EventInListSchema -->
									</div>
								</div>

								<div class="mt-auto flex flex-wrap gap-2">
									<!-- View Event -->
									<a
										href="/events/{data.organization.slug}/{event.slug}"
										class="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
									>
										<Eye class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.view']()}
									</a>

									<!-- Manage Tickets/Attendees -->
									<a
										href="/org/{data.organization.slug}/admin/events/{event.id}/attendees"
										class="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
									>
										<Users class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.tickets']()}
									</a>

									<!-- Invitations -->
									<a
										href="/org/{data.organization.slug}/admin/events/{event.id}/invitations"
										class="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
									>
										<Mail class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.invitations']()}
									</a>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Duplicate Event Modal -->
{#if duplicateEventData}
	<DuplicateEventModal
		bind:open={showDuplicateModal}
		eventId={duplicateEventData.id}
		eventName={duplicateEventData.name}
		eventStart={duplicateEventData.start}
		organizationSlug={organization.slug}
		onClose={closeDuplicateModal}
	/>
{/if}

<style>
	/* Ensure consistent focus states for accessibility */
	:global(button:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
