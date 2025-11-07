<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { eventadminUpdateEventStatus } from '$lib/api/generated/sdk.gen';
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { cn } from '$lib/utils/cn';
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
		Mail
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
			status: 'draft' | 'open' | 'closed' | 'deleted';
		}) => {
			const response = await eventadminUpdateEventStatus({
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
	 * Delete event (any → deleted)
	 */
	function deleteEvent(eventId: string): void {
		if (confirm(m['orgAdmin.events.confirmations.delete']())) {
			updateStatusMutation.mutate({ eventId, status: 'deleted' });
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
			case 'deleted':
				return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
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

	// Derived state: group events by status
	// Note: Status type in OpenAPI is incorrect, using string comparison
	let draftEvents = $derived(
		data.events.filter((e: EventInListSchema) => (e.status as string) === 'draft')
	);
	let openEvents = $derived(
		data.events.filter((e: EventInListSchema) => (e.status as string) === 'open')
	);
	let closedEvents = $derived(
		data.events.filter((e: EventInListSchema) => (e.status as string) === 'closed')
	);
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
					{m['orgAdmin.events.sections.drafts']({ count: draftEvents.length })}
				</h2>
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each draftEvents as event (event.id)}
						<div class="rounded-lg border border-border bg-card p-4 shadow-sm">
							<div class="space-y-3">
								<!-- Header -->
								<div class="flex items-start justify-between gap-2">
									<h3 class="font-semibold">{event.name}</h3>
									<span
										class={cn(
											'rounded-full px-2 py-1 text-xs font-medium',
											getStatusColor(event.status)
										)}
									>
										{m['orgAdmin.events.status.draft']()}
									</span>
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
									<button
										type="button"
										onclick={() => deleteEvent(event.id)}
										class="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
									>
										<Trash2 class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.delete']()}
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
					{m['orgAdmin.events.sections.published']({ count: openEvents.length })}
				</h2>
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each openEvents as event (event.id)}
						<div class="rounded-lg border border-border bg-card p-4 shadow-sm">
							<div class="space-y-3">
								<!-- Header -->
								<div class="flex items-start justify-between gap-2">
									<h3 class="font-semibold">{event.name}</h3>
									<span
										class={cn(
											'rounded-full px-2 py-1 text-xs font-medium',
											getStatusColor(event.status)
										)}
									>
										{m['orgAdmin.events.status.published']()}
									</span>
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
									<button
										type="button"
										onclick={() => closeEvent(event.id)}
										class="inline-flex items-center gap-1 rounded-md bg-orange-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-orange-700"
									>
										<XCircle class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.close']()}
									</button>
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
					{m['orgAdmin.events.sections.closed']({ count: closedEvents.length })}
				</h2>
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each closedEvents as event (event.id)}
						<div class="rounded-lg border border-border bg-card p-4 opacity-75 shadow-sm">
							<div class="space-y-3">
								<!-- Header -->
								<div class="flex items-start justify-between gap-2">
									<h3 class="font-semibold">{event.name}</h3>
									<span
										class={cn(
											'rounded-full px-2 py-1 text-xs font-medium',
											getStatusColor(event.status)
										)}
									>
										{m['orgAdmin.events.status.closed']()}
									</span>
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
									<button
										type="button"
										onclick={() => reopenEvent(event.id)}
										class="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-700"
									>
										<CheckCircle class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.reopen']()}
									</button>
									<button
										type="button"
										onclick={() => deleteEvent(event.id)}
										class="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
									>
										<Trash2 class="h-4 w-4" aria-hidden="true" />
										{m['orgAdmin.events.actions.delete']()}
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	/* Ensure consistent focus states for accessibility */
	:global(button:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
