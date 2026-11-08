<script lang="ts">
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { AlertCircle } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { eventpublicdetailsGetEvent, eventpublicattendanceGetQuestionnaire } from '$lib/api';
	import { Button } from '$lib/components/ui/button';
	import { withReturnUrl } from '$lib/utils/safe-redirect';
	import type { PassQuestionnaireStep } from '$lib/utils/series-pass-questionnaires';

	interface Props {
		step: PassQuestionnaireStep;
		/** Same-origin path to come back to after the submission. */
		returnUrl: string;
	}

	const { step, returnUrl }: Props = $props();

	// A questionnaire is answered through ITS event, so this row resolves that
	// event (route slugs, display name) and the questionnaire (its name). One
	// query per row keeps a slow or failing row from hiding the others.
	const query = createQuery(() => ({
		queryKey: ['series-pass-questionnaire-step', step.eventId, step.questionnaireId] as const,
		queryFn: async () => {
			const [eventRes, questionnaireRes] = await Promise.all([
				eventpublicdetailsGetEvent({ path: { event_id: step.eventId } }),
				eventpublicattendanceGetQuestionnaire({
					path: { event_id: step.eventId, questionnaire_id: step.questionnaireId }
				})
			]);
			if (eventRes.error || !eventRes.data) throw eventRes.error ?? new Error('event');
			if (questionnaireRes.error || !questionnaireRes.data) {
				throw questionnaireRes.error ?? new Error('questionnaire');
			}
			return {
				eventName: eventRes.data.name,
				eventSlug: eventRes.data.slug,
				orgSlug: eventRes.data.organization.slug,
				questionnaireName: questionnaireRes.data.name
			};
		}
	}));

	const href = $derived(
		query.data
			? withReturnUrl(
					resolve('/(public)/events/[org_slug]/[event_slug]/questionnaire/[id]', {
						org_slug: query.data.orgSlug,
						event_slug: query.data.eventSlug,
						id: step.questionnaireId
					}),
					returnUrl
				)
			: undefined
	);
</script>

<li class="flex flex-col gap-2 rounded-md border bg-background p-3 sm:flex-row sm:items-center">
	<div class="min-w-0 flex-1">
		{#if query.data}
			<p class="break-words text-sm font-semibold">{query.data.questionnaireName}</p>
			<p class="break-words text-xs text-muted-foreground">
				{m['seriesPass.questionnaires.forEvent']({ event: query.data.eventName })}
			</p>
		{:else if query.isError}
			<p class="flex items-center gap-1.5 text-sm text-foreground" role="alert">
				<AlertCircle class="h-4 w-4 shrink-0" aria-hidden="true" />
				{m['seriesPass.questionnaires.loadFailed']()}
			</p>
		{:else}
			<p class="text-sm text-muted-foreground" role="status">
				{m['seriesPass.questionnaires.loading']()}
			</p>
		{/if}
	</div>
	{#if query.data && href}
		<Button
			size="sm"
			{href}
			aria-label={m['seriesPass.questionnaires.completeNamed']({
				name: query.data.questionnaireName
			})}
			data-testid="pass-questionnaire-link"
		>
			{m['seriesPass.questionnaires.complete']()}
		</Button>
	{:else if query.isError}
		<Button size="sm" variant="outline" onclick={() => query.refetch()}>
			{m['seriesPass.questionnaires.retry']()}
		</Button>
	{/if}
</li>
