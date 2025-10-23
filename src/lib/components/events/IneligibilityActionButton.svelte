<script lang="ts">
	import type { NextStep } from '$lib/api/generated/types.gen';
	import { getActionButtonText, isActionDisabled } from '$lib/utils/eligibility';
	import { cn } from '$lib/utils/cn';
	import { Button } from '$lib/components/ui/button';
	import {
		Check,
		ClipboardList,
		Clock,
		Mail,
		UserPlus,
		ListPlus,
		Bell,
		Ticket,
		Loader2
	} from 'lucide-svelte';

	interface Props {
		nextStep: NextStep;
		eventId: string;
		eventSlug: string;
		organizationSlug: string;
		questionnaireIds?: string[] | null;
		retryOn?: string | null;
		disabled?: boolean;
		class?: string;
	}

	let {
		nextStep,
		eventId,
		organizationSlug,
		questionnaireIds,
		disabled = false,
		class: className
	}: Props = $props();

	let isLoading = $state(false);
	let showSuccess = $state(false);
	let showError = $state(false);
	let errorMessage = $state('');

	/**
	 * Get the Lucide icon component for the current next_step
	 */
	function getIconComponent(step: NextStep) {
		const iconMap: Record<NextStep, typeof Check> = {
			rsvp: Check,
			purchase_ticket: Ticket,
			complete_questionnaire: ClipboardList,
			wait_for_questionnaire_evaluation: Clock,
			wait_to_retake_questionnaire: Clock,
			request_invitation: Mail,
			become_member: UserPlus,
			join_waitlist: ListPlus,
			wait_for_event_to_open: Bell
		};

		return iconMap[step] || Check;
	}

	/**
	 * Get the button variant based on next_step
	 */
	function getButtonVariant(
		step: NextStep
	): 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' {
		// Disabled states use secondary (muted)
		if (isActionDisabled(step)) {
			return 'secondary';
		}

		// Primary actions
		if (
			step === 'rsvp' ||
			step === 'purchase_ticket' ||
			step === 'complete_questionnaire' ||
			step === 'request_invitation' ||
			step === 'become_member' ||
			step === 'join_waitlist'
		) {
			return 'default';
		}

		return 'outline';
	}

	/**
	 * Handle button click action
	 */
	async function handleClick() {
		// Disabled states do nothing
		if (disabled || isActionDisabled(nextStep) || isLoading || showSuccess) {
			return;
		}

		// Clear previous errors
		showError = false;
		errorMessage = '';

		// Navigation actions
		if (nextStep === 'become_member') {
			window.location.href = `/org/${organizationSlug}`;
			return;
		}

		if (nextStep === 'complete_questionnaire') {
			if (questionnaireIds && questionnaireIds.length > 0) {
				// Navigate to first questionnaire
				window.location.href = `/questionnaires/${questionnaireIds[0]}`;
			} else {
				// Fallback: navigate to questionnaires list
				window.location.href = '/account/questionnaires';
			}
			return;
		}

		// API actions (stub for now - Phase 2)
		if (nextStep === 'request_invitation') {
			isLoading = true;
			// TODO Phase 2: Implement actual API call
			// Simulate API call for now
			setTimeout(() => {
				isLoading = false;
				showSuccess = true;
				console.log('Request invitation for event:', eventId);
			}, 1000);
			return;
		}

		if (nextStep === 'join_waitlist') {
			isLoading = true;
			// TODO Phase 2: Backend not ready - show "coming soon" message
			setTimeout(() => {
				isLoading = false;
				showError = true;
				errorMessage = 'Waitlist feature coming soon! Backend implementation in progress.';
			}, 500);
			return;
		}

		// Other actions (log for now)
		console.log('Action clicked:', nextStep, { eventId, organizationSlug });
	}

	// Computed values
	let IconComponent = $derived(getIconComponent(nextStep));
	let buttonText = $derived(showSuccess ? 'Request Sent' : getActionButtonText(nextStep));
	let buttonVariant = $derived(getButtonVariant(nextStep));
	let isButtonDisabled = $derived(
		disabled || isActionDisabled(nextStep) || isLoading || showSuccess
	);
</script>

<!--
  Ineligibility Action Button Component

  Smart CTA button that handles navigation and API calls based on next_step.

  @component
  @example
  <IneligibilityActionButton
    nextStep="request_invitation"
    eventId={event.id}
    eventSlug={event.slug}
    organizationSlug={org.slug}
  />
-->
<div class={cn('space-y-2', className)}>
	<Button variant={buttonVariant} disabled={isButtonDisabled} onclick={handleClick} class="w-full">
		{#if isLoading}
			<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
		{:else if showSuccess}
			<Check class="h-5 w-5" aria-hidden="true" />
		{:else}
			<IconComponent class="h-5 w-5" aria-hidden="true" />
		{/if}
		<span>{buttonText}</span>
	</Button>

	<!-- Success Message -->
	{#if showSuccess}
		<div
			class="rounded-md bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950/50 dark:text-green-100"
			role="status"
			aria-live="polite"
		>
			{#if nextStep === 'request_invitation'}
				Invitation requested! We'll notify you when organizers respond.
			{/if}
		</div>
	{/if}

	<!-- Error Message -->
	{#if showError && errorMessage}
		<div
			class="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
			role="alert"
			aria-live="assertive"
		>
			{errorMessage}
		</div>
	{/if}
</div>
