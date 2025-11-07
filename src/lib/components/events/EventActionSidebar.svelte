<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		EventDetailSchema,
		OrganizationPermissionsSchema,
		EventTokenSchema
	} from '$lib/api/generated/types.gen';
	import type { UserEventStatus } from '$lib/utils/eligibility';
	import { isRSVP, isTicket, isEligibility } from '$lib/utils/eligibility';
	import { cn } from '$lib/utils/cn';
	import EventStatusBadge from './EventStatusBadge.svelte';
	import EventQuickInfo from './EventQuickInfo.svelte';
	import ActionButton from './ActionButton.svelte';
	import EventRSVP from './EventRSVP.svelte';
	import EligibilityStatusDisplay from './EligibilityStatusDisplay.svelte';
	import { Check, Ticket, Settings, Users, Mail, CalendarDays } from 'lucide-svelte';
	import { downloadRevelEventICalFile } from '$lib/utils/ical';

	interface Props {
		event: EventDetailSchema;
		userStatus: UserEventStatus | null;
		isAuthenticated: boolean;
		userPermissions?: OrganizationPermissionsSchema | null;
		eventTokenDetails?: EventTokenSchema | null;
		variant?: 'sidebar' | 'card';
		onGetTicketsClick?: () => void;
		onShowTicketClick?: () => void;
		onResumePayment?: () => void;
		isResumingPayment?: boolean;
		class?: string;
	}

	let {
		event,
		userStatus = $bindable(),
		isAuthenticated,
		userPermissions,
		eventTokenDetails,
		variant = 'sidebar',
		onGetTicketsClick,
		onShowTicketClick,
		onResumePayment,
		isResumingPayment = false,
		class: className
	}: Props = $props();

	/**
	 * Check if user is attending (has approved RSVP or active ticket)
	 */
	let isAttending = $derived.by(() => {
		if (!userStatus) return false;

		if (isRSVP(userStatus)) {
			// User is attending if they RSVP'd 'yes'
			return userStatus.status === 'yes';
		}

		if (isTicket(userStatus)) {
			// User has a ticket if status is pending, active, or checked_in
			// (not cancelled - cancelled tickets shouldn't count as attending)
			return (
				userStatus.status === 'pending' ||
				userStatus.status === 'active' ||
				userStatus.status === 'checked_in'
			);
		}

		return false;
	});

	/**
	 * Get attendance status display text
	 */
	let attendanceStatusText = $derived.by(() => {
		if (!userStatus) return null;

		if (isRSVP(userStatus) && userStatus.status === 'yes') {
			return m['eventActionSidebar.youreAttending']();
		}

		if (isTicket(userStatus)) {
			if (userStatus.status === 'checked_in') {
				return m['eventActionSidebar.youreCheckedIn']();
			}
			if (userStatus.status === 'pending') {
				return m['eventActionSidebar.ticketPending']();
			}
			return m['eventActionSidebar.youHaveTicket']();
		}

		return null;
	});

	/**
	 * Get ticket tier name if applicable
	 */
	let ticketTierName = $derived.by(() => {
		if (userStatus && isTicket(userStatus) && userStatus.tier) {
			return userStatus.tier.name;
		}
		return null;
	});

	/**
	 * Check if eligibility should be shown
	 */
	let shouldShowEligibility = $derived.by(() => {
		if (!userStatus) return false;
		if (!isEligibility(userStatus)) return false;
		return !userStatus.allowed;
	});

	/**
	 * Check if ticket is pending with online payment (should show Resume Payment directly)
	 */
	let shouldShowResumePayment = $derived.by(() => {
		if (!userStatus || !isTicket(userStatus)) return false;
		if (userStatus.status !== 'pending') return false;
		if (!userStatus.tier) return false;

		// Only show for online (Stripe) payment method
		return userStatus.tier.payment_method === 'online';
	});

	/**
	 * Container classes based on variant
	 */
	let containerClasses = $derived(
		cn(
			'rounded-lg border bg-card',
			variant === 'sidebar' && 'sticky top-4',
			variant === 'card' && 'w-full',
			className
		)
	);

	// State for showing RSVP management
	let showManageRSVP = $state(false);

	/**
	 * Check if user can manage this event (owner or staff)
	 */
	let canManageEvent = $derived.by(() => {
		if (!userPermissions || !event.organization?.id) return false;

		const orgPermissions = userPermissions.organization_permissions?.[event.organization.id];

		// User can manage if they are owner or staff
		return !!orgPermissions;
	});

	/**
	 * Download iCal file for this event
	 */
	function handleDownloadCalendar() {
		downloadRevelEventICalFile(event);
	}

	/**
	 * Handle view ticket/manage RSVP action
	 */
	function handleSecondaryAction(): void {
		console.log('handleSecondaryAction called', {
			userStatus,
			onShowTicketClick,
			onGetTicketsClick
		});

		if (!userStatus) return;

		if (isTicket(userStatus)) {
			// Call parent's show ticket handler
			console.log('Calling onShowTicketClick');
			if (onShowTicketClick) {
				onShowTicketClick();
			} else {
				console.error('onShowTicketClick is not defined!');
			}
			return;
		}

		if (isRSVP(userStatus)) {
			// Toggle RSVP management view
			showManageRSVP = !showManageRSVP;
			return;
		}
	}
</script>

<!--
  Event Action Sidebar Component

  Unified action center for event attendance management. Contains event status,
  primary action button, attendance status, quick info, and eligibility details.

  @component
  @example
  <EventActionSidebar
    event={data.event}
    userStatus={data.userStatus}
    isAuthenticated={data.isAuthenticated}
    variant="sidebar"
    class="hidden lg:block"
  />
-->
<aside class={containerClasses} aria-label="Event actions">
	<!-- Card Header -->
	<div class="border-b p-4">
		<EventStatusBadge {event} />
	</div>

	<!-- Card Content -->
	<div class="space-y-4 p-4">
		<!-- Pending Payment Warning (for online tickets pending payment) -->
		{#if shouldShowResumePayment}
			<div
				class="flex flex-col gap-3 rounded-md border-2 border-orange-200 bg-orange-50 p-4 text-orange-900 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-100"
				role="alert"
			>
				<div class="flex items-start gap-2">
					<Ticket class="h-5 w-5 shrink-0" aria-hidden="true" />
					<div class="flex-1">
						<div class="font-semibold">{m['eventActionSidebar.ticketPendingPayment']()}</div>
						{#if ticketTierName}
							<div class="text-sm opacity-90">{ticketTierName}</div>
						{/if}
					</div>
				</div>
				<p class="text-sm">
					Complete your payment to confirm your ticket. Your reservation will expire if payment is
					not completed.
				</p>
				<button
					type="button"
					onclick={onResumePayment}
					disabled={isResumingPayment}
					class="w-full rounded-md border-2 border-orange-600 bg-orange-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-orange-500 dark:bg-orange-500"
				>
					{isResumingPayment ? 'Processing...' : 'Resume Payment'}
				</button>
			</div>
		{:else if isAttending && attendanceStatusText}
			<!-- Attendance Status Display (if user is attending) -->
			<div
				class="flex items-center gap-2 rounded-md bg-green-50 p-3 text-green-900 dark:bg-green-950/50 dark:text-green-100"
				role="status"
				aria-live="polite"
			>
				{#if userStatus && isTicket(userStatus)}
					<Ticket class="h-5 w-5 shrink-0" aria-hidden="true" />
				{:else}
					<Check class="h-5 w-5 shrink-0" aria-hidden="true" />
				{/if}
				<div class="flex-1">
					<div class="font-semibold">{attendanceStatusText}</div>
					{#if ticketTierName}
						<div class="text-sm opacity-90">{ticketTierName}</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Primary Action (if not attending) -->
		{#if !isAttending}
			<!-- RSVP Flow for non-ticketed events -->
			{#if !event.requires_ticket}
				<EventRSVP
					eventId={event.id}
					eventName={event.name}
					bind:userStatus
					{isAuthenticated}
					requiresTicket={event.requires_ticket}
					{event}
					{eventTokenDetails}
				/>
			{:else}
				<!-- Ticket purchase flow -->
				{#if shouldShowEligibility && userStatus && isEligibility(userStatus)}
					<!-- Show eligibility status for ticketed events -->
					<div>
						<h3 class="mb-2 text-sm font-semibold">
							{m['eventActionSidebar.eligibilityStatus']()}
						</h3>
						<EligibilityStatusDisplay
							eligibility={userStatus}
							eventId={event.id}
							eventSlug={event.slug}
							organizationSlug={event.organization.slug}
							eventName={event.name}
							{eventTokenDetails}
						/>
					</div>
				{:else}
					<!-- Show buy tickets button -->
					<ActionButton
						{userStatus}
						requiresTicket={event.requires_ticket}
						{isAuthenticated}
						onclick={onGetTicketsClick}
						class="w-full"
					/>
				{/if}
			{/if}
		{/if}

		<!-- Secondary Actions (if user is attending) -->
		{#if isAttending && !shouldShowResumePayment}
			<div class="space-y-2">
				<button
					type="button"
					onclick={handleSecondaryAction}
					class="w-full cursor-pointer rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{#if userStatus && isTicket(userStatus)}
						<span class="flex items-center justify-center gap-2">
							<Ticket class="h-4 w-4" aria-hidden="true" />
							Show Ticket
						</span>
					{:else}
						{showManageRSVP ? 'Hide' : 'Change'} RSVP
					{/if}
				</button>

				<!-- Add to Calendar Button -->
				<button
					type="button"
					onclick={handleDownloadCalendar}
					class="w-full cursor-pointer rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					aria-label="Download calendar event"
				>
					<span class="flex items-center justify-center gap-2">
						<CalendarDays class="h-4 w-4" aria-hidden="true" />
						Add to Calendar
					</span>
				</button>
			</div>

			<!-- Show EventRSVP when managing -->
			{#if showManageRSVP && userStatus && isRSVP(userStatus)}
				<EventRSVP
					eventId={event.id}
					eventName={event.name}
					bind:userStatus
					{isAuthenticated}
					requiresTicket={event.requires_ticket}
					{event}
				/>
			{/if}
		{/if}

		<!-- Manage Event Section (for staff/owners) -->
		{#if canManageEvent}
			<div class="border-t pt-4">
				<h3 class="mb-3 text-sm font-semibold">{m['eventActionSidebar.manageEvent']()}</h3>
				<div class="space-y-2">
					<a
						href="/org/{event.organization.slug}/admin/events/{event.id}/edit"
						class="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Settings class="h-4 w-4" aria-hidden="true" />
						Edit Event
					</a>
					{#if event.requires_ticket}
						<a
							href="/org/{event.organization.slug}/admin/events/{event.id}/tickets"
							class="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							<Users class="h-4 w-4" aria-hidden="true" />
							Manage Tickets
						</a>
					{:else}
						<a
							href="/org/{event.organization.slug}/admin/events/{event.id}/attendees"
							class="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							<Users class="h-4 w-4" aria-hidden="true" />
							Manage Attendees
						</a>
					{/if}
					<a
						href="/org/{event.organization.slug}/admin/events/{event.id}/invitations"
						class="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Mail class="h-4 w-4" aria-hidden="true" />
						Manage Invitations
					</a>
				</div>
			</div>
		{/if}

		<!-- Quick Info Section -->
		<div class="border-t pt-4">
			<h3 class="sr-only">{m['eventActionSidebar.eventDetails']()}</h3>
			<EventQuickInfo {event} variant="compact" />
		</div>

		<!-- Add to Calendar (always available) -->
		<div class="border-t pt-4">
			<button
				type="button"
				onclick={handleDownloadCalendar}
				class="w-full cursor-pointer rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				aria-label="Download calendar event"
			>
				<span class="flex items-center justify-center gap-2">
					<CalendarDays class="h-4 w-4" aria-hidden="true" />
					Add to Calendar
				</span>
			</button>
		</div>
	</div>
</aside>
