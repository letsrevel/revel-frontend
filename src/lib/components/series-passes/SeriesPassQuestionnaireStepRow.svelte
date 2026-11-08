<script lang="ts">
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { AlertCircle } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import {
		passEventLookupOptions,
		passQuestionnaireNameOptions
	} from '$lib/queries/pass-questionnaire-lookups';
	import { Button } from '$lib/components/ui/button';
	import { withReturnUrl } from '$lib/utils/safe-redirect';
	import type { PassQuestionnaireStep } from '$lib/utils/series-pass-questionnaires';

	interface Props {
		step: PassQuestionnaireStep;
		/** Same-origin path to come back to after the submission. */
		returnUrl: string;
	}

	const { step, returnUrl }: Props = $props();

	// A questionnaire is answered through ITS event, so the row resolves that
	// event (route slugs, display name) and the questionnaire's name. Both
	// lookups are keyed by their own id only, so rows sharing an event or a
	// questionnaire share one request (see pass-questionnaire-lookups).
	const eventQuery = createQuery(() => passEventLookupOptions(step.eventId));
	const nameQuery = createQuery(() =>
		passQuestionnaireNameOptions(step.questionnaireId, step.eventId)
	);
	// Read BOTH results unconditionally: the adapter only notifies for properties
	// that were read, so short-circuiting on the first would miss the second
	// lookup resolving first.
	const loaded = $derived.by(() => {
		const event = eventQuery.data;
		const questionnaireName = nameQuery.data;
		return event && questionnaireName ? { event, questionnaireName } : undefined;
	});
	const event = $derived(loaded?.event);
	const questionnaireName = $derived(loaded?.questionnaireName);
	const failed = $derived.by(() => {
		const eventFailed = eventQuery.isError;
		const nameFailed = nameQuery.isError;
		return eventFailed || nameFailed;
	});
	function retry() {
		if (eventQuery.isError) void eventQuery.refetch();
		if (nameQuery.isError) void nameQuery.refetch();
	}

	const href = $derived(
		event
			? withReturnUrl(
					resolve('/(public)/events/[org_slug]/[event_slug]/questionnaire/[id]', {
						org_slug: event.orgSlug,
						event_slug: event.slug,
						id: step.questionnaireId
					}),
					returnUrl
				)
			: undefined
	);
</script>

<li class="flex flex-col gap-2 rounded-md border bg-background p-3 sm:flex-row sm:items-center">
	<div class="min-w-0 flex-1">
		{#if event && questionnaireName}
			<p class="break-words text-sm font-semibold">{questionnaireName}</p>
			<p class="break-words text-xs text-muted-foreground">
				{m['seriesPass.questionnaires.forEvent']({ event: event.name })}
			</p>
		{:else if failed}
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
	{#if event && questionnaireName && href}
		<Button
			size="sm"
			{href}
			aria-label={m['seriesPass.questionnaires.completeNamed']({
				name: questionnaireName
			})}
			data-testid="pass-questionnaire-link"
		>
			{m['seriesPass.questionnaires.complete']()}
		</Button>
	{:else if failed}
		<Button size="sm" variant="outline" onclick={retry}>
			{m['seriesPass.questionnaires.retry']()}
		</Button>
	{/if}
</li>
