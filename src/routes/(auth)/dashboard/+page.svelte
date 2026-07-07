<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		dashboardDashboardEvents,
		dashboardDashboardOrganizations,
		eventpublicdiscoveryListEvents,
		dashboardDashboardTickets,
		dashboardDashboardInvitations,
		dashboardDashboardRsvps,
		dashboardDashboardCalendar
	} from '$lib/api/generated/sdk.gen';
	import { EventCard } from '$lib/components/events';
	import { CalendarView, CalendarControls, EventModal } from '$lib/components/calendar';
	import {
		DashboardActivityCards,
		DashboardUpcomingEvents,
		DashboardOrganizationsSection
	} from '$lib/components/dashboard';
	import {
		filterPresets,
		isFilterActive as isFilterActiveFor,
		type DashboardFilterPreset
	} from '$lib/components/dashboard/dashboard-filters';
	import {
		canOrganizeEvents as userCanOrganizeEvents,
		hasAdminPermissions as userHasAdminPermissions,
		ownsOrganization as userOwnsOrganization
	} from '$lib/components/dashboard/dashboard-permissions';
	import { parseCalendarParams, getCurrentPeriod } from '$lib/utils/calendar';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import {
		Calendar,
		Building2,
		Shield,
		Sparkles,
		Filter,
		PlusCircle,
		List,
		Heart,
		Bookmark
	} from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';

	const user = $derived(authStore.user);
	const accessToken = $derived(authStore.accessToken);
	const permissions = $derived(authStore.permissions);
	const features = $derived($page.data.features);

	// Get user's first name or preferred name
	const firstName = $derived(user?.preferred_name || user?.first_name || 'there');

	// Your Events filter state (default to "All")
	let yourEventsFilters = $state({ ...filterPresets[0].filters });
	let ticketType = $state<'ticketed' | 'free' | undefined>(undefined);

	// View mode (list or calendar) for Your Events section
	const viewMode = $derived<'list' | 'calendar'>(
		($page.url.searchParams.get('viewMode') as 'list' | 'calendar') || 'list'
	);

	// Calendar state
	const calendarParams = $derived(parseCalendarParams($page.url.searchParams));
	let selectedEvent = $state<EventInListSchema | null>(null);

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
		queryKey: ['dashboard-your-events', yourEventsFilters, ticketType],
		queryFn: async () => {
			if (!accessToken) return [];

			const response = await dashboardDashboardEvents({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					...yourEventsFilters,
					requires_ticket:
						ticketType === 'ticketed' ? true : ticketType === 'free' ? false : undefined,
					page_size: 10
				}
			});

			return response.data?.results || [];
		},
		enabled: !!accessToken
	}));

	// Calendar data query for Your Events
	const calendarQuery = createQuery(() => ({
		queryKey: [
			'dashboard-calendar',
			calendarParams.view,
			calendarParams.year,
			calendarParams.month,
			calendarParams.week,
			yourEventsFilters,
			ticketType
		],
		queryFn: async () => {
			if (!accessToken) return [];

			const result = await dashboardDashboardCalendar({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					week: calendarParams.view === 'week' ? calendarParams.week : undefined,
					month: calendarParams.view === 'month' ? calendarParams.month : undefined,
					year: calendarParams.year,
					// Apply same filters as list view
					...yourEventsFilters,
					requires_ticket:
						ticketType === 'ticketed' ? true : ticketType === 'free' ? false : undefined
				}
			});

			if (result.error) {
				throw new Error('Failed to load calendar events');
			}

			return result.data || [];
		},
		enabled: !!accessToken && viewMode === 'calendar'
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
			const response = await eventpublicdiscoveryListEvents({
				query: {
					page_size: 6
				}
			});

			return response.data?.results || [];
		},
		enabled: true
	}));

	// Fetch active tickets count
	const activeTicketsQuery = createQuery(() => ({
		queryKey: ['dashboard-active-tickets-count'],
		queryFn: async () => {
			if (!accessToken) return 0;

			const response = await dashboardDashboardTickets({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					status: 'active' as const,
					page_size: 1
				}
			});

			return response.data?.count || 0;
		},
		enabled: !!accessToken
	}));

	// Fetch pending invitations count
	const pendingInvitationsQuery = createQuery(() => ({
		queryKey: ['dashboard-pending-invitations-count'],
		queryFn: async () => {
			if (!accessToken) return 0;

			const response = await dashboardDashboardInvitations({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					include_past: false,
					page_size: 1
				}
			});

			return response.data?.count || 0;
		},
		enabled: !!accessToken
	}));

	// Fetch upcoming RSVPs count (Going + Maybe — a tentative RSVP is the one
	// users are most likely to forget, so it must be surfaced too).
	const upcomingRsvpsQuery = createQuery(() => ({
		queryKey: ['dashboard-upcoming-rsvps-count'],
		queryFn: async () => {
			if (!accessToken) return 0;

			const response = await dashboardDashboardRsvps({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: {
					status: ['yes', 'maybe'],
					include_past: false,
					page_size: 1
				}
			});

			return response.data?.count || 0;
		},
		enabled: !!accessToken
	}));

	const yourEvents = $derived(yourEventsQuery.data || []);
	const organizations = $derived(organizationsQuery.data || []);
	const upcomingEvents = $derived(upcomingEventsQuery.data || []);
	const hasAnyEvents = $derived(hasAnyEventsQuery.data || false);
	const activeTicketsCount = $derived(activeTicketsQuery.data || 0);
	const pendingInvitationsCount = $derived(pendingInvitationsQuery.data || 0);
	const upcomingRsvpsCount = $derived(upcomingRsvpsQuery.data || 0);
	const calendarEvents = $derived(calendarQuery.data || []);
	const isCalendarLoading = $derived(calendarQuery.isLoading);

	// Permission helpers (pure logic in dashboard-permissions.ts) — thin wrappers
	// bind the live `permissions` object so template call sites stay unchanged.
	const canOrganizeEvents = $derived(() => userCanOrganizeEvents(permissions));
	const hasAdminPermissions = (orgId: string) => userHasAdminPermissions(permissions, orgId);
	const ownsOrganization = () => userOwnsOrganization(permissions);

	// Helper to check if a filter preset is currently active
	const isFilterActive = (preset: DashboardFilterPreset) =>
		isFilterActiveFor(yourEventsFilters, preset);

	// Scroll to organizations section
	function scrollToOrganizations() {
		const element = document.getElementById('organizations-section');
		element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// Apply filter preset
	function applyFilterPreset(preset: DashboardFilterPreset) {
		yourEventsFilters = { ...preset.filters };
	}

	// Toggle view mode
	function toggleViewMode() {
		const newMode = viewMode === 'list' ? 'calendar' : 'list';
		const url = new URL(window.location.href);
		url.searchParams.set('viewMode', newMode);

		// If switching to calendar, add default calendar params
		if (newMode === 'calendar' && !url.searchParams.has('view')) {
			const current = getCurrentPeriod();
			url.searchParams.set('view', 'month');
			url.searchParams.set('year', String(current.year));
			url.searchParams.set('month', String(current.month));
			url.searchParams.set('week', String(current.week));
		}

		// eslint-disable-next-line svelte/no-navigation-without-resolve -- target is derived from the live page URL (base path already applied); resolve() cannot express search params
		goto(url.toString(), { keepFocus: true, replaceState: false });
	}

	// Event modal handlers
	function handleEventClick(event: EventInListSchema) {
		selectedEvent = event;
	}

	function handleCloseEventModal() {
		selectedEvent = null;
	}
</script>

<div class="container mx-auto px-4 py-6 md:py-8">
	<!-- Welcome Header -->
	<div class="mb-8">
		<h1 class="mb-2 text-2xl font-bold md:text-3xl">{m['dashboard.pageTitle']({ firstName })}</h1>
		<p class="text-muted-foreground">{m['dashboard.pageSubtitle']()}</p>
	</div>

	<!-- Quick Action Bar -->
	<div class="mb-8 flex flex-wrap gap-3">
		<a
			href={resolve('/(public)/events', {})}
			class="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		>
			<Sparkles class="h-4 w-4" aria-hidden="true" />
			<span>{m['dashboard.browseEventsButton']()}</span>
		</a>

		{#if canOrganizeEvents()}
			{#if organizations.filter((org) => hasAdminPermissions(org.id)).length === 1}
				<!-- Single admin org - direct link to create event -->
				<a
					href={resolve('/(auth)/org/[slug]/admin/events/new', {
						slug: organizations.find((org) => hasAdminPermissions(org.id))?.slug ?? ''
					})}
					class="inline-flex items-center gap-2 rounded-lg border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<Calendar class="h-4 w-4" aria-hidden="true" />
					<span>{m['dashboard.createEventButton']()}</span>
				</a>
			{:else}
				<!-- Multiple admin orgs - scroll to organizations section to choose -->
				<button
					type="button"
					onclick={scrollToOrganizations}
					class="inline-flex items-center gap-2 rounded-lg border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<Calendar class="h-4 w-4" aria-hidden="true" />
					<span>{m['dashboard.createEventButton']()}</span>
				</button>
			{/if}
		{/if}

		{#if organizations.length > 0}
			<button
				type="button"
				onclick={scrollToOrganizations}
				class="inline-flex items-center gap-2 rounded-lg border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				<Building2 class="h-4 w-4" aria-hidden="true" />
				<span>{m['dashboard.myOrganizationsButton']()}</span>
			</button>
		{/if}

		<a
			href={resolve('/(auth)/dashboard/following', {})}
			class="inline-flex items-center gap-2 rounded-lg border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		>
			<Heart class="h-4 w-4" aria-hidden="true" />
			<span>{m['dashboard.following.title']()}</span>
		</a>

		{#if organizations.filter((org) => hasAdminPermissions(org.id)).length === 1}
			<!-- Single admin org - direct link -->
			<a
				href={resolve('/(auth)/org/[slug]/admin', {
					slug: organizations.find((org) => hasAdminPermissions(org.id))?.slug ?? ''
				})}
				class="inline-flex items-center gap-2 rounded-lg border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				<Shield class="h-4 w-4" aria-hidden="true" />
				<span>{m['dashboard.adminButton']()}</span>
			</a>
		{:else if organizations.filter((org) => hasAdminPermissions(org.id)).length > 1}
			<!-- Multiple admin orgs - scroll to organizations section to choose -->
			<button
				type="button"
				onclick={scrollToOrganizations}
				class="inline-flex items-center gap-2 rounded-lg border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				<Shield class="h-4 w-4" aria-hidden="true" />
				<span>{m['dashboard.adminButton']()}</span>
			</button>
		{:else if !ownsOrganization() && features.organization_creation}
			<!-- User doesn't own an organization - show "Create Organization" CTA -->
			<a
				href={resolve('/(auth)/create-org', {})}
				class="inline-flex items-center gap-2 rounded-lg border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				<PlusCircle class="h-4 w-4" aria-hidden="true" />
				<span>{m['dashboard.createOrganizationButton']()}</span>
			</a>
		{/if}
	</div>

	<!-- Activity Summary Cards -->
	<DashboardActivityCards {activeTicketsCount} {pendingInvitationsCount} {upcomingRsvpsCount} />

	<!-- Main Content Grid -->
	<div class="space-y-8">
		<!-- Your Events Section (with filters) - Show if user has ANY events -->
		{#if hasAnyEvents}
			<section aria-labelledby="your-events-heading">
				<div class="mb-4">
					<div class="mb-3 flex items-center justify-between">
						<h2 id="your-events-heading" class="flex items-center gap-2 text-xl font-semibold">
							<Calendar class="h-5 w-5 text-primary" aria-hidden="true" />
							<span>{m['dashboard.sections.yourEvents']()}</span>
							{#if viewMode === 'list' && yourEvents.length > 0}
								<span
									class="inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
								>
									{yourEvents.length}
								</span>
							{:else if viewMode === 'calendar' && calendarEvents.length > 0}
								<span
									class="inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
								>
									{calendarEvents.length}
								</span>
							{/if}
						</h2>

						<!-- View Toggle -->
						<button
							type="button"
							onclick={toggleViewMode}
							class="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							{#if viewMode === 'list'}
								<Calendar class="h-4 w-4" aria-hidden="true" />
								{m['calendar.calendar_view']()}
							{:else}
								<List class="h-4 w-4" aria-hidden="true" />
								{m['calendar.list_view']()}
							{/if}
						</button>
					</div>

					<!-- Filter Bar (only show in list view) -->
					{#if viewMode === 'list'}
						<div class="flex flex-wrap items-center gap-2">
							<Filter class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
							{#each filterPresets as preset (preset.labelKey)}
								<!-- Only show "Organizing" filter if user can organize events -->
								{#if preset.labelKey !== 'dashboard.filters.organizing' || canOrganizeEvents()}
									<button
										type="button"
										onclick={() => applyFilterPreset(preset)}
										class="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring {isFilterActive(
											preset
										)
											? 'bg-primary text-primary-foreground hover:bg-primary/90'
											: 'bg-background hover:bg-accent hover:text-accent-foreground'}"
									>
										{#if preset.labelKey === 'dashboard.filters.bookmarked'}
											<Bookmark class="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
										{/if}
										{(m as unknown as Record<string, () => string>)[preset.labelKey]()}
									</button>
								{/if}
							{/each}

							<!-- Ticket Type Toggle -->
							<span class="ml-1 text-muted-foreground">|</span>
							{#each [{ value: 'ticketed', label: m['filters.ticketType.ticketed']() }, { value: 'free', label: m['filters.ticketType.free']() }] as option (option.value)}
								{@const isSelected = ticketType === option.value}
								<button
									type="button"
									onclick={() =>
										(ticketType = isSelected ? undefined : (option.value as 'ticketed' | 'free'))}
									class="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring {isSelected
										? 'bg-primary text-primary-foreground hover:bg-primary/90'
										: 'bg-background hover:bg-accent hover:text-accent-foreground'}"
									aria-pressed={isSelected}
								>
									{option.label}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				{#if viewMode === 'list'}
					<!-- List View -->
					{#if yourEvents.length > 0}
						<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{#each yourEvents.slice(0, 6) as event (event.id)}
								<EventCard {event} />
							{/each}
						</div>
					{:else}
						<!-- Empty state when filter returns no results -->
						<div class="rounded-lg border bg-card p-8 text-center">
							<Calendar class="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
							<h3 class="mb-2 text-lg font-semibold">{m['dashboard.emptyStates.noEvents']()}</h3>
							<p class="mb-4 text-sm text-muted-foreground">
								{m['dashboard.emptyStates.noEventsFiltered']()}
							</p>
						</div>
					{/if}
				{:else}
					<!-- Calendar View -->
					<CalendarControls
						view={calendarParams.view}
						year={calendarParams.year}
						month={calendarParams.month}
						week={calendarParams.week}
						baseUrl="/dashboard"
						preserveParams={['viewMode']}
					/>

					<CalendarView
						view={calendarParams.view}
						year={calendarParams.year}
						month={calendarParams.month}
						week={calendarParams.week}
						events={calendarEvents}
						isLoading={isCalendarLoading}
						onEventClick={handleEventClick}
					/>
				{/if}
			</section>
		{/if}

		<!-- Upcoming Events Section -->
		<DashboardUpcomingEvents {upcomingEvents} isLoading={upcomingEventsQuery.isLoading} />

		<!-- My Organizations Section -->
		<DashboardOrganizationsSection
			{organizations}
			isLoading={organizationsQuery.isLoading}
			{permissions}
		/>
	</div>

	<!-- Event Modal (for calendar clicks) -->
	<EventModal event={selectedEvent} open={selectedEvent !== null} onClose={handleCloseEventModal} />
</div>
