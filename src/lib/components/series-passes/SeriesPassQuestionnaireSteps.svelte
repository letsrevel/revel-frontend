<script lang="ts">
	import { tick } from 'svelte';
	import { ClipboardList } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { stepKey, type PassQuestionnaireStep } from '$lib/utils/series-pass-questionnaires';
	import SeriesPassQuestionnaireStepRow from './SeriesPassQuestionnaireStepRow.svelte';

	interface Props {
		steps: PassQuestionnaireStep[];
		/** Same-origin path to come back to after a submission (the page showing the pass). */
		returnUrl: string;
		/** Element id, so the buy button can point `aria-describedby` at this block. */
		id: string;
	}

	const { steps, returnUrl, id }: Props = $props();

	let heading = $state<HTMLElement | null>(null);

	// When an answered questionnaire drops out of the list, a screen-reader user
	// would otherwise lose their place: move focus back to the step heading.
	let previousCount = 0;
	$effect(() => {
		const count = steps.length;
		if (count > 0 && count < previousCount) {
			void tick().then(() => heading?.focus());
		}
		previousCount = count;
	});
</script>

<section
	{id}
	class="space-y-2 rounded-md border border-primary/30 bg-muted/40 p-3 text-left"
	aria-labelledby="{id}-heading"
	data-testid="pass-questionnaire-steps"
>
	<h3
		id="{id}-heading"
		bind:this={heading}
		tabindex="-1"
		class="flex items-center gap-2 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring"
	>
		<ClipboardList class="h-4 w-4 shrink-0" aria-hidden="true" />
		{m['seriesPass.questionnaires.heading']()}
	</h3>
	<p class="text-xs text-muted-foreground">
		{m['seriesPass.questionnaires.description']()}
	</p>
	<ul class="space-y-2">
		{#each steps as step (stepKey(step))}
			<SeriesPassQuestionnaireStepRow {step} {returnUrl} />
		{/each}
	</ul>
</section>
