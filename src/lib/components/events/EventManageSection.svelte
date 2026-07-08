<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import type {
		EventDetailSchema,
		OrganizationPermissionsSchema
	} from '$lib/api/generated/types.gen';
	import { Settings, Users, Mail, Megaphone, ListPlus } from '@lucide/svelte';
	import AnnouncementModal from '$lib/components/announcements/AnnouncementModal.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		eventpublicdiscoveryListEvents,
		organizationadminmembersListMembershipTiers
	} from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';

	interface Props {
		event: EventDetailSchema;
		userPermissions?: OrganizationPermissionsSchema | null;
	}

	let { event, userPermissions }: Props = $props();

	// State for announcement modal
	let announcementModalOpen = $state(false);
	let includePastEvents = $state(false);

	// Derived auth token
	const accessToken = $derived(authStore.accessToken);

	/**
	 * Check if user can manage this event (owner or staff)
	 */
	const canManageEvent = $derived.by(() => {
		if (!userPermissions || !event.organization?.id) return false;

		const orgPermissions = userPermissions.organization_permissions?.[event.organization.id];

		// User can manage if they are owner or staff
		return !!orgPermissions;
	});

	// Fetch events for announcement modal (only when modal might be used)
	const eventsQuery = createQuery(() => ({
		queryKey: ['admin-events', event.organization?.id, includePastEvents],
		queryFn: async () => {
			const response = await eventpublicdiscoveryListEvents({
				query: {
					organization: event.organization?.id,
					page_size: 100,
					include_past: includePastEvents
				}
			});
			if (response.error) throw response.error;
			return response.data;
		},
		enabled: !!canManageEvent && !!event.organization?.id
	}));

	// Fetch tiers for announcement modal
	const tiersQuery = createQuery(() => ({
		queryKey: ['membership-tiers', event.organization?.slug],
		queryFn: async () => {
			if (!event.organization) throw new Error('Organization not loaded');
			const response = await organizationadminmembersListMembershipTiers({
				path: { slug: event.organization.slug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw response.error;
			return response.data;
		},
		enabled: !!canManageEvent && !!accessToken && !!event.organization?.slug
	}));

	const eventsList = $derived(eventsQuery.data?.results ?? []);
	const eventsLoading = $derived(eventsQuery.isLoading);
	const tiersList = $derived(tiersQuery.data ?? []);
</script>

<!-- Manage Event Section (for staff/owners) -->
{#if canManageEvent}
	<div class="border-t pt-4">
		<h3 class="mb-3 text-sm font-semibold">{m['eventActionSidebar.manageEvent']()}</h3>
		<div class="space-y-2">
			<a
				href={resolve('/(auth)/org/[slug]/admin/events/[event_id]/edit', {
					slug: event.organization.slug,
					event_id: event.id
				})}
				class="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<Settings class="h-4 w-4" aria-hidden="true" />
				{m['eventActionSidebar.editEvent']()}
			</a>
			{#if event.requires_ticket}
				<a
					href={resolve('/(auth)/org/[slug]/admin/events/[event_id]/tickets', {
						slug: event.organization.slug,
						event_id: event.id
					})}
					class="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<Users class="h-4 w-4" aria-hidden="true" />
					{m['eventActionSidebar.manageTickets']()}
				</a>
			{:else}
				<a
					href={resolve('/(auth)/org/[slug]/admin/events/[event_id]/attendees', {
						slug: event.organization.slug,
						event_id: event.id
					})}
					class="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<Users class="h-4 w-4" aria-hidden="true" />
					{m['eventActionSidebar.manageAttendees']()}
				</a>
			{/if}
			{#if event.waitlist_open}
				<a
					href={resolve('/(auth)/org/[slug]/admin/events/[event_id]/waitlist', {
						slug: event.organization.slug,
						event_id: event.id
					})}
					class="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<ListPlus class="h-4 w-4" aria-hidden="true" />
					{m['eventActionSidebar.manageWaitlist']()}
				</a>
			{/if}
			<a
				href={resolve('/(auth)/org/[slug]/admin/events/[event_id]/invitations', {
					slug: event.organization.slug,
					event_id: event.id
				})}
				class="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<Mail class="h-4 w-4" aria-hidden="true" />
				{m['eventActionSidebar.manageInvitations']()}
			</a>
			<button
				type="button"
				onclick={() => (announcementModalOpen = true)}
				class="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<Megaphone class="h-4 w-4" aria-hidden="true" />
				{m['eventActions.announcement']()}
			</button>
		</div>
	</div>
{/if}

<!-- Announcement Modal -->
{#if canManageEvent && event.organization}
	<AnnouncementModal
		open={announcementModalOpen}
		announcement={null}
		organizationSlug={event.organization.slug}
		preSelectedEventId={event.id}
		events={eventsList}
		{eventsLoading}
		{includePastEvents}
		tiers={tiersList}
		onClose={() => (announcementModalOpen = false)}
		onSuccess={() => (announcementModalOpen = false)}
		onIncludePastChange={(includePast) => {
			includePastEvents = includePast;
		}}
	/>
{/if}
