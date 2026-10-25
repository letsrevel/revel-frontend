<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { ComponentProps } from 'svelte';
	import EssentialsStep from '../EssentialsStep.svelte';
	import DetailsStep from '../DetailsStep.svelte';
	import EventResources from '../EventResources.svelte';
	import ScheduleEditor from '../ScheduleEditor.svelte';
	import type { ScheduleRow } from '../schedule-rows';

	interface Props {
		essentialsProps: ComponentProps<typeof EssentialsStep>;
		detailsProps: ComponentProps<typeof DetailsStep>;
		/** Resources + schedule only exist once the event does. */
		eventId: string | null;
		organizationSlug: string;
		selectedResourceIds: string[];
		onResourcesChange: (ids: string[]) => void;
		scheduleRows: ScheduleRow[];
		eventStart: string;
		disabled: boolean;
	}

	let {
		essentialsProps,
		detailsProps,
		eventId,
		organizationSlug,
		selectedResourceIds,
		onResourcesChange,
		scheduleRows = $bindable(),
		eventStart,
		disabled
	}: Props = $props();

	// scroll-mt clears the sticky site header when a nav link jumps here;
	// tabindex=-1 + focus:outline-none lets the nav move focus into the section.
	const sectionClass = 'scroll-mt-[calc(var(--admin-sticky-top)+1rem)] focus:outline-none';
	const cardClass = `${sectionClass} rounded-lg border border-border bg-card p-4 md:p-6`;
</script>

<div class="max-w-3xl space-y-6">
	<section
		id="section-basics"
		tabindex="-1"
		aria-label={m['eventEditor.sectionBasics']()}
		class={cardClass}
	>
		<EssentialsStep {...essentialsProps} />
	</section>

	<section
		id="section-details"
		tabindex="-1"
		aria-label={m['eventEditor.sectionDetails']()}
		class={sectionClass}
	>
		<DetailsStep {...detailsProps} />
	</section>

	{#if eventId}
		<section
			id="section-resources"
			tabindex="-1"
			aria-label={m['eventEditor.sectionResources']()}
			class={cardClass}
		>
			<EventResources
				{organizationSlug}
				{eventId}
				{selectedResourceIds}
				onSelectionChange={onResourcesChange}
			/>
		</section>

		<section
			id="section-schedule"
			tabindex="-1"
			aria-label={m['eventEditor.sectionSchedule']()}
			class={cardClass}
		>
			<ScheduleEditor bind:rows={scheduleRows} {eventStart} {disabled} />
		</section>
	{/if}
</div>
