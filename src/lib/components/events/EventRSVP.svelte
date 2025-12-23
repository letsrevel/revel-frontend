<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { eventRsvpEvent } from '$lib/api/generated/sdk.gen';
	import type { UserEventStatus } from '$lib/utils/eligibility';
	import { isRSVP, isEligibility, isUserStatusResponse } from '$lib/utils/eligibility';
	import { cn } from '$lib/utils/cn';
	import RSVPButtons from './RSVPButtons.svelte';
	import ConfirmDialog from '../common/ConfirmDialog.svelte';
	import IneligibilityMessage from './IneligibilityMessage.svelte';
	import { Check, AlertCircle } from 'lucide-svelte';
	import { browser } from '$app/environment';

	import type { EventDetailSchema, EventTokenSchema } from '$lib/api/generated/types.gen';

	interface Props {
		eventId: string;
		eventName: string;
		userStatus: UserEventStatus | null;
		isAuthenticated: boolean;
		requiresTicket: boolean;
		event?: EventDetailSchema;
		eventTokenDetails?: EventTokenSchema | null;
		onGuestRsvpClick?: () => void;
		class?: string;
	}

	let {
		eventId,
		eventName,
		userStatus = $bindable(),
		isAuthenticated,
		requiresTicket,
		event,
		eventTokenDetails,
		onGuestRsvpClick,
		class: className
	}: Props = $props();

	const queryClient = useQueryClient();

	// Store initial status for reset functionality
	let initialStatus = $state<UserEventStatus | null>(userStatus);
	let showSuccess = $state(false);
	let successMessage = $state('');
	let successType = $state<'yes' | 'maybe' | 'no'>('yes');
	let errorMessage = $state<string | null>(null);
	// Track the user's RSVP answer separately (backend only returns status, not the answer)
	let userAnswer = $state<'yes' | 'no' | 'maybe' | null>(null);
	// Warning dialog state
	let showWarningDialog = $state(false);
	let pendingAnswer = $state<'yes' | 'no' | 'maybe' | null>(null);
	let claimedItemsCount = $state<number>(0);

	// Mutation: RSVP to event
	const rsvpMutation = createMutation(() => ({
		mutationFn: async (answer: 'yes' | 'no' | 'maybe') => {
			const response = await eventRsvpEvent({
				path: { event_id: eventId, answer }
			});

			if (!response.data) {
				throw new Error('No data returned from RSVP');
			}

			// Backend returns EventRsvpSchema with status = 'yes' | 'no' | 'maybe' (the user's answer)
			// But the generated type says status: Status = 'draft' | 'ready' | 'published'
			// We know the actual runtime type is EventRsvpSchemaActual
			return response.data as unknown as { event_id: string; status: 'yes' | 'no' | 'maybe' };
		},
		onMutate: async (answer: 'yes' | 'no' | 'maybe') => {
			// Clear any previous errors
			errorMessage = null;
			showSuccess = false;

			// Optimistic update: set to the user's answer
			const previousStatus = userStatus;

			// Set optimistic status with the user's answer
			userStatus = {
				event_id: eventId,
				status: answer
			} as { event_id: string; status: 'yes' | 'no' | 'maybe' };

			return { previousStatus };
		},
		onSuccess: (
			data: { event_id: string; status: 'yes' | 'no' | 'maybe' },
			answer: 'yes' | 'no' | 'maybe'
		) => {
			// Determine if this is a new RSVP or a change
			const wasAttending = userStatus && isRSVP(userStatus) && userStatus.status === 'yes';
			const isNowAttending = answer === 'yes';

			// Update local status with server response (backend returns the user's answer in status field)
			userStatus = data as { event_id: string; status: 'yes' | 'no' | 'maybe' };

			// Store the user's answer and type for styling
			userAnswer = data.status; // Backend returns the actual answer in status field
			successType = data.status;

			// Update event attendee count if event object is provided
			if (event) {
				if (!wasAttending && isNowAttending) {
					// User was not attending, now is attending: +1
					event.attendee_count += 1;
				} else if (wasAttending && !isNowAttending) {
					// User was attending, now is not: -1
					event.attendee_count = Math.max(0, event.attendee_count - 1);
				}
			}

			// Show success message
			if (answer === 'yes') {
				successMessage = m['eventRSVP.goingTo']({ eventName });
			} else if (answer === 'maybe') {
				successMessage = m['eventRSVP.mightAttend']({ eventName });
			} else {
				successMessage = m['eventRSVP.notAttending']({ eventName });
			}

			showSuccess = true;

			// Invalidate queries to refresh data
			queryClient.invalidateQueries({ queryKey: ['event', eventId, 'status'] });

			// Auto-hide success message after 5 seconds
			setTimeout(() => {
				showSuccess = false;
			}, 5000);
		},
		onError: (
			error: Error,
			_answer: 'yes' | 'no' | 'maybe',
			context: { previousStatus: UserEventStatus | null } | undefined
		) => {
			// Rollback optimistic update
			if (context?.previousStatus !== undefined) {
				userStatus = context.previousStatus;
			}

			// Show error message
			errorMessage = error.message || 'Failed to submit RSVP. Please try again or contact support.';
			showSuccess = false;
		}
	}));

	/**
	 * Check if user has claimed potluck items
	 */
	async function checkClaimedItems(): Promise<number> {
		try {
			const response = await fetch(`/api/events/${eventId}/potluck`, {
				credentials: 'include'
			});
			if (!response.ok) return 0;

			const items = await response.json();
			const claimedByUser = items.filter((item: { is_owned: boolean }) => item.is_owned);
			return claimedByUser.length;
		} catch {
			return 0;
		}
	}

	/**
	 * Handle RSVP selection
	 */
	async function handleRSVPSelect(answer: 'yes' | 'no' | 'maybe'): Promise<void> {
		// Check if user is changing from "yes" to "maybe" or "no"
		const wasAttendingYes = currentRsvpAnswer === 'yes';
		const isChangingToNotYes = answer === 'maybe' || answer === 'no';

		if (wasAttendingYes && isChangingToNotYes) {
			// Check if user has claimed items
			const count = await checkClaimedItems();
			claimedItemsCount = count;

			if (count > 0) {
				// Show warning dialog
				pendingAnswer = answer;
				showWarningDialog = true;
				return;
			}
		}

		// No warning needed, proceed with RSVP
		rsvpMutation.mutate(answer);
	}

	/**
	 * Handle warning dialog confirmation
	 */
	function handleWarningConfirm(): void {
		showWarningDialog = false;
		if (pendingAnswer) {
			rsvpMutation.mutate(pendingAnswer);
			pendingAnswer = null;
		}
	}

	/**
	 * Handle warning dialog cancellation
	 */
	function handleWarningCancel(): void {
		showWarningDialog = false;
		pendingAnswer = null;
	}

	/**
	 * Handle changing RSVP response
	 */
	function handleChangeResponse(): void {
		showSuccess = false;
		userStatus = initialStatus;
	}

	/**
	 * Handle retry after error
	 */
	function handleRetry(): void {
		errorMessage = null;
		// User can try again by clicking a button
	}

	// Computed: Determine current state
	let currentRsvpAnswer = $derived.by(() => {
		// First check if we have a locally stored answer (from this session)
		if (userAnswer) return userAnswer;

		if (!userStatus) return null;

		// New format: UserEventStatusResponse with rsvp field
		if (isUserStatusResponse(userStatus)) {
			const status = userStatus.rsvp?.status;
			if (status === 'yes' || status === 'no' || status === 'maybe') {
				return status;
			}
			return null;
		}

		// Legacy format: direct RSVP object
		if (!isRSVP(userStatus)) return null;

		// The backend returns the answer in the status field
		// Status is 'yes' | 'no' | 'maybe' for RSVP responses
		const status = userStatus.status as string;
		if (status === 'yes' || status === 'no' || status === 'maybe') {
			return status;
		}

		return null;
	});

	let hasExistingRsvp = $derived.by(() => {
		if (!userStatus) return false;
		// New format: UserEventStatusResponse with rsvp field
		if (isUserStatusResponse(userStatus)) {
			return !!userStatus.rsvp;
		}
		// Legacy format: direct RSVP object
		return isRSVP(userStatus);
	});

	let eligibilityStatus = $derived.by(() => {
		if (!userStatus) return null;
		if (!isEligibility(userStatus)) return null;
		return userStatus;
	});

	let isEligible = $derived.by(() => {
		// User is eligible if:
		// 1. They have an eligibility status that says allowed
		// 2. OR they already have an RSVP (they can change it)
		if (hasExistingRsvp) return true;
		if (eligibilityStatus && eligibilityStatus.allowed) return true;
		return false;
	});

	let shouldShowButtons = $derived.by(() => {
		// Show buttons if eligible and not in success state
		return isEligible && !showSuccess;
	});

	let shouldShowIneligibleMessage = $derived.by(() => {
		// Show ineligible message if user has eligibility status and is not allowed
		return eligibilityStatus && !eligibilityStatus.allowed && !showSuccess;
	});

	// Show RSVP if:
	// 1. Event doesn't require tickets
	// 2. Always show for non-ticketed events (to display login prompt if needed)
	let shouldRender = $derived(!requiresTicket);

	// Check if we should show guest button instead of regular RSVP
	let shouldShowGuestButton = $derived(
		!isAuthenticated && event?.can_attend_without_login && onGuestRsvpClick
	);

	// Check if we should show login prompt (user not authenticated and event requires login)
	let shouldShowLoginPrompt = $derived(
		!isAuthenticated && event && !event.can_attend_without_login
	);

	// Get current pathname for redirect (SSR-safe)
	let currentPathname = $derived(browser ? window.location.pathname : '');
</script>

<!--
  Event RSVP Component

  Smart component managing RSVP state, API calls, and eligibility logic.
  Handles three states:
  1. Not eligible: Show helpful message + CTA
  2. Already RSVP'd: Show confirmation + change option
  3. Eligible to RSVP: Show active buttons

  @component
  @example
  <EventRSVP
    eventId={event.id}
    eventName={event.name}
    initialStatus={userStatus}
    isAuthenticated={true}
    requiresTicket={false}
  />
-->
{#if shouldRender}
	<div class={cn('space-y-4', className)}>
		<!-- Success State -->
		{#if showSuccess && successMessage}
			<div
				class={cn(
					'flex items-start gap-3 rounded-md p-4',
					successType === 'yes' &&
						'bg-green-50 text-green-900 dark:bg-green-950/50 dark:text-green-100',
					successType === 'maybe' &&
						'bg-yellow-50 text-yellow-900 dark:bg-yellow-950/50 dark:text-yellow-100',
					successType === 'no' && 'bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-100'
				)}
				role="status"
				aria-live="polite"
			>
				<Check class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
				<div class="flex-1">
					<p class="font-semibold">{successMessage}</p>
					<button
						type="button"
						onclick={handleChangeResponse}
						class={cn(
							'mt-2 text-sm underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
							successType === 'yes' && 'focus-visible:ring-green-600',
							successType === 'maybe' && 'focus-visible:ring-yellow-600',
							successType === 'no' && 'focus-visible:ring-red-600'
						)}
					>
						Change response
					</button>
				</div>
			</div>
		{/if}

		<!-- Error State -->
		{#if errorMessage && !showSuccess}
			<div
				class="flex items-start gap-3 rounded-md bg-destructive/10 p-4 text-destructive"
				role="alert"
				aria-live="assertive"
			>
				<AlertCircle class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
				<div class="flex-1">
					<p class="font-semibold">{m['eventRSVP.rsvpFailed']()}</p>
					<p class="mt-1 text-sm">{errorMessage}</p>
					<button
						type="button"
						onclick={handleRetry}
						class="mt-2 text-sm underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
					>
						Try again
					</button>
				</div>
			</div>
		{/if}

		<!-- Ineligible State -->
		{#if shouldShowIneligibleMessage && eligibilityStatus && event}
			<IneligibilityMessage
				eligibility={eligibilityStatus}
				{eventId}
				eventSlug={event.slug}
				{eventName}
				organizationSlug={event.organization.slug}
				organizationName={event.organization.name}
				{eventTokenDetails}
			/>
		{/if}

		<!-- Login Prompt (for unauthenticated users when event requires login) -->
		{#if shouldShowLoginPrompt}
			<div class="space-y-3">
				<h3 class="text-sm font-semibold">{m['eventRSVP.willYouAttend']()}</h3>
				<a
					href="/login?redirect={encodeURIComponent(currentPathname)}"
					class="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
				>
					{m['eventRSVP.loginToRSVP']()}
				</a>
				<p class="text-center text-xs text-muted-foreground">
					{m['eventRSVP.loginToRSVPDescription']()}
				</p>
			</div>
		{/if}

		<!-- Guest RSVP Button (for unauthenticated users when event allows it) -->
		{#if shouldShowGuestButton}
			<div class="space-y-3">
				<h3 class="text-sm font-semibold">{m['eventRSVP.willYouAttend']()}</h3>
				<button
					type="button"
					onclick={onGuestRsvpClick}
					class="w-full rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
				>
					{m['guest_attendance.submit_rsvp']()}
				</button>
				<p class="text-center text-xs text-muted-foreground">
					{m['guest_attendance.rsvp_description']()}
				</p>
			</div>
		{/if}

		<!-- RSVP Buttons (always shown when eligible, even if already RSVP'd) -->
		{#if shouldShowButtons && !shouldShowGuestButton && !shouldShowLoginPrompt}
			<div class="space-y-3">
				<h3 class="text-sm font-semibold">{m['eventRSVP.willYouAttend']()}</h3>
				<RSVPButtons
					onSelect={handleRSVPSelect}
					currentAnswer={currentRsvpAnswer}
					isLoading={rsvpMutation.isPending}
					isEligible={true}
					disabled={false}
				/>
			</div>
		{/if}
	</div>

	<!-- Warning Dialog for Claimed Items -->
	<ConfirmDialog
		isOpen={showWarningDialog}
		title="Unclaim Potluck Items?"
		message={claimedItemsCount === 1
			? 'You\'ve claimed 1 potluck item for this event. Changing your RSVP to "Maybe" or "No" will automatically unclaim this item. Are you sure you want to proceed?'
			: `You've claimed ${claimedItemsCount} potluck items for this event. Changing your RSVP to "Maybe" or "No" will automatically unclaim all these items. Are you sure you want to proceed?`}
		confirmText="Yes, change RSVP"
		cancelText="Cancel"
		variant="warning"
		onConfirm={handleWarningConfirm}
		onCancel={handleWarningCancel}
	/>
{/if}
