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
		XCircle
	} from 'lucide-svelte';
	import IneligibilityActionButton from './IneligibilityActionButton.svelte';
	import RetryCountdown from './RetryCountdown.svelte';

	interface Props {
		eligibility: EventUserEligibility;
		eventId: string;
		eventSlug: string;
		eventName: string;
		organizationSlug: string;
		organizationName: string;
		eventTokenDetails?: EventTokenSchema | null;
		class?: string;
	}

	let {
		eligibility,
		eventId,
		eventSlug,
		organizationSlug,
		organizationName,
		eventTokenDetails,
		class: className
	}: Props = $props();

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
			purchase_ticket: Ticket,
			rsvp: AlertCircle
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
		if (nextStep === 'wait_for_questionnaire_evaluation' || nextStep === 'wait_for_event_to_open') {
			return 'info';
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
			if (reason.includes('Only members')) return 'Members only';
			if (reason.includes('invitation')) return 'Invitation required';
			if (reason.includes('Questionnaire has not been filled')) return 'Questionnaire required';
			if (reason.includes('Waiting for questionnaire')) return 'Questionnaire under review';
			if (reason.includes('Questionnaire evaluation was insufficient'))
				return 'Questionnaire not passed';
			if (reason.includes('full')) return 'Event is full';
			if (reason.includes('Sold out')) return 'Sold out';
			if (reason.includes('not open')) return 'Registration not yet open';
			if (reason.includes('finished')) return 'Event has ended';
			if (reason.includes('deadline has passed')) return 'RSVP deadline passed';
			if (reason.includes('Tickets are not currently on sale')) return 'Tickets not available';

			// Fallback: use the reason as-is
			return reason;
		}

		// No reason provided, use next_step as hint
		if (eligibility.next_step === 'become_member') return 'Members only';
		if (eligibility.next_step === 'request_invitation') return 'Invitation required';
		if (eligibility.next_step === 'complete_questionnaire') return 'Questionnaire required';
		if (eligibility.next_step === 'join_waitlist') return 'Event is full';

		return 'Not eligible';
	}

	/**
	 * Get additional explanatory text beyond the reason
	 */
	function getExplanationText(): string | null {
		const nextStep = eligibility.next_step;

		if (nextStep === 'become_member') {
			return `This event is restricted to members of ${organizationName}. Join to RSVP!`;
		}

		if (nextStep === 'request_invitation') {
			return 'This is a private event. Request an invitation from the organizers.';
		}

		if (nextStep === 'complete_questionnaire') {
			return 'This event requires you to complete a questionnaire before RSVPing.';
		}

		if (nextStep === 'wait_for_questionnaire_evaluation') {
			return 'Your questionnaire is being reviewed by the organizers. Check back soon!';
		}

		if (nextStep === 'wait_to_retake_questionnaire') {
			return "Your questionnaire didn't meet the requirements. You can try again.";
		}

		if (nextStep === 'join_waitlist') {
			return 'All spots have been taken. Join the waitlist to be notified if space opens up.';
		}

		if (nextStep === 'wait_for_event_to_open') {
			return "RSVPs aren't open yet. Check back when registration begins.";
		}

		// For dead ends (no next_step or no action possible)
		if (!nextStep) {
			if (eligibility.reason?.includes('finished')) {
				return 'This event took place in the past. RSVPs are no longer available.';
			}

			if (eligibility.reason?.includes('Sold out')) {
				return 'All tickets have been sold. Check back later for additional releases.';
			}

			if (eligibility.reason?.includes('deadline has passed')) {
				return 'The deadline to RSVP has passed. Late RSVPs are not accepted.';
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
						{eligibility.questionnaires_missing.length === 1 ? 'questionnaire' : 'questionnaires'}
						required
					</p>
				</div>
			{/if}

			{#if eligibility.questionnaires_pending_review && eligibility.questionnaires_pending_review.length > 0}
				<div class="flex items-center gap-2 text-sm">
					<Clock class="h-4 w-4" aria-hidden="true" />
					<p>
						{eligibility.questionnaires_pending_review.length}
						{eligibility.questionnaires_pending_review.length === 1
							? 'questionnaire'
							: 'questionnaires'} pending review
					</p>
				</div>
			{/if}

			{#if eligibility.questionnaires_failed && eligibility.questionnaires_failed.length > 0}
				<div class="flex items-center gap-2 text-sm">
					<XCircle class="h-4 w-4" aria-hidden="true" />
					<p>
						{eligibility.questionnaires_failed.length}
						{eligibility.questionnaires_failed.length === 1 ? 'questionnaire' : 'questionnaires'} failed
					</p>
				</div>
			{/if}

			{#if eligibility.retry_on}
				<RetryCountdown retryOn={eligibility.retry_on} />
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
