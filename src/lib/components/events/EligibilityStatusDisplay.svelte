<script lang="ts">
	import type { EventUserEligibility } from '$lib/api/generated/types.gen';
	import {
		getEligibilityExplanation,
		formatRetryDate,
		getNextStepMessage
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
		Bell
	} from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import IneligibilityActionButton from './IneligibilityActionButton.svelte';

	interface Props {
		eligibility: EventUserEligibility;
		eventId?: string;
		eventSlug?: string;
		organizationSlug?: string;
		eventName?: string;
		class?: string;
	}

	let {
		eligibility,
		eventId,
		eventSlug,
		organizationSlug,
		eventName,
		class: className
	}: Props = $props();

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
			become_member: UserPlus,
			join_waitlist: ListPlus,
			wait_for_event_to_open: Bell
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

			<!-- Retry Date -->
			{#if retryText && !eligibility.questionnaires_failed}
				<div class="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
					<Clock class="h-4 w-4 shrink-0" aria-hidden="true" />
					<span>Available {retryText}</span>
				</div>
			{/if}

			<!-- Action Button -->
			{#if eligibility.next_step && !eligibility.allowed && eventId && eventSlug && organizationSlug}
				<div class="mt-3">
					<IneligibilityActionButton
						nextStep={eligibility.next_step}
						{eventId}
						{eventSlug}
						{organizationSlug}
						{eventName}
						questionnaireIds={eligibility.questionnaires_missing}
						retryOn={eligibility.retry_on}
					/>
				</div>
			{/if}
		</div>
	</div>
</div>
