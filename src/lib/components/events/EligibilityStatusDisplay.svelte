<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventUserEligibility, EventTokenSchema } from '$lib/api/generated/types.gen';
	import {
		getEligibilityExplanation,
		formatRetryDate,
		getNextStepMessage,
		getMissingProfileFieldLabel
	} from '$lib/utils/eligibility';
	import {
		CheckCircle2,
		XCircle,
		AlertCircle,
		Clock,
		ClipboardList,
		Mail,
		UserPlus,
		ListPlus,
		Bell,
		ArrowUpCircle,
		Calendar,
		ShieldCheck,
		UserCircle
	} from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import IneligibilityActionButton from './IneligibilityActionButton.svelte';

	interface Props {
		eligibility: EventUserEligibility;
		eventId?: string;
		eventSlug?: string;
		organizationSlug?: string;
		organizationName?: string;
		eventName?: string;
		eventTokenDetails?: EventTokenSchema | null;
		applyBefore?: string | null;
		onInvitationRequestSuccess?: () => void;
		onWhitelistRequestSuccess?: () => void;
		class?: string;
	}

	let {
		eligibility,
		eventId,
		eventSlug,
		organizationSlug,
		organizationName,
		eventName,
		eventTokenDetails,
		applyBefore,
		onInvitationRequestSuccess,
		onWhitelistRequestSuccess,
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

	// Get icon component based on next_step
	let IconComponent = $derived.by(() => {
		if (eligibility.allowed) return CheckCircle2;
		if (!eligibility.next_step) return XCircle;

		const iconMap = {
			rsvp: CheckCircle2,
			purchase_ticket: CheckCircle2,
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

		return iconMap[eligibility.next_step] || AlertCircle;
	});

	// Get color variant based on allowed status
	let variant = $derived(eligibility.allowed ? 'success' : 'warning');

	// Format retry date if applicable
	let retryText = $derived.by(() => {
		if (eligibility.retry_on) {
			return formatRetryDate(eligibility.retry_on);
		}
		return null;
	});
</script>

<div
	class={cn(
		'rounded-lg border-2 p-4',
		variant === 'success' && 'border-green-500/30 bg-green-500/5',
		variant === 'warning' && 'border-yellow-500/30 bg-yellow-500/5',
		className
	)}
	role="status"
	aria-live="polite"
>
	<div class="flex gap-3">
		<!-- Icon -->
		<div
			class={cn(
				'shrink-0',
				variant === 'success' && 'text-green-600 dark:text-green-400',
				variant === 'warning' && 'text-yellow-600 dark:text-yellow-400'
			)}
		>
			<IconComponent class="h-6 w-6" aria-hidden="true" />
		</div>

		<!-- Content -->
		<div class="flex-1 space-y-2">
			<!-- Main Message -->
			<div class="font-semibold">
				{getEligibilityExplanation(eligibility)}
			</div>

			<!-- Next Step Explanation -->
			{#if eligibility.next_step && !eligibility.allowed}
				<div class="text-sm text-muted-foreground">
					{getNextStepMessage(eligibility.next_step)}
				</div>
			{/if}

			<!-- Missing Questionnaires -->
			{#if eligibility.questionnaires_missing && eligibility.questionnaires_missing.length > 0}
				<div class="mt-2 flex items-center gap-2 text-sm">
					<ClipboardList class="h-4 w-4" aria-hidden="true" />
					<p>
						{eligibility.questionnaires_missing.length}
						{eligibility.questionnaires_missing.length === 1 ? 'questionnaire' : 'questionnaires'}
						required
					</p>
				</div>
			{/if}

			<!-- Pending Review Questionnaires -->
			{#if eligibility.questionnaires_pending_review && eligibility.questionnaires_pending_review.length > 0}
				<div class="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
					<Clock class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
					<span>
						{eligibility.questionnaires_pending_review.length} questionnaire{eligibility
							.questionnaires_pending_review.length === 1
							? ''
							: 's'} pending review
					</span>
				</div>
			{/if}

			<!-- Failed Questionnaires -->
			{#if eligibility.questionnaires_failed && eligibility.questionnaires_failed.length > 0}
				<div class="mt-2 flex items-center gap-2 text-sm text-destructive">
					<XCircle class="h-4 w-4" aria-hidden="true" />
					<p>
						{eligibility.questionnaires_failed.length}
						{eligibility.questionnaires_failed.length === 1 ? 'questionnaire' : 'questionnaires'} failed
					</p>
				</div>
				{#if retryText}
					<div class="mt-2 text-sm text-muted-foreground">
						You can retry {retryText}
					</div>
				{/if}
			{/if}

			<!-- Missing Profile Fields -->
			{#if eligibility.missing_profile_fields && eligibility.missing_profile_fields.length > 0}
				<div class="mt-2 space-y-1.5">
					<p class="text-sm font-medium">
						{m['eligibilityStatusDisplay.missingProfileFields']?.() ??
							'Please add the following to your profile:'}
					</p>
					<ul class="space-y-1 text-sm text-muted-foreground">
						{#each eligibility.missing_profile_fields as field}
							<li class="flex items-center gap-2">
								<span class="text-primary">•</span>
								<span>{getMissingProfileFieldLabel(field)}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Retry Date -->
			{#if retryText && !eligibility.questionnaires_failed}
				<div class="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
					<Clock class="h-4 w-4 shrink-0" aria-hidden="true" />
					<span>{m['eligibilityStatusDisplay.available']()} {retryText}</span>
				</div>
			{/if}

			<!-- Application Deadline Display -->
			{#if shouldShowDeadline && applyBefore}
				<div
					class="mt-2 flex items-center gap-2 rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-800 dark:bg-orange-950/30 dark:text-orange-200"
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
			{#if (eligibility.next_step || (eventTokenDetails && eventTokenDetails.grants_invitation)) && !eligibility.allowed && eventId && eventSlug && organizationSlug}
				<div class="mt-3">
					<IneligibilityActionButton
						nextStep={eligibility.next_step}
						{eventId}
						{eventSlug}
						{organizationSlug}
						{organizationName}
						{eventName}
						{eventTokenDetails}
						questionnaireIds={eligibility.questionnaires_missing}
						retryOn={eligibility.retry_on}
						{onInvitationRequestSuccess}
						{onWhitelistRequestSuccess}
					/>
				</div>
			{/if}
		</div>
	</div>
</div>
