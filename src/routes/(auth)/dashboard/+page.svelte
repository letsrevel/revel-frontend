<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		dashboardDashboardEvents,
		dashboardDashboardOrganizations,
		eventListEvents
	} from '$lib/api/generated/sdk.gen';
	import { EventCard } from '$lib/components/events';
	import { getImageUrl } from '$lib/utils/url';
	import { Calendar, Building2, ChevronRight, Shield, Sparkles, Filter } from 'lucide-svelte';

	let user = $derived(authStore.user);
	let accessToken = $derived(authStore.accessToken);
	let permissions = $derived(authStore.permissions);

	// Get user's first name or preferred name
	let firstName = $derived(user?.preferred_name || user?.first_name || 'there');

	// Filter presets
	const filterPresets = [
		{
			label: 'All',
			filters: {
				owner: true,
				staff: true,
				member: true,
				rsvp_yes: true,
				rsvp_maybe: true,
				got_ticket: true,
				got_invitation: true,
				subscriber: true
			}
		},
		{
			label: 'Organizing',
			filters: {
				owner: true,
				staff: true,
				member: false,
				rsvp_yes: false,
				rsvp_maybe: false,
				got_ticket: false,
				got_invitation: false,
				subscriber: false
			}
		},
		{
			label: 'Attending',
			filters: {
				owner: false,
				staff: false,
				member: false,
				rsvp_yes: true,
				rsvp_maybe: true,
				got_ticket: true,
				got_invitation: false,
				subscriber: false
			}
		},
		{
			label: 'Invited',
			filters: {
				owner: false,
				staff: false,
				member: false,
				rsvp_yes: false,
				rsvp_maybe: false,
				got_ticket: false,
				got_invitation: true,
				subscriber: false
			}
		}
	];

	// Your Events filter state (default to "All")
	let yourEventsFilters = $state({ ...filterPresets[0].filters });

	// Check if there are ANY events (with default "All" filter) to determine section visibility
	const hasAnyEventsQuery = createQuery(() => ({
		queryKey: ['dashboard-has-events'],
		queryFn: async () => {
			if (!accessToken) return false;

			const response = await dashboardDashboardEvents({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					...filterPresets[0].filters, // Use "All" filter
					page_size: 1 // Only need to know if at least 1 exists
				}
			});

			return (response.data?.results || []).length > 0;
		},
		enabled: !!accessToken
	}));

	// Fetch "Your Events" with active filters
	const yourEventsQuery = createQuery(() => ({
		queryKey: ['dashboard-your-events', yourEventsFilters],
		queryFn: async () => {
			if (!accessToken) return [];

			const response = await dashboardDashboardEvents({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					...yourEventsFilters,
					page_size: 10
				}
			});

			return response.data?.results || [];
		},
		enabled: !!accessToken
	}));

	// Fetch user's organizations (owner/staff/member)
	const organizationsQuery = createQuery(() => ({
		queryKey: ['dashboard-organizations'],
		queryFn: async () => {
			if (!accessToken) return [];

			const response = await dashboardDashboardOrganizations({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					owner: true,
					staff: true,
					member: true,
					page_size: 50
				}
			});

			return response.data?.results || [];
		},
		enabled: !!accessToken
	}));

	// Fetch upcoming public events (from general endpoint)
	const upcomingEventsQuery = createQuery(() => ({
		queryKey: ['upcoming-events'],
		queryFn: async () => {
			const response = await eventListEvents({
				query: {
					page_size: 6
				}
			});

			return response.data?.results || [];
		},
		enabled: true
	}));

	let yourEvents = $derived(yourEventsQuery.data || []);
	let organizations = $derived(organizationsQuery.data || []);
	let upcomingEvents = $derived(upcomingEventsQuery.data || []);
	let hasAnyEvents = $derived(hasAnyEventsQuery.data || false);

	// Check if user can organize events (is owner/staff of at least one org)
	let canOrganizeEvents = $derived(() => {
		if (!permissions?.organization_permissions) return false;

		// Check if user is owner or has organizing permissions for any org
		return Object.values(permissions.organization_permissions).some((orgPerms) => {
			// If owner, they can organize
			if (orgPerms === 'owner') return true;

			// Check if they have event creation/management permissions
			if (typeof orgPerms === 'object' && orgPerms.default) {
				const perms = orgPerms.default;
				return !!(perms.create_event || perms.manage_event);
			}

			return false;
		});
	});

	// Helper to check if user has admin permissions for an organization
	function hasAdminPermissions(orgId: string): boolean {
		if (!permissions?.organization_permissions) {
			return false;
		}

		const orgPerms = permissions.organization_permissions[orgId];

		// If user is owner, they have all permissions
		if (orgPerms === 'owner') {
			return true;
		}

		// Check if user has any admin-level permissions
		if (typeof orgPerms === 'object' && orgPerms.default) {
			const perms = orgPerms.default;
			return !!(
				perms.edit_organization ||
				perms.manage_members ||
				perms.create_event ||
				perms.manage_event
			);
		}

		return false;
	}

	// Helper to check if a filter preset is currently active
	function isFilterActive(preset: (typeof filterPresets)[0]): boolean {
		return JSON.stringify(yourEventsFilters) === JSON.stringify(preset.filters);
	}

	// Scroll to organizations section
	function scrollToOrganizations() {
		const element = document.getElementById('organizations-section');
		element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// Apply filter preset
	function applyFilterPreset(preset: (typeof filterPresets)[0]) {
		yourEventsFilters = { ...preset.filters };
	}
</script>

<div class="container mx-auto px-4 py-6 md:py-8">
	<!-- Welcome Header -->
	<div class="mb-8">
		<h1 class="mb-2 text-2xl font-bold md:text-3xl">Welcome back, {firstName}!</h1>
		<p class="text-muted-foreground">Here's what's happening with your events and organizations</p>
	</div>

	<!-- Quick Action Bar -->
	<div class="mb-8 flex flex-wrap gap-3">
		<a
			href="/events"
			class="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		>
			<Sparkles class="h-4 w-4" aria-hidden="true" />
			<span>Browse Events</span>
		</a>

		{#if organizations.length > 0}
			<button
				type="button"
				onclick={scrollToOrganizations}
				class="inline-flex items-center gap-2 rounded-lg border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				<Building2 class="h-4 w-4" aria-hidden="true" />
				<span>My Organizations</span>
			</button>
		{/if}

		{#if organizations.filter((org) => hasAdminPermissions(org.id)).length === 1}
			<!-- Single admin org - direct link -->
			<a
				href="/org/{organizations.find((org) => hasAdminPermissions(org.id))?.slug}/admin"
				class="inline-flex items-center gap-2 rounded-lg border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				<Shield class="h-4 w-4" aria-hidden="true" />
				<span>Admin</span>
			</a>
		{:else if organizations.filter((org) => hasAdminPermissions(org.id)).length > 1}
			<!-- Multiple admin orgs - scroll to organizations section to choose -->
			<button
				type="button"
				onclick={scrollToOrganizations}
				class="inline-flex items-center gap-2 rounded-lg border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				<Shield class="h-4 w-4" aria-hidden="true" />
				<span>Admin</span>
			</button>
		{/if}
	</div>

	<!-- Main Content Grid -->
	<div class="space-y-8">
		<!-- Your Events Section (with filters) - Show if user has ANY events -->
		{#if hasAnyEvents}
			<section aria-labelledby="your-events-heading">
				<div class="mb-4">
					<div class="mb-3 flex items-center justify-between">
						<h2 id="your-events-heading" class="flex items-center gap-2 text-xl font-semibold">
							<Calendar class="h-5 w-5 text-primary" aria-hidden="true" />
							<span>Your Events</span>
							{#if yourEvents.length > 0}
								<span
									class="inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
								>
									{yourEvents.length}
								</span>
							{/if}
						</h2>
					</div>

					<!-- Filter Bar -->
					<div class="flex flex-wrap items-center gap-2">
						<Filter class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
						{#each filterPresets as preset}
							<!-- Only show "Organizing" filter if user can organize events -->
							{#if preset.label !== 'Organizing' || canOrganizeEvents()}
								<button
									type="button"
									onclick={() => applyFilterPreset(preset)}
									class="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring {isFilterActive(
										preset
									)
										? 'bg-primary text-primary-foreground hover:bg-primary/90'
										: 'bg-background hover:bg-accent hover:text-accent-foreground'}"
								>
									{preset.label}
								</button>
							{/if}
						{/each}
					</div>
				</div>

				{#if yourEvents.length > 0}
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{#each yourEvents.slice(0, 6) as event}
							<EventCard {event} />
						{/each}
					</div>
				{:else}
					<!-- Empty state when filter returns no results -->
					<div class="rounded-lg border bg-card p-8 text-center">
						<Calendar class="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
						<h3 class="mb-2 text-lg font-semibold">No events found</h3>
						<p class="mb-4 text-sm text-muted-foreground">
							Try adjusting your filter to see more events
						</p>
					</div>
				{/if}
			</section>
		{/if}

		<!-- Upcoming Events Section -->
		<section aria-labelledby="upcoming-events-heading">
			<div class="mb-4 flex items-center justify-between">
				<h2 id="upcoming-events-heading" class="flex items-center gap-2 text-xl font-semibold">
					<Sparkles class="h-5 w-5 text-primary" aria-hidden="true" />
					<span>Discover Events</span>
				</h2>
				{#if upcomingEvents.length > 0}
					<a
						href="/events"
						class="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
					>
						<span>See all</span>
						<ChevronRight class="h-4 w-4" aria-hidden="true" />
					</a>
				{/if}
			</div>

			{#if upcomingEventsQuery.isLoading}
				<div class="rounded-lg border bg-card p-8 text-center">
					<p class="text-muted-foreground">Loading events...</p>
				</div>
			{:else if upcomingEvents.length === 0}
				<!-- Empty State -->
				<div class="rounded-lg border bg-card p-8 text-center">
					<Calendar class="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
					<h3 class="mb-2 text-lg font-semibold">No events available</h3>
					<p class="mb-4 text-sm text-muted-foreground">
						Check back soon for upcoming events in your area!
					</p>
				</div>
			{:else}
				<!-- Event Cards -->
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each upcomingEvents.slice(0, 6) as event}
						<EventCard {event} />
					{/each}
				</div>
			{/if}
		</section>

		<!-- My Organizations Section -->
		<section id="organizations-section" aria-labelledby="organizations-heading">
			<div class="mb-4 flex items-center justify-between">
				<h2 id="organizations-heading" class="flex items-center gap-2 text-xl font-semibold">
					<Building2 class="h-5 w-5 text-primary" aria-hidden="true" />
					<span>My Organizations</span>
				</h2>
			</div>

			{#if organizationsQuery.isLoading}
				<div class="rounded-lg border bg-card p-8 text-center">
					<p class="text-muted-foreground">Loading your organizations...</p>
				</div>
			{:else if organizations.length === 0}
				<!-- Empty State -->
				<div class="rounded-lg border bg-card p-8 text-center">
					<Building2 class="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
					<h3 class="mb-2 text-lg font-semibold">No organizations yet</h3>
					<p class="mb-4 text-sm text-muted-foreground">
						Organizations help you manage events and build your community.
					</p>
					<div class="flex flex-wrap justify-center gap-3">
						<a
							href="/events"
							class="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
						>
							<Sparkles class="h-4 w-4" aria-hidden="true" />
							<span>Discover Events</span>
						</a>
					</div>
				</div>
			{:else}
				<!-- Organization Cards -->
				<div class="space-y-3">
					{#each organizations.slice(0, 3) as org}
						<div
							class="flex items-center gap-4 rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
						>
							{#if org.logo}
								<img
									src={getImageUrl(org.logo)}
									alt=""
									class="h-16 w-16 rounded-full border object-cover"
								/>
							{:else}
								<div class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
									<Building2 class="h-8 w-8 text-primary" aria-hidden="true" />
								</div>
							{/if}

							<div class="flex-1">
								<h3 class="font-semibold">{org.name}</h3>
								{#if org.description}
									<p class="line-clamp-1 text-sm text-muted-foreground">
										{org.description}
									</p>
								{/if}
							</div>

							<div class="flex gap-2">
								<a
									href="/org/{org.slug}"
									class="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
								>
									View Profile
								</a>
								{#if hasAdminPermissions(org.id)}
									<a
										href="/org/{org.slug}/admin"
										class="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
									>
										<Shield class="h-4 w-4" aria-hidden="true" />
										<span>Admin</span>
									</a>
								{/if}
							</div>
						</div>
					{/each}

					{#if organizations.length > 3}
						<a
							href="/dashboard/organizations"
							class="flex items-center justify-center gap-1 rounded-lg border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							<span>See all {organizations.length} organizations</span>
							<ChevronRight class="h-4 w-4" aria-hidden="true" />
						</a>
					{/if}
				</div>
			{/if}
		</section>
	</div>
</div>
