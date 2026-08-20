<script lang="ts">
	/**
	 * The event page's purchase-dialog cluster (#853 task 7): TicketTierModal,
	 * MyTicketModal, GuestRsvpDialog, VenueOverviewDialog, GuestTicketDialog.
	 * Pure markup + state extraction from +page.svelte for page headroom — no
	 * behavior change. The five `open` flags are bindable because other page
	 * code (sidebar callbacks, the cart controller, TicketTierList's
	 * onViewSeatingMap) writes them directly; `preSelectedTier`,
	 * `selectedTierForGuest`, and `guestFocusSeating` are bindable because both
	 * this component's own inline handlers (onSwitchTier, onViewSeatingMap) AND
	 * the page's `handleSelectTier`/`openGuestTicketDialog` (still needed there
	 * for TicketTierList's onSelectTier/onGuestTierClick) read and write them —
	 * keeping them page-owned avoids duplicating that state in two places.
	 */
	import { useQueryClient } from '@tanstack/svelte-query';
	import type { TierSchemaWithId, SeatingCheckoutFields } from '$lib/types/tickets';
	import type {
		EventDetailSchema,
		MembershipTierSchema,
		TierRemainingTicketsSchema,
		TicketPurchaseItem,
		BuyerBillingInfoSchema
	} from '$lib/api/generated/types.gen';
	import type { EventTicketSchemaActual } from '$lib/utils/eligibility';
	import { formatEventDate } from '$lib/utils/date';
	import { formatEventLocation } from '$lib/utils/event';
	import TicketTierModal from '$lib/components/tickets/TicketTierModal.svelte';
	import MyTicketModal from '$lib/components/tickets/MyTicketModal.svelte';
	import GuestRsvpDialog from './GuestRsvpDialog.svelte';
	import GuestTicketDialog from './GuestTicketDialog.svelte';
	import VenueOverviewDialog from './VenueOverviewDialog.svelte';

	interface Props {
		event: EventDetailSchema;
		ticketTiers: TierSchemaWithId[];
		tierRemainingTickets?: TierRemainingTicketsSchema[];
		isAuthenticated: boolean;
		membershipTier?: MembershipTierSchema | null;
		capacityDisclosed?: boolean;
		ticketHolderDefaultName: string;
		initialDiscountCode: string;
		hasSeatingMap: boolean;
		userTickets: EventTicketSchemaActual[];
		isResumingPayment: boolean;
		isCancellingReservation: boolean;
		/** Refreshes `userStatus` on the page — also drives the two MyTicketModal closures below. */
		refreshUserStatus: () => Promise<void>;
		onClaimTicket: (
			tierId: string,
			tickets?: TicketPurchaseItem[],
			discountCode?: string,
			billingInfo?: BuyerBillingInfoSchema,
			seating?: SeatingCheckoutFields
		) => void;
		onCheckout?: (
			tierId: string,
			isPwyc: boolean,
			amount?: number,
			tickets?: TicketPurchaseItem[],
			discountCode?: string,
			billingInfo?: BuyerBillingInfoSchema,
			seating?: SeatingCheckoutFields
		) => void;
		hasResumableCheckout?: (
			tierId: string,
			isPwyc: boolean,
			amount?: number,
			tickets?: TicketPurchaseItem[],
			discountCode?: string,
			billingInfo?: BuyerBillingInfoSchema,
			seating?: SeatingCheckoutFields
		) => boolean;
		onResumePayment?: (paymentId: string) => void;
		onCancelReservation?: (paymentId: string) => void;
		/** Also used by the page's TicketTierList (map §7). */
		onSelectTier: (tier: TierSchemaWithId) => void;
		/** Also used by the page's TicketTierList (map §7). */
		onGuestTierClick?: (tier?: TierSchemaWithId) => void;
		onGuestRsvpClose: () => void;
		onGuestAttendanceSuccess: () => void | Promise<void>;
		onGuestTicketClose: () => void;
		onTicketTierModalClose: () => void;
		showTicketTierModal: boolean;
		showMyTicketModal: boolean;
		showGuestRsvpDialog: boolean;
		showGuestTicketDialog: boolean;
		showVenueOverview: boolean;
		preSelectedTier: TierSchemaWithId | null;
		selectedTierForGuest: TierSchemaWithId | null;
		guestFocusSeating: boolean;
	}

	let {
		event,
		ticketTiers,
		tierRemainingTickets,
		isAuthenticated,
		membershipTier = null,
		capacityDisclosed = true,
		ticketHolderDefaultName,
		initialDiscountCode,
		hasSeatingMap,
		userTickets,
		isResumingPayment,
		isCancellingReservation,
		refreshUserStatus,
		onClaimTicket,
		onCheckout,
		hasResumableCheckout,
		onResumePayment,
		onCancelReservation,
		onSelectTier,
		onGuestTierClick,
		onGuestRsvpClose,
		onGuestAttendanceSuccess,
		onGuestTicketClose,
		onTicketTierModalClose,
		showTicketTierModal = $bindable(),
		showMyTicketModal = $bindable(),
		showGuestRsvpDialog = $bindable(),
		showGuestTicketDialog = $bindable(),
		showVenueOverview = $bindable(),
		preSelectedTier = $bindable(),
		selectedTierForGuest = $bindable(),
		guestFocusSeating = $bindable()
	}: Props = $props();

	const queryClient = useQueryClient();
</script>

<!-- Ticket Tier Selection Modal -->
<TicketTierModal
	seriesInfo={event.event_series
		? {
				seriesId: event.event_series.id,
				orgSlug: event.organization.slug,
				seriesSlug: event.event_series.slug
			}
		: null}
	bind:open={showTicketTierModal}
	tiers={ticketTiers}
	eventId={event.id}
	organizationSlug={event.organization.slug}
	{isAuthenticated}
	{membershipTier}
	canAttendWithoutLogin={event.can_attend_without_login}
	{tierRemainingTickets}
	timezone={event.timezone}
	{capacityDisclosed}
	eventMaxTicketsPerUser={event.max_tickets_per_user}
	userName={ticketHolderDefaultName}
	requireTicketNames={event.require_ticket_names}
	{preSelectedTier}
	{initialDiscountCode}
	onClose={onTicketTierModalClose}
	{onClaimTicket}
	{onCheckout}
	{hasResumableCheckout}
	{onGuestTierClick}
	onViewSeatingMap={hasSeatingMap
		? () => {
				showVenueOverview = true;
			}
		: undefined}
/>

<!-- My Ticket Modal -->
{#if userTickets.length > 0}
	<MyTicketModal
		bind:open={showMyTicketModal}
		tickets={userTickets}
		eventName={event.name}
		eventDate={event.start ? formatEventDate(event.start, event.timezone) : undefined}
		eventLocation={formatEventLocation(event)}
		{onResumePayment}
		{isResumingPayment}
		{onCancelReservation}
		{isCancellingReservation}
		onTicketCancelled={async () => {
			showMyTicketModal = false;
			await refreshUserStatus();
			queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });
		}}
		onTicketRenamed={async () => {
			await refreshUserStatus();
			queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });
		}}
	/>
{/if}

<!-- Guest RSVP Dialog -->
{#if !isAuthenticated && event.can_attend_without_login && !event.requires_ticket}
	<GuestRsvpDialog
		bind:open={showGuestRsvpDialog}
		eventId={event.id}
		acceptsNotes={event.accept_rsvp_notes}
		onClose={onGuestRsvpClose}
		onSuccess={onGuestAttendanceSuccess}
	/>
{/if}

<!-- Whole-venue seating overview (map-first tier selection, #679) -->
{#if hasSeatingMap}
	<VenueOverviewDialog
		bind:open={showVenueOverview}
		eventId={event.id}
		tiers={ticketTiers}
		{isAuthenticated}
		canAttendWithoutLogin={event.can_attend_without_login}
		{tierRemainingTickets}
		eventMaxTicketsPerUser={event.max_tickets_per_user}
		{onSelectTier}
		{onGuestTierClick}
	/>
{/if}

<!-- Guest Ticket Dialog -->
{#if !isAuthenticated && event.can_attend_without_login && event.requires_ticket && selectedTierForGuest}
	{#key selectedTierForGuest.id}
		<GuestTicketDialog
			bind:open={showGuestTicketDialog}
			eventId={event.id}
			tier={selectedTierForGuest}
			allTiers={ticketTiers}
			eventMaxTicketsPerUser={event.max_tickets_per_user}
			requireTicketNames={event.require_ticket_names}
			onClose={onGuestTicketClose}
			onSuccess={onGuestAttendanceSuccess}
			focusSeating={guestFocusSeating}
			onSwitchTier={(tier) => {
				selectedTierForGuest = tier;
				showGuestTicketDialog = true;
				guestFocusSeating = true;
			}}
		/>
	{/key}
{/if}
