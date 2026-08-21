<script lang="ts">
	/**
	 * The event page's purchase-dialog cluster (#853 task 7, slimmed in task 9):
	 * MyTicketModal, GuestRsvpDialog, VenueOverviewDialog, GuestTicketDialog. The
	 * single-tier `TicketTierModal`/`TicketConfirmationDialog` path died with the
	 * cart — purchasing now happens inline on the page (quick-buy steppers, the
	 * seat picker, the checkout sheet). Pure markup + state extraction from
	 * +page.svelte for page headroom — no behavior change. The `open` flags are
	 * bindable because other page code (sidebar callbacks, the cart controller,
	 * TicketTierList's onViewSeatingMap) writes them directly; `selectedTierForGuest`
	 * and `guestFocusSeating` are bindable because both this component's own inline
	 * handler (onSwitchTier) AND the page's `openGuestTicketDialog` (still needed
	 * there for TicketTierList's onGuestTierClick) read and write them — keeping
	 * them page-owned avoids duplicating that state in two places.
	 */
	import { useQueryClient } from '@tanstack/svelte-query';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type { EventDetailSchema, TierRemainingTicketsSchema } from '$lib/api/generated/types.gen';
	import type { EventTicketSchemaActual } from '$lib/utils/eligibility';
	import { formatEventDate } from '$lib/utils/date';
	import { formatEventLocation } from '$lib/utils/event';
	import MyTicketModal from '$lib/components/tickets/MyTicketModal.svelte';
	import GuestRsvpDialog from './GuestRsvpDialog.svelte';
	import GuestTicketDialog from './GuestTicketDialog.svelte';
	import VenueOverviewDialog from './VenueOverviewDialog.svelte';

	interface Props {
		event: EventDetailSchema;
		ticketTiers: TierSchemaWithId[];
		tierRemainingTickets?: TierRemainingTicketsSchema[];
		isAuthenticated: boolean;
		hasSeatingMap: boolean;
		userTickets: EventTicketSchemaActual[];
		isResumingPayment: boolean;
		isCancellingReservation: boolean;
		/** Refreshes `userStatus` on the page — also drives the two MyTicketModal closures below. */
		refreshUserStatus: () => Promise<void>;
		onResumePayment?: (paymentId: string) => void;
		onCancelReservation?: (paymentId: string) => void;
		/** Also used by the page's TicketTierList (map §7). Routes an authenticated
		 * buyer into the cart — `heldSeatIds` carries any seats the venue overview
		 * already held server-side for a `user_choice` tier's Continue action. */
		onSelectTier: (tier: TierSchemaWithId, heldSeatIds?: string[]) => void;
		/** Also used by the page's TicketTierList (map §7). */
		onGuestTierClick?: (tier?: TierSchemaWithId) => void;
		onGuestRsvpClose: () => void;
		onGuestAttendanceSuccess: () => void | Promise<void>;
		onGuestTicketClose: () => void;
		showMyTicketModal: boolean;
		showGuestRsvpDialog: boolean;
		showGuestTicketDialog: boolean;
		showVenueOverview: boolean;
		selectedTierForGuest: TierSchemaWithId | null;
		guestFocusSeating: boolean;
	}

	let {
		event,
		ticketTiers,
		tierRemainingTickets,
		isAuthenticated,
		hasSeatingMap,
		userTickets,
		isResumingPayment,
		isCancellingReservation,
		refreshUserStatus,
		onResumePayment,
		onCancelReservation,
		onSelectTier,
		onGuestTierClick,
		onGuestRsvpClose,
		onGuestAttendanceSuccess,
		onGuestTicketClose,
		showMyTicketModal = $bindable(),
		showGuestRsvpDialog = $bindable(),
		showGuestTicketDialog = $bindable(),
		showVenueOverview = $bindable(),
		selectedTierForGuest = $bindable(),
		guestFocusSeating = $bindable()
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
