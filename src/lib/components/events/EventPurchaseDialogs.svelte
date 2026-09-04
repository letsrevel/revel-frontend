<script lang="ts">
	/**
	 * The event page's purchase-dialog cluster (#853 task 7, slimmed in Task 5,
	 * further slimming to come in task 9): MyTicketModal, GuestRsvpDialog,
	 * VenueOverviewDialog. The single-tier `TicketTierModal`/
	 * `TicketConfirmationDialog` path died with the cart, and the guest ticket
	 * dialog died with the guest cart (#853 Task 5) — purchasing now happens
	 * inline on the page for every buyer, authenticated or guest (quick-buy
	 * steppers, the seat picker, the checkout sheet). Pure markup + state
	 * extraction from +page.svelte for page headroom — no behavior change. The
	 * `open` flags are bindable because other page code (sidebar callbacks, the
	 * cart controller, TicketTierList's onViewSeatingMap) writes them directly.
	 */
	import { useQueryClient } from '@tanstack/svelte-query';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type { EventDetailSchema, TierRemainingTicketsSchema } from '$lib/api/generated/types.gen';
	import type { EventTicketSchemaActual } from '$lib/utils/eligibility';
	import { formatEventDate } from '$lib/utils/date';
	import { formatEventLocation } from '$lib/utils/event';
	import MyTicketModal from '$lib/components/tickets/MyTicketModal.svelte';
	import GuestRsvpDialog from './GuestRsvpDialog.svelte';
	import VenueOverviewDialog from './VenueOverviewDialog.svelte';

	interface Props {
		event: EventDetailSchema;
		ticketTiers: TierSchemaWithId[];
		tierRemainingTickets?: TierRemainingTicketsSchema[];
		isAuthenticated: boolean;
		hasSeatingMap: boolean;
		/** Seat ids already owned by the cart — passed to VenueOverviewDialog so
		 * its map never adopts or releases the cart's own holds (#853
		 * final-review fix 1). */
		protectedSeatIds?: ReadonlySet<string>;
		userTickets: EventTicketSchemaActual[];
		isResumingPayment: boolean;
		isCancellingReservation: boolean;
		/** Refreshes `userStatus` on the page — also drives the two MyTicketModal closures below. */
		refreshUserStatus: () => Promise<void>;
		onResumePayment?: (paymentId: string) => void;
		onCancelReservation?: (paymentId: string) => void;
		/** Also used by the page's TicketTierList (map §7). Routes the buyer
		 * into the cart — `heldSeatIds` carries any seats the venue overview
		 * already held server-side for a `user_choice` tier's Continue action. */
		onSelectTier: (tier: TierSchemaWithId, heldSeatIds?: string[]) => void;
		onGuestRsvpClose: () => void;
		onGuestAttendanceSuccess: () => void | Promise<void>;
		/** Invitation-link token id (`?et=`) — forwarded to GuestRsvpDialog as
		 * `X-Event-Token` (backend #923). */
		eventToken?: string | null;
		showMyTicketModal: boolean;
		showGuestRsvpDialog: boolean;
		showVenueOverview: boolean;
	}

	let {
		event,
		ticketTiers,
		tierRemainingTickets,
		isAuthenticated,
		hasSeatingMap,
		protectedSeatIds = new Set(),
		userTickets,
		isResumingPayment,
		isCancellingReservation,
		refreshUserStatus,
		onResumePayment,
		onCancelReservation,
		onSelectTier,
		onGuestRsvpClose,
		onGuestAttendanceSuccess,
		eventToken = null,
		showMyTicketModal = $bindable(),
		showGuestRsvpDialog = $bindable(),
		showVenueOverview = $bindable()
	}: Props = $props();

	const queryClient = useQueryClient();
</script>

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
		{eventToken}
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
		{protectedSeatIds}
		{onSelectTier}
	/>
{/if}
