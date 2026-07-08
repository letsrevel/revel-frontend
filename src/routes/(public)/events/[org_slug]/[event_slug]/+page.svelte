<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import { useQueryClient } from '@tanstack/svelte-query';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import EventHeader from '$lib/components/events/EventHeader.svelte';
	import EventDetails from '$lib/components/events/EventDetails.svelte';
	import EventActionSidebar from '$lib/components/events/EventActionSidebar.svelte';
	import ActiveOfferBanner from '$lib/components/events/waitlist/ActiveOfferBanner.svelte';
	import OrganizationInfo from '$lib/components/events/OrganizationInfo.svelte';
	import PotluckSection from '$lib/components/events/PotluckSection.svelte';
	import DietarySummary from '$lib/components/events/DietarySummary.svelte';
	import EventResources from '$lib/components/events/EventResources.svelte';
	import EventSchedule from '$lib/components/events/EventSchedule.svelte';
	import EventAnnouncements from '$lib/components/announcements/EventAnnouncements.svelte';
	import EventGuestSignInPrompt from '$lib/components/events/EventGuestSignInPrompt.svelte';
	import AttendeeList from '$lib/components/events/AttendeeList.svelte';
	import TicketTierList from '$lib/components/tickets/TicketTierList.svelte';
	import MyTicket from '$lib/components/tickets/MyTicket.svelte';
	import TicketTierModal from '$lib/components/tickets/TicketTierModal.svelte';
	import MyTicketModal from '$lib/components/tickets/MyTicketModal.svelte';
	import GuestRsvpDialog from '$lib/components/events/GuestRsvpDialog.svelte';
	import GuestTicketDialog from '$lib/components/events/GuestTicketDialog.svelte';
	import EventConfirmationBanners from '$lib/components/events/EventConfirmationBanners.svelte';
	import { createCheckoutController } from '$lib/components/events/event-checkout-controller.svelte';
	import { SeoHead } from '$lib/seo';
	import {
		isRSVP,
		isTicket,
		isEligibility,
		isUserStatusResponse,
		hasActiveTickets,
		hasPositiveRsvp,
		hasActiveWaitlistOffer,
		getActiveTickets,
		type EventTicketSchemaActual
	} from '$lib/utils/eligibility';
	import type { TierRemainingTicketsSchema } from '$lib/api/generated/types.gen';
	import { getPotluckPermissions } from '$lib/utils/permissions';
	import { formatEventLocation } from '$lib/utils/event';
	import { formatDateTime } from '$lib/utils/date';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';

	const { data }: { data: PageData } = $props();

	// Server-side logging for staging diagnostics
	if (typeof window === 'undefined') {
		console.log('[EVENT PAGE SSR] Component initializing', {
			hasEvent: !!data.event,
			eventId: data.event?.id,
			eventName: data.event?.name,
			hasStart: !!data.event?.start,
			hasEnd: !!data.event?.end,
			hasTokenDetails: !!data.eventTokenDetails,
			isAuthenticated: data.isAuthenticated,
			resourcesCount: data.resources?.length || 0,
			ticketTiersCount: data.ticketTiers?.length || 0
		});
	}

	const queryClient = useQueryClient();

	// Create mutable copies for client-side updates
	const event = $state(data.event);
	let userStatus = $state(data.userStatus);
	const ticketTiers = $state<TierSchemaWithId[]>(data.ticketTiers as TierSchemaWithId[]);

	// Check if user has RSVP'd or has tickets (reactive to userStatus changes)
	// Users with tickets should be able to claim potluck items
	const hasRSVPd = $derived.by(() => {
		if (!userStatus) return false;

		// New unified format: EventUserStatusResponse with tickets array and/or RSVP
		if (isUserStatusResponse(userStatus)) {
			// User has active tickets = can claim potluck items
			if (hasActiveTickets(userStatus)) return true;
			// User has positive RSVP = can claim potluck items
			if (hasPositiveRsvp(userStatus)) return true;
			return false;
		}

		// Legacy format: Single RSVP
		if (isRSVP(userStatus)) {
			return userStatus.status === 'yes';
		}

		// Legacy format: Single Ticket
		if (isTicket(userStatus)) {
			return userStatus.status === 'active' || userStatus.status === 'checked_in';
		}

		return false;
	});

	// Compute permissions for potluck management
	const potluckPermissions = $derived(
		getPotluckPermissions(
			data.userPermissions,
			event.organization.id,
			event.id,
			event.potluck_open,
			hasRSVPd
		)
	);

	// Get user's tickets (handles both new and legacy formats)
	const userTickets = $derived.by((): EventTicketSchemaActual[] => {
		if (!userStatus) return [];

		// New format: EventUserStatusResponse with tickets array
		if (isUserStatusResponse(userStatus)) {
			return getActiveTickets(userStatus);
		}

		// Legacy format: single ticket
		if (isTicket(userStatus)) {
			return userStatus.status !== 'cancelled' ? [userStatus] : [];
		}

		return [];
	});

	// First user ticket (for backward compatibility)
	const userTicket = $derived(userTickets.length > 0 ? userTickets[0] : null);

	// Get per-tier remaining tickets info for the user
	// Only show user-specific remaining info if they can actually purchase more
	const tierRemainingTickets = $derived.by((): TierRemainingTicketsSchema[] | undefined => {
		if (!userStatus) return undefined;
		if (isUserStatusResponse(userStatus)) {
			// If user can't purchase more (eligibility check failed), don't show per-user limits
			// The remaining_tickets data may be inaccurate in this case
			if (userStatus.can_purchase_more === false) return undefined;
			return userStatus.remaining_tickets;
		}
		return undefined;
	});

	// Get user's display name for ticket purchase forms
	const userDisplayName = $derived(authStore.user?.display_name ?? '');

	// Active waitlist offer (eligibility-shaped userStatus with allowed=true + expiry)
	const activeOfferExpiresAt = $derived.by((): string | null => {
		if (!userStatus) return null;
		if (!isEligibility(userStatus)) return null;
		if (!hasActiveWaitlistOffer(userStatus)) return null;
		return userStatus.active_offer_expires_at ?? null;
	});

	// Discount code from URL param
	let initialDiscountCode = $state('');

	// Modal states
	let showTicketTierModal = $state(false);
	let showMyTicketModal = $state(false);
	let showGuestRsvpDialog = $state(false);
	let showGuestTicketDialog = $state(false);
	let selectedTierForGuest = $state<TierSchemaWithId | null>(null);
	let preSelectedTier = $state<TierSchemaWithId | null>(null);

	// Handle modals
	function openTicketTierModal() {
		showTicketTierModal = true;
	}

	function closeTicketTierModal() {
		showTicketTierModal = false;
		preSelectedTier = null;
	}

	function openMyTicketModal() {
		showMyTicketModal = true;
	}

	function handleSelectTier(tier: TierSchemaWithId) {
		preSelectedTier = tier;
		showTicketTierModal = true;
	}

	// Guest dialog handlers
	function openGuestRsvpDialog() {
		showGuestRsvpDialog = true;
	}

	function closeGuestRsvpDialog() {
		showGuestRsvpDialog = false;
	}

	function openGuestTicketDialog(tier?: TierSchemaWithId) {
		if (tier) {
			selectedTierForGuest = tier;
		}
		showGuestTicketDialog = true;
	}

	function closeGuestTicketDialog() {
		showGuestTicketDialog = false;
		selectedTierForGuest = null;
	}

	async function handleGuestAttendanceSuccess() {
		// Refresh user status to update local state
		await refreshUserStatus();
		// Also invalidate TanStack Query cache
		queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });
	}

	// Ticket checkout controller — owns purchase/resume/cancel mutations and side effects.
	const {
		refreshUserStatus,
		resumePaymentMutation,
		cancelReservationMutation,
		handleClaimTicket,
		handleCheckout,
		handleResumePayment,
		handleResumePaymentFromSidebar,
		handleCancelReservation
	} = createCheckoutController({
		eventId: event.id,
		queryClient,
		getUserTickets: () => userTickets,
		getUserDisplayName: () => userDisplayName,
		setUserStatus: (status) => {
			userStatus = status;
		},
		onCloseTicketTierModal: closeTicketTierModal,
		setShowMyTicketModal: (open) => {
			showMyTicketModal = open;
		}
	});

	// Handle payment success/cancelled redirects
	let paymentSuccess = $state(false);
	let paymentCancelled = $state(false);

	// Handle guest confirmation redirects
	let rsvpConfirmed = $state<string | null>(null); // 'yes' | 'no' | 'maybe'
	let ticketConfirmed = $state(false);

	onMount(() => {
		if (browser) {
			const urlParams = new URLSearchParams(window.location.search);

			// Check for payment success
			if (urlParams.get('payment_success') === 'true') {
				paymentSuccess = true;
				// Remove parameter from URL
				const cleanUrl = window.location.pathname;
				window.history.replaceState({}, '', cleanUrl);

				// Refresh event status to get the ticket
				queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });

				// Auto-open ticket modal after a delay
				setTimeout(() => {
					if (userTicket) {
						openMyTicketModal();
					}
				}, 1000);
			}

			// Check for payment cancelled
			if (urlParams.get('payment_cancelled') === 'true') {
				paymentCancelled = true;
				// Remove parameter from URL
				const cleanUrl = window.location.pathname;
				window.history.replaceState({}, '', cleanUrl);
			}

			// Check for RSVP confirmation
			const rsvpParam = urlParams.get('rsvp');
			if (rsvpParam && ['yes', 'no', 'maybe'].includes(rsvpParam)) {
				rsvpConfirmed = rsvpParam;
				// Remove parameter from URL
				const cleanUrl = window.location.pathname;
				window.history.replaceState({}, '', cleanUrl);

				// Refresh event status
				queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });
			}

			// Check for ticket confirmation
			if (urlParams.get('ticket_id')) {
				ticketConfirmed = true;
				// Remove parameter from URL
				const cleanUrl = window.location.pathname;
				window.history.replaceState({}, '', cleanUrl);

				// Refresh event status to get the ticket
				queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });

				// Auto-open ticket modal after a delay
				setTimeout(() => {
					if (userTicket) {
						openMyTicketModal();
					}
				}, 1000);
			}

			// Check for discount code
			const discountParam = urlParams.get('discount');
			if (discountParam) {
				initialDiscountCode = discountParam.toUpperCase();
				// Remove parameter from URL
				const cleanUrl = window.location.pathname;
				window.history.replaceState({}, '', cleanUrl);
			}
		}
	});
</script>

<SeoHead config={data.seo} />

<div class="min-h-screen bg-background">
	<!-- Post-redirect confirmation banners (payment / RSVP / ticket) -->
	<EventConfirmationBanners {paymentSuccess} {paymentCancelled} {rsvpConfirmed} {ticketConfirmed} />

	<!-- Active Waitlist Offer Banner (highest priority — surfaces above hero) -->
	{#if activeOfferExpiresAt}
		<div class="container mx-auto px-6 pt-4 md:px-8">
			<ActiveOfferBanner expiresAt={activeOfferExpiresAt} eventName={event.name} />
		</div>
	{/if}

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
				userPermissions={data.userPermissions}
				eventTokenDetails={data.eventTokenDetails}
				variant="card"
				canAttendWithoutLogin={event.can_attend_without_login}
				onGetTicketsClick={openTicketTierModal}
				onShowTicketClick={openMyTicketModal}
				onResumePayment={handleResumePaymentFromSidebar}
				isResumingPayment={resumePaymentMutation.isPending}
				onGuestRsvpClick={openGuestRsvpDialog}
				onInvitationRequestSuccess={refreshUserStatus}
				onWhitelistRequestSuccess={refreshUserStatus}
			/>
		</div>

		<div class="grid gap-8 lg:grid-cols-3">
			<!-- Left Column: Event Details -->
			<div class="space-y-8 lg:col-span-2">
				<EventDetails {event} />

				{#if data.isAuthenticated}
					<!-- Announcements Section (high visibility, directly under details) -->
					<EventAnnouncements eventId={event.id} />

					<!-- Potluck Coordination Section -->
					<!-- Show if potluck is open OR if there are existing items -->
					{#if event.potluck_open || data.potluckItems.length > 0}
						<div class="space-y-6">
							<!-- Dietary Summary -->
							<DietarySummary
								eventId={event.id}
								authToken={authStore.accessToken}
								isAuthenticated={data.isAuthenticated}
							/>

							<!-- Potluck Items -->
							<PotluckSection
								{event}
								permissions={potluckPermissions}
								isAuthenticated={data.isAuthenticated}
								{hasRSVPd}
								initialItems={data.potluckItems}
							/>
						</div>
					{/if}
				{:else}
					<!-- Consolidated sign-in prompt covering all auth-gated sections -->
					<EventGuestSignInPrompt {event} />
				{/if}

				<!-- My Ticket (if user has a ticket) -->
				{#if userTicket}
					<MyTicket
						ticket={userTicket}
						eventName={event.name}
						eventDate={event.start ? formatDateTime(event.start) : undefined}
						eventLocation={formatEventLocation(event)}
						onResumePayment={handleResumePaymentFromSidebar}
						isResumingPayment={resumePaymentMutation.isPending}
						totalTickets={userTickets.length}
						onViewAllTickets={openMyTicketModal}
					/>
				{/if}

				<!-- Ticket Tiers (if event requires tickets and user doesn't have one) -->
				{#if event.requires_ticket && !userTicket && ticketTiers.length > 0}
					<TicketTierList
						tiers={ticketTiers}
						isAuthenticated={data.isAuthenticated}
						hasTicket={!!userTicket}
						{userStatus}
						eventId={event.id}
						eventSlug={event.slug}
						organizationSlug={event.organization.slug}
						eventName={event.name}
						eventTokenDetails={data.eventTokenDetails}
						canAttendWithoutLogin={event.can_attend_without_login}
						{tierRemainingTickets}
						timezone={event.timezone}
						onSelectTier={handleSelectTier}
						onGuestTierClick={openGuestTicketDialog}
					/>
				{/if}

				<!-- Schedule / Timeline Section -->
				<EventSchedule
					schedule={event.schedule}
					eventStart={event.start}
					timezone={event.timezone}
					place={event.city?.name}
				/>

				<!-- Resources Section -->
				<EventResources resources={data.resources} />

				<!-- Organization Info (below details on mobile, hidden on desktop) -->
				<div class="lg:hidden">
					<OrganizationInfo
						organization={event.organization}
						isAuthenticated={data.isAuthenticated}
						isMember={data.isMember}
						membershipTier={data.membershipTier}
						membershipStatus={data.membershipStatus}
						isOwner={data.isOwner}
						isStaff={data.isStaff}
					/>
				</div>

				<!-- Event Series (mobile only) -->
				{#if event.event_series}
					<section
						aria-labelledby="series-heading-mobile"
						class="rounded-lg border bg-card lg:hidden"
					>
						<div class="border-b p-4">
							<h2 id="series-heading-mobile" class="font-semibold">
								{m['eventDetails.series_heading']()}
							</h2>
						</div>
						<a
							href={resolve('/(public)/events/[org_slug]/series/[series_slug]', {
								org_slug: event.organization.slug,
								series_slug: event.event_series.slug
							})}
							class="block p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							<div class="font-medium">{event.event_series.name}</div>
							{#if event.event_series.description}
								<p class="mt-1 text-sm text-muted-foreground">
									{event.event_series.description}
								</p>
							{/if}
						</a>
					</section>
				{/if}

				<!-- Attendee List (mobile only) -->
				<div class="lg:hidden">
					<AttendeeList
						eventId={event.id}
						totalAttendees={event.attendee_count}
						isAuthenticated={data.isAuthenticated}
						userVisibility={data.userVisibility}
						showPronounDistribution={event.public_pronoun_distribution ||
							data.isOwner ||
							data.isStaff}
					/>
				</div>
			</div>

			<!-- Right Column: Action Sidebar (desktop only) -->
			<aside class="hidden lg:col-span-1 lg:block">
				<div class="sticky top-4 space-y-6">
					<EventActionSidebar
						{event}
						bind:userStatus
						isAuthenticated={data.isAuthenticated}
						userPermissions={data.userPermissions}
						eventTokenDetails={data.eventTokenDetails}
						variant="card"
						canAttendWithoutLogin={event.can_attend_without_login}
						onGetTicketsClick={openTicketTierModal}
						onShowTicketClick={openMyTicketModal}
						onResumePayment={handleResumePaymentFromSidebar}
						isResumingPayment={resumePaymentMutation.isPending}
						onGuestRsvpClick={openGuestRsvpDialog}
						onInvitationRequestSuccess={refreshUserStatus}
						onWhitelistRequestSuccess={refreshUserStatus}
					/>

					<!-- Organization Info (desktop only) -->
					<OrganizationInfo
						organization={event.organization}
						isAuthenticated={data.isAuthenticated}
						isMember={data.isMember}
						membershipTier={data.membershipTier}
						membershipStatus={data.membershipStatus}
						isOwner={data.isOwner}
						isStaff={data.isStaff}
					/>

					<!-- Event Series (desktop only) -->
					{#if event.event_series}
						<section aria-labelledby="series-heading-desktop" class="rounded-lg border bg-card">
							<div class="border-b p-4">
								<h2 id="series-heading-desktop" class="font-semibold">
									{m['eventDetails.series_heading']()}
								</h2>
							</div>
							<a
								href={resolve('/(public)/events/[org_slug]/series/[series_slug]', {
									org_slug: event.organization.slug,
									series_slug: event.event_series.slug
								})}
								class="block p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								<div class="font-medium">{event.event_series.name}</div>
								{#if event.event_series.description}
									<p class="mt-1 text-sm text-muted-foreground">
										{event.event_series.description}
									</p>
								{/if}
							</a>
						</section>
					{/if}

					<!-- Attendee List (desktop only) -->
					<AttendeeList
						eventId={event.id}
						totalAttendees={event.attendee_count}
						isAuthenticated={data.isAuthenticated}
						userVisibility={data.userVisibility}
						showPronounDistribution={event.public_pronoun_distribution ||
							data.isOwner ||
							data.isStaff}
					/>
				</div>
			</aside>
		</div>

		<!-- Tags Section (bottom of page) -->
		{#if event.tags && event.tags.length > 0}
			<section aria-labelledby="tags-heading" class="container mx-auto border-t px-6 py-8 md:px-8">
				<h2 id="tags-heading" class="mb-4 text-xl font-semibold">
					{m['eventDetails.tags_heading']()}
				</h2>
				<div class="flex flex-wrap gap-2">
					{#each event.tags as tag (tag)}
						<span class="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
							{tag}
						</span>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>

<!-- Ticket Tier Selection Modal -->
<TicketTierModal
	bind:open={showTicketTierModal}
	tiers={ticketTiers}
	eventId={event.id}
	isAuthenticated={data.isAuthenticated}
	membershipTier={data.membershipTier}
	canAttendWithoutLogin={event.can_attend_without_login}
	{tierRemainingTickets}
	timezone={event.timezone}
	eventMaxTicketsPerUser={event.max_tickets_per_user}
	userName={userDisplayName}
	{preSelectedTier}
	{initialDiscountCode}
	onClose={closeTicketTierModal}
	onClaimTicket={handleClaimTicket}
	onCheckout={handleCheckout}
	onGuestTierClick={openGuestTicketDialog}
/>

<!-- My Ticket Modal -->
{#if userTickets.length > 0}
	<MyTicketModal
		bind:open={showMyTicketModal}
		tickets={userTickets}
		eventName={event.name}
		eventDate={event.start ? formatDateTime(event.start) : undefined}
		eventLocation={formatEventLocation(event)}
		onResumePayment={handleResumePayment}
		isResumingPayment={resumePaymentMutation.isPending}
		onCancelReservation={handleCancelReservation}
		isCancellingReservation={cancelReservationMutation.isPending}
		onTicketCancelled={async () => {
			showMyTicketModal = false;
			await refreshUserStatus();
			queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });
		}}
	/>
{/if}

<!-- Guest RSVP Dialog -->
{#if !data.isAuthenticated && event.can_attend_without_login && !event.requires_ticket}
	<GuestRsvpDialog
		bind:open={showGuestRsvpDialog}
		eventId={event.id}
		onClose={closeGuestRsvpDialog}
		onSuccess={handleGuestAttendanceSuccess}
	/>
{/if}

<!-- Guest Ticket Dialog -->
{#if !data.isAuthenticated && event.can_attend_without_login && event.requires_ticket && selectedTierForGuest}
	<GuestTicketDialog
		bind:open={showGuestTicketDialog}
		eventId={event.id}
		tier={selectedTierForGuest}
		eventMaxTicketsPerUser={event.max_tickets_per_user}
		onClose={closeGuestTicketDialog}
		onSuccess={handleGuestAttendanceSuccess}
	/>
{/if}
