<script lang="ts">
	import type { PageData } from './$types';
	import { useQueryClient } from '@tanstack/svelte-query';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import { resolveViewerVisibility } from '$lib/utils/event-visibility';
	import EventHeader from '$lib/components/events/EventHeader.svelte';
	import EventDetails from '$lib/components/events/EventDetails.svelte';
	import EventActionSidebar from '$lib/components/events/EventActionSidebar.svelte';
	import EventSeriesLinkCard from '$lib/components/events/EventSeriesLinkCard.svelte';
	import EventTagsSection from '$lib/components/events/EventTagsSection.svelte';
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
	import TicketTiersDialog from '$lib/components/tickets/TicketTiersDialog.svelte';
	import EventSeriesPassOffers from '$lib/components/series-passes/EventSeriesPassOffers.svelte';
	import MyTicket from '$lib/components/tickets/MyTicket.svelte';
	import EventPurchaseDialogs from '$lib/components/events/EventPurchaseDialogs.svelte';
	import { eventHasSeatingMap } from '$lib/components/events/venue-overview';
	import EventConfirmationBanners from '$lib/components/events/EventConfirmationBanners.svelte';
	import { createCheckoutController } from '$lib/components/events/event-checkout-controller.svelte';
	import { consumePostRedirectParams } from '$lib/components/events/post-redirect-params';
	import { SeoHead } from '$lib/seo';
	import {
		isTicket,
		isEligibility,
		isUserStatusResponse,
		hasActiveWaitlistOffer,
		getActiveTickets,
		hasAttendingSignal,
		type EventTicketSchemaActual
	} from '$lib/utils/eligibility';
	import type { TierRemainingTicketsSchema } from '$lib/api/generated/types.gen';
	import { getPotluckPermissions } from '$lib/utils/permissions';
	import { formatEventLocation } from '$lib/utils/event';
	import { getUserRealName } from '$lib/utils/user-display';
	import { formatEventDate } from '$lib/utils/date';
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { EventCart } from '$lib/components/tickets/cart.svelte';
	import { cartTotal, cartTotalArgs } from '$lib/components/tickets/checkout-total';
	import { discountApplicable } from '$lib/components/tickets/cart-discount';
	import CartSummaryBar from '$lib/components/tickets/CartSummaryBar.svelte';
	import CartSeatHolds from '$lib/components/tickets/CartSeatHolds.svelte';
	import { CartSeatHoldRegistry } from '$lib/components/tickets/cart-seat-registry.svelte';
	import SeatPickerDialog from '$lib/components/tickets/SeatPickerDialog.svelte';
	import CheckoutSheet from '$lib/components/tickets/CheckoutSheet.svelte';
	import CartEmailConfirmation from '$lib/components/tickets/CartEmailConfirmation.svelte';
	import { createCartPurchaseFlow } from '$lib/components/events/cart-purchase-flow.svelte';
	import * as cartBaHolds from '$lib/components/tickets/cart-ba-holds';
	import { readTierMapPref, writeTierMapPref } from '$lib/components/tickets/seat-view-toggle';
	import { toast } from 'svelte-sonner';

	const { data }: { data: PageData } = $props();

	const queryClient = useQueryClient();

	// Create mutable copies for client-side updates
	const event = $state(data.event);

	// What THIS viewer may see. Owners and staff bypass `visibility_settings`
	// server-side (#825) — the API serves them the real guest list and the real
	// capacity — so gating their UI on the public toggles would hide an
	// organizer's own event data from them.
	const viewerVisibility = $derived(
		resolveViewerVisibility(event.visibility_settings, {
			isOwner: data.isOwner,
			isStaff: data.isStaff
		})
	);
	let userStatus = $state(data.userStatus);
	const ticketTiers = $state<TierSchemaWithId[]>(data.ticketTiers as TierSchemaWithId[]);

	// Check if user has RSVP'd or has tickets (reactive to userStatus changes)
	// Users with tickets should be able to claim potluck items
	const hasRSVPd = $derived(hasAttendingSignal(userStatus));

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

	// Buy-more eligibility (#853 fix): same read as EventActionSidebar's canPurchaseMore.
	const canBuyMore = $derived(
		userStatus && isUserStatusResponse(userStatus) ? (userStatus.can_purchase_more ?? true) : true
	);

	// Stranded-cart guard, gated like the tier-list render below — `userTicket`
	// alone cleared on EVERY status refresh, wiping a legit buy-more cart (fix 3).
	$effect(() => {
		if (userTicket && !canBuyMore) cart.clear();
	});

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

	// Holder-name default for ticket purchase forms. Name fields only — the
	// backend's display_name bottoms out at username (= email), which must
	// never be written into guest_name (BE 8b12be6c).
	const ticketHolderDefaultName = $derived(authStore.user ? getUserRealName(authStore.user) : '');

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
	let showMyTicketModal = $state(false);
	let showGuestRsvpDialog = $state(false);
	let showVenueOverview = $state(false);
	// Seat-picker entry point: the tier being picked also gates SeatPickerDialog's
	// mount, so closing/hand-off unmounts it (destroying its transient controller).
	let pickSeatsTier = $state<TierSchemaWithId | null>(null);

	// Map-first entry point (#679): only when a purchasable tier sells a venue sector.
	const hasSeatingMap = $derived(eventHasSeatingMap(ticketTiers, tierRemainingTickets));

	function openMyTicketModal() {
		showMyTicketModal = true;
	}

	/** Scrolls the inline ticket-tier list into view (non-cart fallback). */
	function scrollToTicketTiers(): void {
		document.getElementById('ticket-tiers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// Sidebar "Get tickets" CTA → focused tiers dialog (hosts the same
	// TicketTierList snippet as the inline section). Scroll remains the
	// fallback for the no-cart case, where the dialog's footer has no cart
	// to read.
	let showTiersDialog = $state(false);

	function handleGetTicketsClick(): void {
		if (canUseCart) {
			showTiersDialog = true;
		} else {
			scrollToTicketTiers();
		}
	}

	/** Using the map button remembers the preference for this session (#679). */
	function openVenueOverview(): void {
		writeTierMapPref();
		showVenueOverview = true;
	}

	// Routes a tier picked outside the inline steppers into the cart: held
	// `user_choice` seats adopt straight into a group, unheld opens the picker,
	// everything else starts the group at quantity 1 and scrolls to it.
	function handleSelectTier(tier: TierSchemaWithId, heldSeatIds?: string[]): void {
		if (tier.seat_assignment_mode === 'user_choice') {
			if (heldSeatIds) {
				cart.setSeatIds(tier, heldSeatIds);
				// A join-block can leave the overview's held seats orphaned (#853 fix 4).
				const block = cartBaHolds.releaseJoinBlockedHolds(cart, tier, heldSeatIds, event.id);
				if (block) toast.error(cartBaHolds.joinBlockMessage(block));
			} else {
				pickSeatsTier = tier;
			}
			return;
		}
		if (cart.quantityFor(tier.id) === 0) cart.setQuantity(tier, 1);
		// Inside the tiers dialog the group is already on screen — scrolling
		// the page underneath would just disorient on dismiss.
		if (!showTiersDialog) scrollToTicketTiers();
	}

	// Guest dialog handlers
	function openGuestRsvpDialog() {
		showGuestRsvpDialog = true;
	}

	function closeGuestRsvpDialog() {
		showGuestRsvpDialog = false;
	}

	// SeatPickerDialog's `open` reads/writes through `pickSeatsTier` itself
	// (bind:open function form): the tier being non-null IS "open", so the
	// dialog fully unmounts on close instead of just hiding — its transient
	// controller is constructed fresh per picking session (see SeatPickerDialog).
	function handleSeatPickerOpenChange(open: boolean): void {
		if (!open) pickSeatsTier = null;
	}

	async function handleGuestAttendanceSuccess() {
		// Refresh user status to update local state
		await refreshUserStatus();
		// Also invalidate TanStack Query cache
		queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });
	}

	// Ticket checkout controller — pending-ticket resume/cancel only (purchasing is the cart below).
	const {
		refreshUserStatus,
		resumePaymentMutation,
		cancelReservationMutation,
		handleResumePayment,
		handleResumePaymentFromSidebar,
		handleCancelReservation
	} = createCheckoutController({
		eventId: event.id,
		queryClient,
		getUserTickets: () => userTickets,
		setUserStatus: (status) => {
			userStatus = status;
		},
		setShowMyTicketModal: (open) => {
			showMyTicketModal = open;
		}
	});

	// BE #902 populates event_remaining on BOTH my-status shapes (status AND
	// eligibility — the first-time-buyer case), so read it unconditionally.
	// Tolerant cast: deploy-order-free, and covers the legacy single-RSVP/ticket
	// shapes, which never carry it. null = no event-level cap.
	const eventRemaining = $derived.by((): number | null => {
		if (!userStatus) return null;
		return (userStatus as { event_remaining?: number | null }).event_remaining ?? null;
	});

	// Quick-buy cart (#853): wired into TicketTierList's per-tier steppers and
	// the sticky CartSummaryBar below. Available to guests too (#853 Task 5) —
	// see `canUseCart`.
	const cart = new EventCart({
		remainingFor: (tierId) => tierRemainingTickets?.find((t) => t.tier_id === tierId),
		eventRemaining: () => eventRemaining,
		eventMaxTicketsPerUser: () => event.max_tickets_per_user ?? null
	});

	// Cart-lifetime seat-hold ownership (#853 PR 3): one SeatHoldController per
	// seated group, registered here so the picker/sheet/confirm flow (later
	// tasks) can reuse them. Mounted below via <CartSeatHolds>.
	const seatHoldRegistry = new CartSeatHoldRegistry();

	// Seat ids the cart owns (own seatIds + all live holds) — the overview
	// must never adopt/release these (fix 1; PR 4 adds BA holds pre-confirm).
	const protectedSeatIds = $derived(
		new Set([...cart.groups.flatMap((group) => group.seatIds), ...seatHoldRegistry.allHolds()])
	);

	// Cart mount gate (#853 Task 5, widened from authed-only): a guest gets the
	// cart too, whenever the event both allows attending without login AND
	// actually requires a ticket (an RSVP-only event has no tiers to cart —
	// its guest path is `GuestRsvpDialog`, untouched here).
	const canUseCart = $derived(
		data.isAuthenticated || (event.can_attend_without_login && event.requires_ticket)
	);

	// Cart purchase orchestration (#853 Task 5): authed + guest checkout
	// controllers, the guest identity, the checkout sheet's open/error state,
	// and the confirm-time submit handlers — extracted to keep this file under
	// the length budget (plan ruling 10). See cart-purchase-flow.svelte.ts.
	const purchaseFlow = createCartPurchaseFlow({
		event,
		eventId: event.id,
		queryClient,
		isAuthenticated: data.isAuthenticated,
		cart,
		registry: seatHoldRegistry,
		getInitialDiscountCode: () => initialDiscountCode,
		getTicketHolderDefaultName: () => ticketHolderDefaultName,
		refreshUserStatus,
		setShowMyTicketModal: (open) => {
			showMyTicketModal = open;
		}
	});

	// Chart threaded from the registry (shared across every registered
	// controller for this event — see cart-seat-registry.svelte.ts): without
	// it a seated group's total is unresolvable, which blanks the WHOLE
	// cart's total (cartTotal returns null the moment ANY group is unknown).
	const cartTotalDisplay = $derived(
		cartTotal(
			cart.groups.map((group) => cartTotalArgs({ ...group, chart: seatHoldRegistry.chart }))
		)
	);

	// Handle payment success/cancelled redirects
	let paymentSuccess = $state(false);
	let paymentCancelled = $state(false);

	// Handle guest confirmation redirects
	let rsvpConfirmed = $state<string | null>(null); // 'yes' | 'no' | 'maybe'
	let ticketConfirmed = $state(false);

	onMount(() => {
		const params = consumePostRedirectParams();
		paymentSuccess = params.paymentSuccess;
		paymentCancelled = params.paymentCancelled;
		rsvpConfirmed = params.rsvpConfirmed;
		ticketConfirmed = params.ticketConfirmed;
		initialDiscountCode = params.discountCode;

		if (paymentSuccess || rsvpConfirmed || ticketConfirmed) {
			queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });
		}

		// Auto-open the ticket modal after a delay once the refreshed status
		// (queued above) has had a chance to land.
		if (paymentSuccess) {
			setTimeout(() => {
				if (userTicket) {
					openMyTicketModal();
				}
			}, 1000);
		}
		if (ticketConfirmed) {
			setTimeout(() => {
				if (userTicket) {
					openMyTicketModal();
				}
			}, 1000);
		}

		// Map-first entry point (#679): once chosen this session, land on it.
		if (hasSeatingMap && !userTicket && readTierMapPref()) {
			showVenueOverview = true;
		}
	});
</script>

{#snippet tierList(headingId: string)}
	<TicketTierList
		{headingId}
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
		capacityDisclosed={viewerVisibility.show_capacity}
		onSelectTier={handleSelectTier}
		onViewSeatingMap={hasSeatingMap ? openVenueOverview : undefined}
		cart={canUseCart ? cart : undefined}
		quickBuyDisabled={purchaseFlow.isProcessing}
		{eventRemaining}
		onPickSeats={canUseCart
			? (tier) => {
					pickSeatsTier = tier;
				}
			: undefined}
	/>
{/snippet}

{#snippet actionSidebar()}
	<EventActionSidebar
		{event}
		bind:userStatus
		isAuthenticated={data.isAuthenticated}
		userPermissions={data.userPermissions}
		eventTokenDetails={data.eventTokenDetails}
		variant="card"
		canAttendWithoutLogin={event.can_attend_without_login}
		onGetTicketsClick={handleGetTicketsClick}
		onShowTicketClick={openMyTicketModal}
		onResumePayment={handleResumePaymentFromSidebar}
		isResumingPayment={resumePaymentMutation.isPending}
		onGuestRsvpClick={openGuestRsvpDialog}
		onInvitationRequestSuccess={refreshUserStatus}
		onWhitelistRequestSuccess={refreshUserStatus}
	/>
{/snippet}

<SeoHead config={data.seo} />

<div class="min-h-screen bg-background" class:pb-24={!cart.isEmpty}>
	<!-- Post-redirect confirmation banners (payment / RSVP / ticket) -->
	<EventConfirmationBanners {paymentSuccess} {paymentCancelled} {rsvpConfirmed} {ticketConfirmed} />

	<!-- Active Waitlist Offer Banner (highest priority — surfaces above hero) -->
	{#if activeOfferExpiresAt}
		<div class="container mx-auto px-6 pt-4 md:px-8">
			<ActiveOfferBanner expiresAt={activeOfferExpiresAt} eventName={event.name} />
		</div>
	{/if}

	<!-- Event Header (cover → poster ribbon) -->
	<EventHeader {event} />

	<!--
		Tinted content panel (uplift prototype). The page body is no longer bare
		`--background`: it is a periwinkle wash, so every card below reads as a
		white sticker FLOATING on a colored surface rather than a rectangle on
		paper. Every text layer that lands directly on this panel (never inside a
		card) is covered by the "public page secondary wash" rows in
		COMPOSITED_PAIRS, so these figures are pasted from
		scripts/audit-brand-themes.py — never hand-computed:
		  light — secondary@55 over background ⇒ hsl(231 88% 90%);
		          foreground 12.36:1 · muted-foreground 6.43:1 · primary 4.97:1
		  dark  — secondary@28 over background ⇒ hsl(246 33% 15%);
		          foreground 15.68:1 · muted-foreground 7.44:1 · primary 6.30:1
		(`primary` is the SectionHeader kicker; `foreground` the section headings.)
	-->
	<div class="bg-secondary/55 pt-8 dark:bg-secondary/[0.28]">
		<div class="container mx-auto px-6 pb-16 md:px-8">
			<!-- Mobile Action Card (at top, prominent) -->
			<div class="mb-8 lg:hidden">
				{@render actionSidebar()}
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

					<!-- My Ticket (if user has a ticket). Its date uses formatEventDate in
					     the EVENT's timezone (#818): same shape as the ticket list and its
					     modal, and same clock time as the rest of this page. -->
					{#if userTicket}
						<MyTicket
							ticket={userTicket}
							eventName={event.name}
							eventDate={event.start ? formatEventDate(event.start, event.timezone) : undefined}
							eventLocation={formatEventLocation(event)}
							onResumePayment={handleResumePaymentFromSidebar}
							isResumingPayment={resumePaymentMutation.isPending}
							totalTickets={userTickets.length}
							onViewAllTickets={openMyTicketModal}
						/>
					{/if}

					<!-- Season passes covering this event (shown with the regular tickets) -->
					{#if event.event_series && event.requires_ticket && !userTicket}
						<EventSeriesPassOffers
							seriesId={event.event_series.id}
							orgSlug={event.organization.slug}
							seriesSlug={event.event_series.slug}
							isAuthenticated={data.isAuthenticated}
						/>
					{/if}

					<!-- Ticket Tiers: buy-more re-entry point (#853) — shows with no
					     ticket, or with one if the backend still allows more. -->
					{#if event.requires_ticket && ticketTiers.length > 0 && (!userTicket || canBuyMore)}
						{@render tierList('ticket-tiers')}
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
						<EventSeriesLinkCard
							series={event.event_series}
							orgSlug={event.organization.slug}
							headingId="series-heading-mobile"
							class="lg:hidden"
						/>
					{/if}

					<!-- Attendee List (mobile only) -->
					<div class="lg:hidden">
						<AttendeeList
							eventId={event.id}
							totalAttendees={event.attendee_count}
							isAuthenticated={data.isAuthenticated}
							listDisclosed={viewerVisibility.show_attendee_list}
							userVisibility={data.userVisibility}
							showPronounDistribution={viewerVisibility.show_pronoun_distribution}
						/>
					</div>
				</div>

				<!-- Right Column: Action Sidebar (desktop only) -->
				<aside class="hidden lg:col-span-1 lg:block">
					<div class="sticky top-4 space-y-6">
						{@render actionSidebar()}

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
							<EventSeriesLinkCard
								series={event.event_series}
								orgSlug={event.organization.slug}
								headingId="series-heading-desktop"
							/>
						{/if}

						<!-- Attendee List (desktop only) -->
						<AttendeeList
							eventId={event.id}
							totalAttendees={event.attendee_count}
							isAuthenticated={data.isAuthenticated}
							listDisclosed={viewerVisibility.show_attendee_list}
							userVisibility={data.userVisibility}
							showPronounDistribution={viewerVisibility.show_pronoun_distribution}
						/>
					</div>
				</aside>
			</div>

			<!-- Tags Section (bottom of page) -->
			<EventTagsSection tags={event.tags} />
		</div>
	</div>
</div>

<!-- Focused tiers dialog (sidebar CTA) — NOT gated on !cart.isEmpty: it must
     open with an empty cart. Same render gate as the inline section. -->
{#if canUseCart && event.requires_ticket && ticketTiers.length > 0 && (!userTicket || canBuyMore)}
	<TicketTiersDialog
		bind:open={showTiersDialog}
		count={cart.totalCount}
		totalDisplay={cartTotalDisplay}
		currency={cart.currency}
		isFree={cart.paymentMethod === 'free'}
		isPending={purchaseFlow.isProcessing}
		onCheckout={purchaseFlow.handleCartBuy}
	>
		{@render tierList('ticket-tiers-dialog')}
	</TicketTiersDialog>
{/if}

{#if canUseCart && !cart.isEmpty}
	<CartSeatHolds {cart} registry={seatHoldRegistry} eventId={event.id} />

	<CartSummaryBar
		count={cart.totalCount}
		totalDisplay={cartTotalDisplay}
		currency={cart.currency}
		isFree={cart.paymentMethod === 'free'}
		isPending={purchaseFlow.isProcessing}
		onBuy={purchaseFlow.handleCartBuy}
		onDiscountClick={cart.groups.some((g) => discountApplicable(g.tier))
			? () => {
					purchaseFlow.showCheckoutSheet = true;
				}
			: undefined}
		holdExpiresAt={seatHoldRegistry.expiresAt}
	/>

	<CheckoutSheet
		bind:open={purchaseFlow.showCheckoutSheet}
		{cart}
		eventId={event.id}
		requireTicketNames={event.require_ticket_names}
		isAuthenticated={data.isAuthenticated}
		authToken={authStore.accessToken}
		organizationSlug={event.organization.slug}
		{initialDiscountCode}
		isProcessing={purchaseFlow.isProcessing}
		purchaseError={purchaseFlow.cartPurchaseError}
		onConfirm={purchaseFlow.handleSheetConfirm}
		chart={seatHoldRegistry.chart}
		registry={seatHoldRegistry}
		identity={data.isAuthenticated ? undefined : purchaseFlow.guestIdentity}
	/>
{/if}

<!-- Seat-picker dialog (#853 PR 3): mounted only while a tier is being
     picked — NOT gated on !cart.isEmpty, since the first pick happens
     before any cart group exists. -->
{#if pickSeatsTier}
	{@const tier = pickSeatsTier}
	<SeatPickerDialog
		bind:open={() => pickSeatsTier !== null, handleSeatPickerOpenChange}
		{tier}
		eventId={event.id}
		{cart}
		registry={seatHoldRegistry}
		maxSeats={cart.maxQuantity(tier)}
	/>
{/if}

<!-- Purchase-dialog cluster (MyTicketModal, GuestRsvpDialog, VenueOverviewDialog) -->
<EventPurchaseDialogs
	{event}
	{ticketTiers}
	{tierRemainingTickets}
	isAuthenticated={data.isAuthenticated}
	{hasSeatingMap}
	{protectedSeatIds}
	{userTickets}
	isResumingPayment={resumePaymentMutation.isPending}
	isCancellingReservation={cancelReservationMutation.isPending}
	{refreshUserStatus}
	onResumePayment={handleResumePayment}
	onCancelReservation={handleCancelReservation}
	onSelectTier={handleSelectTier}
	onGuestRsvpClose={closeGuestRsvpDialog}
	onGuestAttendanceSuccess={handleGuestAttendanceSuccess}
	bind:showMyTicketModal
	bind:showGuestRsvpDialog
	bind:showVenueOverview
/>

<!-- Guest cart email-confirmation (#853 Task 5): the guest checkout controller's
     `message` branch — no ticket exists client-side yet, the backend emailed a
     confirm link. Mounted independently of the checkout sheet (which is
     already closed by `onEmailConfirmationPending` by the time this renders). -->
{#if purchaseFlow.guestEmailConfirmation}
	<CartEmailConfirmation
		bind:open={
			() => purchaseFlow.guestEmailConfirmation !== null,
			(open) => {
				if (!open) purchaseFlow.guestEmailConfirmation = null;
			}
		}
		email={purchaseFlow.guestEmailConfirmation.email}
		onClose={() => (purchaseFlow.guestEmailConfirmation = null)}
	/>
{/if}
