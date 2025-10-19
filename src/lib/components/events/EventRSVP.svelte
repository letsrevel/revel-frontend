<script lang="ts">
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { eventRsvpEvent29565362 } from '$lib/api/generated/sdk.gen';
	import type { UserEventStatus } from '$lib/utils/eligibility';
	import {
		isRSVP,
		isEligibility,
		getActionButtonText,
		isActionDisabled,
		getEligibilityExplanation
	} from '$lib/utils/eligibility';
	import { cn } from '$lib/utils/cn';
	import RSVPButtons from './RSVPButtons.svelte';
	import ConfirmDialog from '../common/ConfirmDialog.svelte';
	import { Check, AlertCircle, ClipboardList, UserPlus, Mail } from 'lucide-svelte';

	import type { EventDetailSchema } from '$lib/api/generated/types.gen';

	interface Props {
		eventId: string;
		eventName: string;
		userStatus: UserEventStatus | null;
		isAuthenticated: boolean;
		requiresTicket: boolean;
		event?: EventDetailSchema;
		class?: string;
	}

	let {
		eventId,
		eventName,
		userStatus = $bindable(),
		isAuthenticated,
		requiresTicket,
		event,
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
			const response = await eventRsvpEvent29565362({
				path: { event_id: eventId, answer }
			});

			if (!response.data) {
				throw new Error('No data returned from RSVP');
			}

			return response.data;
		},
		onMutate: async (_answer: 'yes' | 'no' | 'maybe') => {
			// Clear any previous errors
			errorMessage = null;
			showSuccess = false;

			// Optimistic update: assume RSVP will be approved
			const previousStatus = userStatus;

			// Set optimistic status
			userStatus = {
				event_id: eventId,
				status: 'approved'
			};

			return { previousStatus };
		},
		onSuccess: (data: { event_id: string; status: 'approved' | 'rejected' | 'pending review' }, answer: 'yes' | 'no' | 'maybe') => {
			// Determine if this is a new RSVP or a change
			const wasAttending = userStatus && isRSVP(userStatus) && userStatus.status === 'yes';
			const isNowAttending = answer === 'yes';

			// Update local status with server response
			userStatus = data;

			// Store the user's answer and type for styling
			userAnswer = answer;
			successType = answer;

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
				successMessage = `You're going to ${eventName}!`;
			} else if (answer === 'maybe') {
				successMessage = `You might attend ${eventName}`;
			} else {
				successMessage = `You're not attending ${eventName}`;
			}

			showSuccess = true;

			// Invalidate queries to refresh data
			queryClient.invalidateQueries({ queryKey: ['event', eventId, 'status'] });

			// Auto-hide success message after 5 seconds
			setTimeout(() => {
				showSuccess = false;
			}, 5000);
		},
		onError: (error: Error, _answer: 'yes' | 'no' | 'maybe', context: { previousStatus: UserEventStatus | null } | undefined) => {
			// Rollback optimistic update
			if (context?.previousStatus !== undefined) {
				userStatus = context.previousStatus;
			}

			// Show error message
			errorMessage =
				error.message || 'Failed to submit RSVP. Please try again or contact support.';
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

	/**
	 * Get CTA link based on next step
	 */
	function getCtaLink(nextStep?: string): string | null {
		if (!nextStep) return null;

		switch (nextStep) {
			case 'complete_questionnaire':
				return '/account/questionnaires';
			case 'become_member':
				return '#'; // TODO: Link to organization page
			case 'request_invitation':
				return null; // Handled by button action
			default:
				return null;
		}
	}

	/**
	 * Get icon component for next step
	 */
	function getNextStepIconComponent(nextStep?: string): typeof Check | null {
		if (!nextStep) return null;

		switch (nextStep) {
			case 'complete_questionnaire':
				return ClipboardList;
			case 'become_member':
				return UserPlus;
			case 'request_invitation':
				return Mail;
			default:
				return AlertCircle;
		}
	}

	/**
	 * Handle CTA button click for ineligible users
	 */
	function handleCtaClick(nextStep?: string | null): void {
		if (!nextStep) return;

		if (nextStep === 'request_invitation') {
			// TODO: Implement invitation request
			console.log('Request invitation for event:', eventId);
			return;
		}

		const link = getCtaLink(nextStep);
		if (link && link !== '#') {
			window.location.href = link;
		}
	}

	// Computed: Determine current state
	let currentRsvpAnswer = $derived.by(() => {
		if (!userStatus || !isRSVP(userStatus)) return null;

		// First check if we have a locally stored answer (from this session)
		if (userAnswer) return userAnswer;

		// Otherwise, the backend returns the answer in the status field
		// Status is 'yes' | 'no' | 'maybe' for RSVP responses
		const status = userStatus.status as string;
		if (status === 'yes' || status === 'no' || status === 'maybe') {
			return status;
		}

		return null;
	});

	let hasExistingRsvp = $derived.by(() => {
		if (!userStatus) return false;
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

	// Don't show RSVP for ticket-required events
	let shouldRender = $derived(!requiresTicket && isAuthenticated);
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
					<p class="font-semibold">RSVP Failed</p>
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
		{#if shouldShowIneligibleMessage && eligibilityStatus}
			<div class="space-y-3">
				<!-- Ineligibility explanation -->
				<div
					class="rounded-md border border-muted-foreground/20 bg-muted/50 p-4"
					role="status"
					aria-live="polite"
				>
					<p class="text-sm text-muted-foreground">
						{getEligibilityExplanation(eligibilityStatus)}
					</p>
				</div>

				<!-- CTA Button (if applicable) -->
				{#if eligibilityStatus.next_step && !isActionDisabled(eligibilityStatus.next_step)}
					{@const IconComponent = getNextStepIconComponent(eligibilityStatus.next_step)}
					{@const ctaLink = getCtaLink(eligibilityStatus.next_step)}
					{@const buttonText = getActionButtonText(eligibilityStatus.next_step)}

					{#if ctaLink && ctaLink !== '#'}
						<a
							href={ctaLink}
							class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:w-auto"
						>
							{#if IconComponent}
								<IconComponent class="h-5 w-5" aria-hidden="true" />
							{/if}
							{buttonText}
						</a>
					{:else}
						<button
							type="button"
							onclick={() => handleCtaClick(eligibilityStatus.next_step)}
							class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:w-auto"
						>
							{#if IconComponent}
								<IconComponent class="h-5 w-5" aria-hidden="true" />
							{/if}
							{buttonText}
						</button>
					{/if}
				{/if}

				<!-- Disabled RSVP buttons (visual indicator) -->
				<div aria-hidden="true">
					<RSVPButtons onSelect={() => {}} isEligible={false} disabled={true} />
				</div>
			</div>
		{/if}

		<!-- RSVP Buttons (always shown when eligible, even if already RSVP'd) -->
		{#if shouldShowButtons}
			<div class="space-y-3">
				<h3 class="text-sm font-semibold">Will you attend?</h3>
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
			? "You've claimed 1 potluck item for this event. Changing your RSVP to \"Maybe\" or \"No\" will automatically unclaim this item. Are you sure you want to proceed?"
			: `You've claimed ${claimedItemsCount} potluck items for this event. Changing your RSVP to "Maybe" or "No" will automatically unclaim all these items. Are you sure you want to proceed?`}
		confirmText="Yes, change RSVP"
		cancelText="Cancel"
		variant="warning"
		onConfirm={handleWarningConfirm}
		onCancel={handleWarningCancel}
	/>
{/if}
