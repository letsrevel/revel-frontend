<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createMutation } from '@tanstack/svelte-query';
	import { eventpublicattendanceSubmitQuestionnaire } from '$lib/api';
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft, Check } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import QuestionnaireFillForm from '$lib/components/questionnaires/QuestionnaireFillForm.svelte';
	import type { QuestionnaireSubmissionSchema } from '$lib/api/generated';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	// Set once the questionnaire is submitted and no evaluation is required — the user is
	// admitted immediately, so we show an inline confirmation instead of redirecting. (#441)
	let autoAccepted = $state(false);
	const isTicketed = $derived(!!data.event.requires_ticket);
	const eventUrl = $derived(`/events/${data.event.organization.slug}/${data.event.slug}`);

	// Submission mutation
	const submitMutation = createMutation(() => ({
		mutationFn: async (submission: QuestionnaireSubmissionSchema) => {
			const { data: result, error } = await eventpublicattendanceSubmitQuestionnaire({
				path: {
					event_id: data.event.id,
					questionnaire_id: data.questionnaire.id
				},
				body: submission
			});

			if (error || !result) {
				throw new Error(m['questionnaireSubmissionPage.error_submitFailed']());
			}

			return result;
		},
		onSuccess: (result) => {
			// The submit endpoint always returns a submission response; evaluation (when needed)
			// runs asynchronously. `requires_evaluation === false` means the user is admitted
			// immediately with no review.
			const requiresEvaluation =
				'requires_evaluation' in result ? result.requires_evaluation : true;

			if (!requiresEvaluation) {
				// No review needed — surface an inline "you're in, go buy/RSVP" confirmation
				// instead of silently redirecting.
				autoAccepted = true;
				return;
			}

			// Evaluation is pending — the organizers (or AI) will review the responses.
			toast.info(m['questionnaireSubmissionPage.toast_pending_title'](), {
				description: m['questionnaireSubmissionPage.toast_pending_description']()
			});
			goto(
				resolve('/(public)/events/[org_slug]/[event_slug]', {
					org_slug: data.event.organization.slug,
					event_slug: data.event.slug
				})
			);
		},
		onError: (error: Error) => {
			toast.error(m['questionnaireSubmissionPage.toast_error_title'](), {
				description: error.message || m['questionnaireSubmissionPage.toast_error_description']()
			});
		}
	}));

	const submitError = $derived(
		submitMutation.isError
			? submitMutation.error?.message || m['questionnaireSubmissionPage.error_alert_description']()
			: null
	);

	function goBackToEvent() {
		goto(
			resolve('/(public)/events/[org_slug]/[event_slug]', {
				org_slug: data.event.organization.slug,
				event_slug: data.event.slug
			})
		);
	}
</script>

<svelte:head>
	<title
		>{m['questionnaireSubmissionPage.pageTitle']({
			questionnaireName: data.questionnaire.name,
			eventName: data.event.name
		})}</title
	>
</svelte:head>

<div class="container mx-auto max-w-3xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<a
			href={resolve('/(public)/events/[org_slug]/[event_slug]', {
				org_slug: data.event.organization.slug,
				event_slug: data.event.slug
			})}
			class="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" />
			{m['questionnaireSubmissionPage.backToEvent']()}
		</a>
		<h1 class="text-3xl font-bold">{data.questionnaire.name}</h1>
		<p class="mt-2 text-muted-foreground">
			{m['questionnaireSubmissionPage.subtitle']({ eventName: data.event.name })}
		</p>
		{#if data.questionnaire.description}
			<div class="mt-4 rounded-lg border bg-muted/50 p-4">
				<MarkdownContent content={data.questionnaire.description} />
			</div>
		{/if}
	</div>

	{#if autoAccepted}
		<!-- Auto-accepted: no evaluation needed, the user is admitted immediately (#441) -->
		<div class="rounded-lg border bg-card p-8 text-center" role="status">
			<div
				class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
			>
				<Check class="h-6 w-6 text-primary" aria-hidden="true" />
			</div>
			<h2 class="text-2xl font-semibold">
				{m['questionnaireSubmissionPage.accepted_title']()}
			</h2>
			<p class="mx-auto mt-2 max-w-md text-muted-foreground">
				{isTicketed
					? m['questionnaireSubmissionPage.accepted_description_ticket']()
					: m['questionnaireSubmissionPage.accepted_description_rsvp']()}
			</p>
			<div class="mt-6">
				<Button href={eventUrl}>
					{isTicketed
						? m['questionnaireSubmissionPage.accepted_cta_ticket']()
						: m['questionnaireSubmissionPage.accepted_cta_rsvp']()}
				</Button>
			</div>
		</div>
	{:else}
		<QuestionnaireFillForm
			questionnaire={data.questionnaire}
			submitting={submitMutation.isPending}
			submitted={submitMutation.isSuccess}
			{submitError}
			onSubmit={(payload) => submitMutation.mutate(payload)}
			onCancel={goBackToEvent}
		/>
	{/if}
</div>
