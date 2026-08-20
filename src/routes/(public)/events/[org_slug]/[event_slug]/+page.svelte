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
	import type {
		TierRemainingTicketsSchema,
		BuyerBillingInfoSchema
	} from '$lib/api/generated/types.gen';
	import { getPotluckPermissions } from '$lib/utils/permissions';
	import { formatEventLocation } from '$lib/utils/event';
	import { getUserRealName } from '$lib/utils/user-display';
	import { formatEventDate } from '$lib/utils/date';
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { EventCart } from '$lib/components/tickets/cart.svelte';
	import { cartTotal, cartTotalArgs } from '$lib/components/tickets/checkout-total';
	import { discountApplicable } from '$lib/components/tickets/cart-discount';
	import { buildCartItems, buildCartCheckoutParams } from '$lib/components/tickets/cart-payload';
	import CartSummaryBar from '$lib/components/tickets/CartSummaryBar.svelte';
	import CheckoutSheet from '$lib/components/tickets/CheckoutSheet.svelte';
	import { createCartCheckoutController } from '$lib/components/events/cart-checkout-controller.svelte';
	import { defaultGuestName } from '$lib/components/tickets/purchase-items';

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

	// Stranded-cart guard: unmounts TicketTierList but not the isEmpty-gated
	// summary bar (no-op for cart purchases, already cleared there).
	$effect(() => {
		if (userTicket) cart.clear();
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
	let showTicketTierModal = $state(false);
	let showMyTicketModal = $state(false);
	let showGuestRsvpDialog = $state(false);
	let showGuestTicketDialog = $state(false);
	let showVenueOverview = $state(false);
	let selectedTierForGuest = $state<TierSchemaWithId | null>(null);
	// The next guest dialog was opened BY a section switch: it should scroll
	// its seating UI into view (the keyed remount lands at the top).
	let guestFocusSeating = $state(false);
	let preSelectedTier = $state<TierSchemaWithId | null>(null);

	// Map-first entry point (#679): only when a purchasable tier sells a venue
	// sector (the chart itself is fetched lazily when the dialog opens).
	const hasSeatingMap = $derived(eventHasSeatingMap(ticketTiers, tierRemainingTickets));

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
		guestFocusSeating = false;
	}

	function closeGuestTicketDialog() {
		showGuestTicketDialog = false;
		selectedTierForGuest = null;
		guestFocusSeating = false;
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
		hasResumableCheckout,
		handleResumePayment,
		handleResumePaymentFromSidebar,
		handleCancelReservation
	} = createCheckoutController({
		eventId: event.id,
		queryClient,
		getUserTickets: () => userTickets,
		getTicketHolderDefaultName: () => ticketHolderDefaultName,
		getRequireTicketNames: () => event.require_ticket_names,
		setUserStatus: (status) => {
			userStatus = status;
		},
		onCloseTicketTierModal: closeTicketTierModal,
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

	// Quick-buy cart (#853): authed-only, wired into TicketTierList's per-tier
	// steppers and the sticky CartSummaryBar below.
	const cart = new EventCart({
		remainingFor: (tierId) => tierRemainingTickets?.find((t) => t.tier_id === tierId),
		eventRemaining: () => eventRemaining
	});

	const cartController = createCartCheckoutController({
		eventId: event.id,
		queryClient,
		refreshUserStatus,
		setShowMyTicketModal: (open) => {
			showMyTicketModal = open;
		},
		onPurchaseComplete: () => cart.clear()
	});

	const cartTotalDisplay = $derived(cartTotal(cart.groups.map(cartTotalArgs)));

	// Checkout sheet (#853 PR 2): multi-tier carts and any require_ticket_names
	// event route here for names/PWYC/discount/billing; single-tier carts on a
	// no-names event skip it entirely (direct checkout below).
	let showCheckoutSheet = $state(false);
	let cartPurchaseError = $state<unknown>(null);

	// Stranded-cart guard: a cart that empties out from under an open sheet
	// (e.g. the last held seat expiring) must close it rather than show an
	// empty checkout form.
	$effect(() => {
		if (cart.isEmpty) showCheckoutSheet = false;
	});

	// Closing the sheet (confirm, cancel, or the stranded-cart guard above)
	// discards any inline purchase error — the next open starts clean.
	$effect(() => {
		if (!showCheckoutSheet) cartPurchaseError = null;
	});

	function buildCartCheckoutItems() {
		return buildCartItems(cart.groups, {
			requireTicketNames: event.require_ticket_names,
			defaultName: defaultGuestName(ticketHolderDefaultName)
		});
	}

	async function handleCartBuy() {
		// A URL-seeded discount code needs the sheet too, even on a direct
		// single-tier "Buy" — skipping straight to checkout would drop it.
		if (cart.needsSheet(event.require_ticket_names) || initialDiscountCode) {
			showCheckoutSheet = true;
			return;
		}
		try {
			// '' / null keep the fingerprint byte-identical to PR 1's `{ items }`.
			await cartController.checkoutCart(
				buildCartCheckoutParams(buildCartCheckoutItems(), '', null)
			);
		} catch {
			// error surfaced via controller toast
		}
	}

	async function handleSheetConfirm({
		discountCode,
		billingInfo
	}: {
		discountCode: string;
		billingInfo: BuyerBillingInfoSchema | null;
	}) {
		try {
			await cartController.checkoutCart(
				buildCartCheckoutParams(buildCartCheckoutItems(), discountCode, billingInfo)
			);
			showCheckoutSheet = false;
		} catch (e) {
			// Sheet stays open with the inline error; the controller's toast still
			// fires too (accepted duplication — see task brief).
			cartPurchaseError = e;
		}
	}

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
	});
</script>

{#snippet actionSidebar()}
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
							capacityDisclosed={viewerVisibility.show_capacity}
							onSelectTier={handleSelectTier}
							onGuestTierClick={openGuestTicketDialog}
							onViewSeatingMap={hasSeatingMap
								? () => {
										showVenueOverview = true;
									}
								: undefined}
							cart={data.isAuthenticated ? cart : undefined}
							quickBuyDisabled={cartController.isPending}
							{eventRemaining}
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

{#if data.isAuthenticated && !cart.isEmpty}
	<CartSummaryBar
		count={cart.totalCount}
		totalDisplay={cartTotalDisplay}
		currency={cart.currency}
		isFree={cart.paymentMethod === 'free'}
		isPending={cartController.isPending}
		onBuy={handleCartBuy}
		onDiscountClick={cart.groups.some((g) => discountApplicable(g.tier))
			? () => {
					showCheckoutSheet = true;
				}
			: undefined}
	/>

	<CheckoutSheet
		bind:open={showCheckoutSheet}
		{cart}
		eventId={event.id}
		requireTicketNames={event.require_ticket_names}
		isAuthenticated={data.isAuthenticated}
		authToken={authStore.accessToken}
		organizationSlug={event.organization.slug}
		{initialDiscountCode}
		isProcessing={cartController.isPending}
		purchaseError={cartPurchaseError}
		onConfirm={handleSheetConfirm}
	/>
{/if}

<!-- Purchase-dialog cluster (TicketTierModal, MyTicketModal, GuestRsvpDialog, VenueOverviewDialog, GuestTicketDialog) -->
<EventPurchaseDialogs
	{event}
	{ticketTiers}
	{tierRemainingTickets}
	isAuthenticated={data.isAuthenticated}
	membershipTier={data.membershipTier}
	capacityDisclosed={viewerVisibility.show_capacity}
	{ticketHolderDefaultName}
	{initialDiscountCode}
	{hasSeatingMap}
	{userTickets}
	isResumingPayment={resumePaymentMutation.isPending}
	isCancellingReservation={cancelReservationMutation.isPending}
	{refreshUserStatus}
	onClaimTicket={handleClaimTicket}
	onCheckout={handleCheckout}
	{hasResumableCheckout}
	onResumePayment={handleResumePayment}
	onCancelReservation={handleCancelReservation}
	onSelectTier={handleSelectTier}
	onGuestTierClick={openGuestTicketDialog}
	onGuestRsvpClose={closeGuestRsvpDialog}
	onGuestAttendanceSuccess={handleGuestAttendanceSuccess}
	onGuestTicketClose={closeGuestTicketDialog}
	onTicketTierModalClose={closeTicketTierModal}
	bind:showTicketTierModal
	bind:showMyTicketModal
	bind:showGuestRsvpDialog
	bind:showGuestTicketDialog
	bind:showVenueOverview
	bind:preSelectedTier
	bind:selectedTierForGuest
	bind:guestFocusSeating
/>
