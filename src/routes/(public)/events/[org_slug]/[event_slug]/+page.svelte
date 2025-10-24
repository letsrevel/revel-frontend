<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { eventTicketCheckout } from '$lib/api';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import EventHeader from '$lib/components/events/EventHeader.svelte';
	import EventDetails from '$lib/components/events/EventDetails.svelte';
	import EventActionSidebar from '$lib/components/events/EventActionSidebar.svelte';
	import OrganizationInfo from '$lib/components/events/OrganizationInfo.svelte';
	import PotluckSection from '$lib/components/events/PotluckSection.svelte';
	import EventResources from '$lib/components/events/EventResources.svelte';
	import TicketTierList from '$lib/components/tickets/TicketTierList.svelte';
	import MyTicket from '$lib/components/tickets/MyTicket.svelte';
	import TicketTierModal from '$lib/components/tickets/TicketTierModal.svelte';
	import MyTicketModal from '$lib/components/tickets/MyTicketModal.svelte';
	import { generateEventStructuredData, structuredDataToJsonLd } from '$lib/utils/structured-data';
	import { isRSVP, isTicket } from '$lib/utils/eligibility';
	import { getPotluckPermissions } from '$lib/utils/permissions';

	let { data }: { data: PageData } = $props();

	const queryClient = useQueryClient();

	// Create mutable copies for client-side updates
	let event = $state(data.event);
	let userStatus = $state(data.userStatus);
	let ticketTiers = $state<TierSchemaWithId[]>(data.ticketTiers as TierSchemaWithId[]);

	// Get structured data for SEO
	let structuredData = $derived(
		generateEventStructuredData(event, `${page.url.origin}${page.url.pathname}`)
	);
	let jsonLd = $derived(structuredDataToJsonLd(structuredData));

	// Check if user has RSVP'd (reactive to userStatus changes)
	let hasRSVPd = $derived.by(() => {
		if (!userStatus) return false;

		if (isRSVP(userStatus)) {
			return userStatus.status === 'yes';
		}

		if (isTicket(userStatus)) {
			return userStatus.status === 'active' || userStatus.status === 'checked_in';
		}

		return false;
	});

	// Compute permissions for potluck management
	let potluckPermissions = $derived(
		getPotluckPermissions(
			data.userPermissions,
			event.organization.id,
			event.id,
			event.potluck_open,
			hasRSVPd
		)
	);

	// Check if user has a ticket
	let userTicket = $derived.by(() => {
		if (!userStatus || !isTicket(userStatus)) return null;
		return userStatus;
	});

	// Modal states
	let showTicketTierModal = $state(false);
	let showMyTicketModal = $state(false);

	// Handle modals
	function openTicketTierModal() {
		showTicketTierModal = true;
	}

	function closeTicketTierModal() {
		showTicketTierModal = false;
	}

	function openMyTicketModal() {
		showMyTicketModal = true;
	}

	function closeMyTicketModal() {
		showMyTicketModal = false;
	}

	// Ticket claiming mutation
	let claimTicketMutation = createMutation(() => ({
		mutationFn: async (tierId: string) => {
			const response = await eventTicketCheckout({
				path: { event_id: event.id, tier_id: tierId }
			});
			return response.data;
		},
		onSuccess: (data) => {
			// Update userStatus with new ticket
			if (data && 'status' in data) {
				userStatus = data as any;
			}
			// Invalidate event status query
			queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });
		}
	}));

	async function handleClaimTicket(tierId: string) {
		claimTicketMutation.mutate(tierId);
	}
</script>

<svelte:head>
	<title>{event.name} | Revel</title>
	<meta
		name="description"
		content={event.description?.slice(0, 160) ||
			`Join ${event.name} organized by ${event.organization.name}`}
	/>

	<!-- Open Graph -->
	<meta property="og:type" content="event" />
	<meta property="og:title" content={event.name} />
	<meta property="og:description" content={event.description || `Join ${event.name}`} />
	{#if event.cover_art}
		<meta property="og:image" content={event.cover_art} />
	{/if}
	<meta property="og:url" content={page.url.href} />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={event.name} />
	<meta
		name="twitter:description"
		content={event.description?.slice(0, 200) || `Join ${event.name}`}
	/>
	{#if event.cover_art}
		<meta name="twitter:image" content={event.cover_art} />
	{/if}

	<!-- Structured Data (JSON-LD) -->
	{@html `<script type="application/ld+json">${jsonLd}<\/script>`}
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Event Header -->
	<EventHeader {event} class="mb-8" />

	<!-- Main Content -->
	<div class="container mx-auto px-6 pb-16 md:px-8">
		<!-- Mobile Action Card (at top, prominent) -->
		<div class="mb-8 lg:hidden">
			<EventActionSidebar
				{event}
				bind:userStatus
				isAuthenticated={data.isAuthenticated}
				variant="card"
				onGetTicketsClick={openTicketTierModal}
				onShowTicketClick={openMyTicketModal}
			/>
		</div>

		<div class="grid gap-8 lg:grid-cols-3">
			<!-- Left Column: Event Details -->
			<div class="space-y-8 lg:col-span-2">
				<EventDetails {event} />

				<!-- My Ticket (if user has a ticket) -->
				{#if userTicket}
					<MyTicket
						ticket={userTicket}
						eventName={event.name}
						eventDate={event.start_datetime
							? new Date(event.start_datetime).toLocaleString()
							: undefined}
						eventLocation={event.location}
					/>
				{/if}

				<!-- Ticket Tiers (if event requires tickets and user doesn't have one) -->
				{#if event.requires_ticket && !userTicket && ticketTiers.length > 0}
					<TicketTierList
						tiers={ticketTiers}
						isAuthenticated={data.isAuthenticated}
						hasTicket={!!userTicket}
						onClaimTicket={handleClaimTicket}
					/>
				{/if}

				<!-- Potluck Section -->
				<!-- Always show if items exist, controlled by the section itself -->
				<PotluckSection
					{event}
					permissions={potluckPermissions}
					isAuthenticated={data.isAuthenticated}
					{hasRSVPd}
					initialItems={data.potluckItems}
				/>

				<!-- Resources Section -->
				<EventResources resources={data.resources} />

				<!-- Organization Info (below details on mobile, hidden on desktop) -->
				<div class="lg:hidden">
					<OrganizationInfo organization={event.organization} />
				</div>
			</div>

			<!-- Right Column: Action Sidebar (desktop only, sticky) -->
			<aside class="hidden lg:col-span-1 lg:block">
				<div class="space-y-6">
					<EventActionSidebar
						{event}
						bind:userStatus
						isAuthenticated={data.isAuthenticated}
						variant="sidebar"
						onGetTicketsClick={openTicketTierModal}
						onShowTicketClick={openMyTicketModal}
					/>

					<!-- Organization Info (desktop only) -->
					<OrganizationInfo organization={event.organization} />
				</div>
			</aside>
		</div>
	</div>
</div>

<!-- Ticket Tier Selection Modal -->
<TicketTierModal
	bind:open={showTicketTierModal}
	tiers={ticketTiers}
	isAuthenticated={data.isAuthenticated}
	hasTicket={!!userTicket}
	onClose={closeTicketTierModal}
	onClaimTicket={handleClaimTicket}
/>

<!-- My Ticket Modal -->
{#if userTicket}
	<MyTicketModal
		bind:open={showMyTicketModal}
		ticket={userTicket}
		eventName={event.name}
		eventDate={event.start_datetime ? new Date(event.start_datetime).toLocaleString() : undefined}
		eventLocation={event.location}
		onClose={closeMyTicketModal}
	/>
{/if}
