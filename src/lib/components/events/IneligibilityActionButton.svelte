<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { NextStep, EventTokenSchema } from '$lib/api/generated/types.gen';
	import { getActionButtonText, isActionDisabled } from '$lib/utils/eligibility';
	import { cn } from '$lib/utils/cn';
	import { Button } from '$lib/components/ui/button';
	import RequestInvitationButton from './RequestInvitationButton.svelte';
	import ClaimInvitationButton from './ClaimInvitationButton.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
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
		nextStep?: NextStep | null;
		eventId: string;
		eventSlug: string;
		organizationSlug: string;
		questionnaireIds?: string[] | null;
		retryOn?: string | null;
		disabled?: boolean;
		eventName?: string;
		eventTokenDetails?: EventTokenSchema | null;
		class?: string;
	}

	let {
		nextStep,
		eventId,
		eventSlug,
		organizationSlug,
		questionnaireIds,
		disabled = false,
		eventName = '',
		eventTokenDetails,
		class: className
	}: Props = $props();

	const isAuthenticated = $derived(!!authStore.accessToken);

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
		if (disabled || (nextStep && isActionDisabled(nextStep)) || isLoading || showSuccess) {
			return;
		}

		// If no next step defined, do nothing
		if (!nextStep) {
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
			if (questionnaireIds && questionnaireIds.length > 0 && organizationSlug && eventSlug) {
				// Navigate to first questionnaire submission page
				window.location.href = `/events/${organizationSlug}/${eventSlug}/questionnaire/${questionnaireIds[0]}`;
			} else {
				// Fallback: navigate back to event if missing data
				if (organizationSlug && eventSlug) {
					window.location.href = `/events/${organizationSlug}/${eventSlug}`;
				}
			}
			return;
		}

		// request_invitation is handled by RequestInvitationButton component
		// No action needed here
		if (nextStep === 'request_invitation') {
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
	let IconComponent = $derived(nextStep ? getIconComponent(nextStep) : Check);
	let buttonText = $derived(
		showSuccess
			? m['ineligibilityActionButton.requestSent']()
			: nextStep
				? getActionButtonText(nextStep)
				: 'Continue'
	);
	let buttonVariant = $derived(nextStep ? getButtonVariant(nextStep) : 'outline');
	let isButtonDisabled = $derived(
		disabled || (nextStep && isActionDisabled(nextStep)) || isLoading || showSuccess
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
    eventName={event.name}
  />
-->
<div class={cn('space-y-2', className)}>
	<!-- Use ClaimInvitationButton if token is present and grants invitation (highest priority) -->
	{#if eventTokenDetails && eventTokenDetails.grants_invitation}
		<ClaimInvitationButton
			tokenId={eventTokenDetails.id || ''}
			tokenDetails={eventTokenDetails}
			class="w-full"
		/>
		<!-- Use RequestInvitationButton for invitation requests without token -->
	{:else if nextStep === 'request_invitation'}
		<RequestInvitationButton
			{eventId}
			eventName={eventName || 'this event'}
			{isAuthenticated}
			hasAlreadyRequested={false}
			class="w-full"
		/>
	{:else}
		<Button
			variant={buttonVariant}
			disabled={isButtonDisabled}
			onclick={handleClick}
			class="w-full"
		>
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
				{m['ineligibilityActionButton.success']()}
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
	{/if}
</div>
