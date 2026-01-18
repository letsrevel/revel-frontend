<script lang="ts">
	import type { EventUserEligibility, EventTokenSchema } from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import {
		AlertCircle,
		ClipboardList,
		Clock,
		Mail,
		UserPlus,
		Users,
		Ticket,
		Bell,
		XCircle,
		Calendar,
		UserCircle
	} from 'lucide-svelte';
	import { getMissingProfileFieldLabel } from '$lib/utils/eligibility';
	import IneligibilityActionButton from './IneligibilityActionButton.svelte';
	import RetryCountdown from './RetryCountdown.svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		eligibility: EventUserEligibility;
		eventId: string;
		eventSlug: string;
		eventName: string;
		organizationSlug: string;
		organizationName: string;
		eventTokenDetails?: EventTokenSchema | null;
		applyBefore?: string | null;
		class?: string;
	}

	let {
		eligibility,
		eventId,
		eventSlug,
		organizationSlug,
		organizationName,
		eventTokenDetails,
		applyBefore,
		class: className
	}: Props = $props();

	/**
	 * Format the apply_before deadline for display
	 */
	function formatDeadline(deadline: string): string {
		const date = new Date(deadline);
		const now = new Date();
		const diff = date.getTime() - now.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

		if (diff < 0) {
			return m['ineligibilityMessage.deadlinePassed']?.() ?? 'Deadline has passed';
		}

		if (days === 0 && hours < 24) {
			if (hours <= 1) {
				return m['ineligibilityMessage.deadlineLessThanOneHour']?.() ?? 'Less than 1 hour left';
			}
			return (
				m['ineligibilityMessage.deadlineHoursLeft']?.({ hours }) ?? `${hours} hours left to apply`
			);
		}

		if (days === 1) {
			return m['ineligibilityMessage.deadlineTomorrow']?.() ?? 'Tomorrow';
		}

		if (days < 7) {
			return m['ineligibilityMessage.deadlineDaysLeft']?.({ days }) ?? `${days} days left to apply`;
		}

		return date.toLocaleDateString(undefined, {
			month: 'long',
			day: 'numeric',
			year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
		});
	}

	/**
	 * Check if we should show the deadline for this next step
	 */
	let shouldShowDeadline = $derived.by(() => {
		if (!applyBefore) return false;
		const deadline = new Date(applyBefore);
		if (deadline < new Date()) return false; // Deadline passed, don't show countdown

		// Show deadline for application-related steps
		return (
			eligibility.next_step === 'request_invitation' ||
			eligibility.next_step === 'complete_questionnaire'
		);
	});

	/**
	 * Check if the reason is specifically about application deadline
	 */
	let isApplicationDeadlinePassed = $derived.by(() => {
		return eligibility.reason?.includes('application deadline has passed');
	});

	/**
	 * Get the Lucide icon component for the current next_step
	 */
	function getIconComponent(nextStep: string | null | undefined) {
		if (!nextStep) return AlertCircle;

		const iconMap: Record<string, typeof AlertCircle> = {
			request_invitation: Mail,
			become_member: UserPlus,
			complete_questionnaire: ClipboardList,
			wait_for_questionnaire_evaluation: Clock,
			wait_to_retake_questionnaire: XCircle,
			wait_for_event_to_open: Bell,
			join_waitlist: Users,
			wait_for_open_spot: Clock,
			purchase_ticket: Ticket,
			rsvp: AlertCircle,
			complete_profile: UserCircle
		};

		return iconMap[nextStep] || AlertCircle;
	}

	/**
	 * Get the variant (color scheme) based on next_step
	 */
	function getVariant(
		nextStep: string | null | undefined
	): 'warning' | 'info' | 'destructive' | 'muted' {
		if (!nextStep) return 'muted';

		// Info (waiting states)
		if (
			nextStep === 'wait_for_questionnaire_evaluation' ||
			nextStep === 'wait_for_event_to_open' ||
			nextStep === 'wait_for_open_spot'
		) {
			return 'info';
		}

		// Warning (actionable profile completion)
		if (nextStep === 'complete_profile') {
			return 'warning';
		}

		// Destructive (hard blockers)
		if (nextStep === 'wait_to_retake_questionnaire' || !eligibility.allowed) {
			// Check if it's a dead end (event finished, sold out, etc.)
			if (
				eligibility.reason?.includes('finished') ||
				eligibility.reason?.includes('Sold out') ||
				eligibility.reason?.includes('deadline has passed')
			) {
				return 'muted';
			}
			return 'destructive';
		}

		// Warning (actionable states)
		return 'warning';
	}

	/**
	 * Get header text based on reason or next_step
	 */
	function getHeaderText(): string {
		if (eligibility.reason) {
			// Extract the first sentence or key phrase
			const reason = eligibility.reason;

			// Map common reasons to friendly headers
			if (reason.includes('Only members')) return m['ineligibilityMessage.membersOnly']();
			if (reason.includes('invitation')) return m['ineligibilityMessage.invitationRequired']();
			if (reason.includes('Questionnaire has not been filled'))
				return m['ineligibilityMessage.questionnaireRequired']();
			if (reason.includes('Waiting for questionnaire'))
				return m['ineligibilityMessage.questionnaireUnderReview']();
			if (reason.includes('Questionnaire evaluation was insufficient'))
				return m['ineligibilityMessage.questionnaireNotPassed']();
			if (reason.includes('full profile') || reason.includes('Requires full profile'))
				return m['ineligibilityMessage.completeProfile']?.() ?? 'Complete your profile';
			if (reason.includes('Event is full') || reason === 'Event is full.')
				return m['ineligibilityMessage.eventFull']();
			if (reason.includes('Sold out')) return m['ineligibilityMessage.soldOut']();
			if (reason.includes('not open')) return m['ineligibilityMessage.registrationNotOpen']();
			if (reason.includes('finished')) return m['ineligibilityMessage.eventEnded']();
			if (reason.includes('application deadline has passed'))
				return (
					m['ineligibilityMessage.applicationDeadlinePassed']?.() ?? 'Application deadline passed'
				);
			if (reason.includes('RSVP deadline has passed') || reason.includes('deadline has passed'))
				return m['ineligibilityMessage.rsvpDeadlinePassed']();
			if (reason.includes('Tickets are not currently on sale'))
				return m['ineligibilityMessage.ticketsNotAvailable']();

			// Fallback: use the reason as-is
			return reason;
		}

		// No reason provided, use next_step as hint
		if (eligibility.next_step === 'become_member') return m['ineligibilityMessage.membersOnly']();
		if (eligibility.next_step === 'request_invitation')
			return m['ineligibilityMessage.invitationRequired']();
		if (eligibility.next_step === 'complete_questionnaire')
			return m['ineligibilityMessage.questionnaireRequired']();
		if (eligibility.next_step === 'complete_profile')
			return m['ineligibilityMessage.completeProfile']?.() ?? 'Complete your profile';
		if (eligibility.next_step === 'join_waitlist') return m['ineligibilityMessage.eventFull']();
		if (eligibility.next_step === 'wait_for_open_spot')
			return m['ineligibilityMessage.onWaitlist']();

		return m['ineligibilityMessage.notEligible']();
	}

	/**
	 * Get additional explanatory text beyond the reason
	 */
	function getExplanationText(): string | null {
		const nextStep = eligibility.next_step;

		if (nextStep === 'become_member') {
			return m['ineligibilityMessage.membersOnlyExplanation']({ organizationName });
		}

		if (nextStep === 'request_invitation') {
			return m['ineligibilityMessage.invitationRequiredExplanation']();
		}

		if (nextStep === 'complete_questionnaire') {
			return m['ineligibilityMessage.questionnaireRequiredExplanation']();
		}

		if (nextStep === 'wait_for_questionnaire_evaluation') {
			return m['ineligibilityMessage.questionnaireUnderReviewExplanation']();
		}

		if (nextStep === 'wait_to_retake_questionnaire') {
			return m['ineligibilityMessage.questionnaireNotPassedExplanation']();
		}

		if (nextStep === 'join_waitlist') {
			return m['ineligibilityMessage.eventFullExplanation']();
		}

		if (nextStep === 'wait_for_open_spot') {
			return m['ineligibilityMessage.onWaitlistExplanation']();
		}

		if (nextStep === 'wait_for_event_to_open') {
			return m['ineligibilityMessage.registrationNotOpenExplanation']();
		}

		// For dead ends (no next_step or no action possible)
		if (!nextStep) {
			if (eligibility.reason?.includes('finished')) {
				return m['ineligibilityMessage.eventEndedExplanation']();
			}

			if (eligibility.reason?.includes('Sold out')) {
				return m['ineligibilityMessage.soldOutExplanation']();
			}

			if (eligibility.reason?.includes('application deadline has passed')) {
				return (
					m['ineligibilityMessage.applicationDeadlinePassedExplanation']?.() ??
					'The deadline to apply for this event has passed. Applications are no longer accepted.'
				);
			}

			if (eligibility.reason?.includes('deadline has passed')) {
				return m['ineligibilityMessage.rsvpDeadlinePassedExplanation']();
			}
		}

		return null;
	}

	/**
	 * Get the variant classes based on variant
	 */
	function getVariantClasses(variant: 'warning' | 'info' | 'destructive' | 'muted'): string {
		const classes = {
			warning:
				'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-100',
			info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100',
			destructive:
				'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100',
			muted:
				'border-muted-foreground/20 bg-muted/50 text-muted-foreground dark:border-muted-foreground/10'
		};

		return classes[variant];
	}

	// Computed values
	let IconComponent = $derived(getIconComponent(eligibility.next_step));
	let variant = $derived(getVariant(eligibility.next_step));
	let headerText = $derived(getHeaderText());
	let explanationText = $derived(getExplanationText());
</script>

<!--
  Ineligibility Message Component

  Displays comprehensive, actionable messaging when users are not eligible
  to RSVP or purchase tickets for an event.

  @component
  @example
  <IneligibilityMessage
    eligibility={eligibilityStatus}
    eventId={event.id}
    eventSlug={event.slug}
    eventName={event.name}
    organizationSlug={event.organization.slug}
    organizationName={event.organization.name}
  />
-->
<div
	class={cn('rounded-lg border p-4', getVariantClasses(variant), className)}
	role="status"
	aria-live="polite"
	aria-atomic="true"
>
	<!-- Icon and Header -->
	<div class="flex items-start gap-3">
		<IconComponent class="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
		<div class="flex-1 space-y-3">
			<div>
				<h3 class="text-base font-semibold">{headerText}</h3>
				{#if explanationText}
					<p class="mt-1 text-sm">{explanationText}</p>
				{/if}
			</div>

			<!-- Additional Details -->
			{#if eligibility.questionnaires_missing && eligibility.questionnaires_missing.length > 0}
				<div class="flex items-center gap-2 text-sm">
					<ClipboardList class="h-4 w-4" aria-hidden="true" />
					<p>
						{eligibility.questionnaires_missing.length}
						{eligibility.questionnaires_missing.length === 1
							? m['ineligibilityMessage.questionnaireRequired_singular']()
							: m['ineligibilityMessage.questionnaireRequired_plural']()}
					</p>
				</div>
			{/if}

			{#if eligibility.questionnaires_pending_review && eligibility.questionnaires_pending_review.length > 0}
				<div class="flex items-center gap-2 text-sm">
					<Clock class="h-4 w-4" aria-hidden="true" />
					<p>
						{eligibility.questionnaires_pending_review.length}
						{eligibility.questionnaires_pending_review.length === 1
							? m['ineligibilityMessage.questionnairePendingReview_singular']()
							: m['ineligibilityMessage.questionnairePendingReview_plural']()}
					</p>
				</div>
			{/if}

			{#if eligibility.questionnaires_failed && eligibility.questionnaires_failed.length > 0}
				<div class="flex items-center gap-2 text-sm">
					<XCircle class="h-4 w-4" aria-hidden="true" />
					<p>
						{eligibility.questionnaires_failed.length}
						{eligibility.questionnaires_failed.length === 1
							? m['ineligibilityMessage.questionnaireFailed_singular']()
							: m['ineligibilityMessage.questionnaireFailed_plural']()}
					</p>
				</div>
			{/if}

			<!-- Missing Profile Fields -->
			{#if eligibility.missing_profile_fields && eligibility.missing_profile_fields.length > 0}
				<div class="space-y-1.5">
					<p class="text-sm font-medium">
						{m['ineligibilityMessage.missingProfileFields']?.() ??
							'Please add the following to your profile:'}
					</p>
					<ul class="space-y-1 text-sm opacity-80">
						{#each eligibility.missing_profile_fields as field}
							<li class="flex items-center gap-2">
								<span>•</span>
								<span>{getMissingProfileFieldLabel(field)}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if eligibility.retry_on}
				<RetryCountdown retryOn={eligibility.retry_on} />
			{/if}

			<!-- Application Deadline Display -->
			{#if shouldShowDeadline && applyBefore}
				<div
					class="flex items-center gap-2 rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-800 dark:bg-orange-950/30 dark:text-orange-200"
				>
					<Calendar class="h-4 w-4 shrink-0" aria-hidden="true" />
					<span>
						<strong
							>{m['ineligibilityMessage.applicationDeadline']?.() ??
								'Application deadline'}:</strong
						>
						{formatDeadline(applyBefore)}
					</span>
				</div>
			{/if}

			<!-- Action Button -->
			{#if eligibility.next_step || (eventTokenDetails && eventTokenDetails.grants_invitation)}
				<div class="pt-1">
					<IneligibilityActionButton
						nextStep={eligibility.next_step}
						{eventId}
						{eventSlug}
						{organizationSlug}
						{eventTokenDetails}
						questionnaireIds={eligibility.questionnaires_missing}
					/>
				</div>
			{/if}
		</div>
	</div>
</div>
