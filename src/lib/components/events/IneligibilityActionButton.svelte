<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { NextStep, EventTokenSchema } from '$lib/api/generated/types.gen';
	import { getActionButtonText, isActionDisabled } from '$lib/utils/eligibility';
	import { cn } from '$lib/utils/cn';
	import { Button } from '$lib/components/ui/button';
	import RequestInvitationButton from './RequestInvitationButton.svelte';
	import RequestWhitelistButton from './RequestWhitelistButton.svelte';
	import ClaimInvitationButton from './ClaimInvitationButton.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { eventpublicattendanceJoinWaitlist, eventpublicattendanceLeaveWaitlist } from '$lib/api';
	import {
		Check,
		ClipboardList,
		Clock,
		Mail,
		UserPlus,
		ListPlus,
		Bell,
		Ticket,
		Loader2,
		ArrowUpCircle,
		X,
		ShieldCheck,
		UserCircle
	} from 'lucide-svelte';

	interface Props {
		nextStep?: NextStep | null;
		eventId: string;
		eventSlug: string;
		organizationSlug: string;
		organizationName?: string;
		questionnaireIds?: string[] | null;
		retryOn?: string | null;
		disabled?: boolean;
		eventName?: string;
		eventTokenDetails?: EventTokenSchema | null;
		onInvitationRequestSuccess?: () => void;
		onWhitelistRequestSuccess?: () => void;
		class?: string;
	}

	let {
		nextStep,
		eventId,
		eventSlug,
		organizationSlug,
		organizationName = '',
		questionnaireIds,
		disabled = false,
		eventName = '',
		eventTokenDetails,
		onInvitationRequestSuccess,
		onWhitelistRequestSuccess,
		class: className
	}: Props = $props();

	const isAuthenticated = $derived(!!authStore.accessToken);

	let isLoading = $state(false);
	let isLeavingWaitlist = $state(false);
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
			wait_for_invitation_approval: Clock,
			become_member: UserPlus,
			join_waitlist: ListPlus,
			wait_for_open_spot: Clock,
			wait_for_event_to_open: Bell,
			upgrade_membership: ArrowUpCircle,
			request_whitelist: ShieldCheck,
			wait_for_whitelist_approval: Clock,
			complete_profile: UserCircle
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
			step === 'join_waitlist' ||
			step === 'request_whitelist' ||
			step === 'complete_profile'
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

		if (nextStep === 'complete_profile') {
			// Navigate to profile settings page with redirect back to event
			const eventUrl =
				organizationSlug && eventSlug ? `/events/${organizationSlug}/${eventSlug}` : '';
			const redirectParam = eventUrl ? `?redirect=${encodeURIComponent(eventUrl)}` : '';
			window.location.href = `/account/profile${redirectParam}`;
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

		// request_whitelist is handled by RequestWhitelistButton component
		// No action needed here
		if (nextStep === 'request_whitelist') {
			return;
		}

		if (nextStep === 'join_waitlist') {
			isLoading = true;
			try {
				const response = await eventpublicattendanceJoinWaitlist({
					path: { event_id: eventId },
					headers: {
						Authorization: `Bearer ${authStore.accessToken}`
					}
				});

				if (response.error) {
					showError = true;
					const errorDetail =
						typeof response.error === 'object' &&
						response.error !== null &&
						'detail' in response.error
							? (response.error.detail as string)
							: m['ineligibilityActionButton.waitlist_error']();
					errorMessage = errorDetail;
				} else {
					showSuccess = true;
					// Optionally refresh the page or update UI to reflect waitlist status
					setTimeout(() => {
						window.location.reload();
					}, 1500);
				}
			} catch (err) {
				showError = true;
				errorMessage =
					err instanceof Error ? err.message : m['ineligibilityActionButton.waitlist_error']();
			} finally {
				isLoading = false;
			}
			return;
		}

		// Other actions (log for now)
		console.log('Action clicked:', nextStep, { eventId, organizationSlug });
	}

	/**
	 * Handle leaving the waitlist
	 */
	async function handleLeaveWaitlist() {
		if (!confirm(m['ineligibilityActionButton.confirmLeaveWaitlist']())) {
			return;
		}

		isLeavingWaitlist = true;
		showError = false;
		errorMessage = '';

		try {
			const response = await eventpublicattendanceLeaveWaitlist({
				path: { event_id: eventId },
				headers: {
					Authorization: `Bearer ${authStore.accessToken}`
				}
			});

			if (response.error) {
				showError = true;
				const errorDetail =
					typeof response.error === 'object' &&
					response.error !== null &&
					'detail' in response.error
						? (response.error.detail as string)
						: m['ineligibilityActionButton.leaveWaitlist_error']();
				errorMessage = errorDetail;
			} else {
				// Success - reload the page to update the status
				window.location.reload();
			}
		} catch (err) {
			showError = true;
			errorMessage =
				err instanceof Error ? err.message : m['ineligibilityActionButton.leaveWaitlist_error']();
		} finally {
			isLeavingWaitlist = false;
		}
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
			onSuccess={onInvitationRequestSuccess}
			class="w-full"
		/>
	{:else if nextStep === 'wait_for_invitation_approval'}
		<!-- Pending invitation approval status -->
		<Button variant="secondary" disabled={true} class="w-full">
			<Clock class="h-5 w-5" aria-hidden="true" />
			<span>{buttonText}</span>
		</Button>
	{:else if nextStep === 'request_whitelist'}
		<!-- Use RequestWhitelistButton for whitelist/verification requests -->
		<RequestWhitelistButton
			{organizationSlug}
			{organizationName}
			{eventId}
			{isAuthenticated}
			hasAlreadyRequested={false}
			onSuccess={onWhitelistRequestSuccess}
			class="w-full"
		/>
	{:else if nextStep === 'wait_for_whitelist_approval'}
		<!-- Pending whitelist/verification approval status -->
		<Button variant="secondary" disabled={true} class="w-full">
			<Clock class="h-5 w-5" aria-hidden="true" />
			<span>{buttonText}</span>
		</Button>
	{:else if nextStep === 'wait_for_open_spot'}
		<!-- Special layout for waitlist status with Leave button below -->
		<div class="space-y-2">
			<Button variant="secondary" disabled={true} class="w-full">
				<Clock class="h-5 w-5" aria-hidden="true" />
				<span>{buttonText}</span>
			</Button>
			<Button
				variant="destructive"
				disabled={isLeavingWaitlist}
				onclick={handleLeaveWaitlist}
				class="w-full"
			>
				{#if isLeavingWaitlist}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				{:else}
					<X class="h-4 w-4" aria-hidden="true" />
				{/if}
				<span>{m['ineligibilityActionButton.leave']()}</span>
			</Button>
		</div>
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
