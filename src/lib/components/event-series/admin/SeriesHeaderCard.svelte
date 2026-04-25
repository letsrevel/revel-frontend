<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		Pause,
		Play,
		Calendar,
		Settings,
		FileText,
		Repeat,
		CalendarX,
		RefreshCw,
		MoreHorizontal
	} from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import type { EventSeriesRecurrenceDetailSchema } from '$lib/api/generated/types.gen';
	import RecurrenceSummary from './RecurrenceSummary.svelte';
	import SeriesActionSheet from './SeriesActionSheet.svelte';
	import { formatEventDate } from '$lib/utils/date';

	interface Props {
		series: EventSeriesRecurrenceDetailSchema;
		/** Whether the current user can run mutating actions against this series. */
		canEdit?: boolean;
		/** No-op by default — Phase 3 modals replace these with dialog triggers. */
		onSeriesSettings?: () => void;
		onEditTemplate?: () => void;
		onEditRecurrence?: () => void;
		onCancelOccurrence?: () => void;
		onGenerateNow?: () => void;
		onPauseResume?: () => void;
	}

	const {
		series,
		canEdit = false,
		onSeriesSettings,
		onEditTemplate,
		onEditRecurrence,
		onCancelOccurrence,
		onGenerateNow,
		onPauseResume
	}: Props = $props();

	const isPaused = $derived(series.is_active === false);
	const hasRecurrenceRule = $derived(!!series.recurrence_rule);
	const hasTemplate = $derived(!!series.template_event);
	// Three legitimate shapes — see dashboard `+page.svelte` for the full
	// taxonomy. `isEmpty` (both fields null) is an intentional grouping
	// container; recurring actions are hidden because they simply don't
	// apply. `!isRecurring && !isEmpty` is the broken case where exactly one
	// field is missing — actions render disabled (visible affordance, but
	// guarded against the inevitable 400) so the contact-support banner
	// gives organisers context for the greyed-out row.
	const isEmpty = $derived(!hasRecurrenceRule && !hasTemplate);
	const isRecurring = $derived(hasRecurrenceRule && hasTemplate);

	const horizonLabel = $derived(
		series.last_generated_until
			? m['recurringEvents.dashboard.horizonLabel']({
					date: formatEventDate(series.last_generated_until)
				})
			: m['recurringEvents.dashboard.horizonUnknown']()
	);

	const showRecurringActions = $derived(canEdit && !isEmpty);
	const actionsDisabled = $derived(!canEdit || !isRecurring);
	const pauseResumeDisabled = $derived(!canEdit || !isRecurring);

	let actionSheetOpen = $state(false);
</script>

<header class="rounded-lg border border-border bg-card p-4 shadow-sm md:p-6">
	<div class="flex flex-wrap items-center gap-2">
		<h1 class="flex-1 text-2xl font-bold tracking-tight md:text-3xl">
			{series.name}
		</h1>
		{#if isPaused}
			<span
				class="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground"
				aria-label={m['recurringEvents.dashboard.statusPaused']()}
			>
				<Pause class="h-3 w-3" aria-hidden="true" />
				{m['recurringEvents.dashboard.statusPaused']()}
			</span>
		{:else}
			<span
				class="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-900 dark:bg-green-900/30 dark:text-green-200"
				aria-label={m['recurringEvents.dashboard.statusActive']()}
			>
				<Play class="h-3 w-3" aria-hidden="true" />
				{m['recurringEvents.dashboard.statusActive']()}
			</span>
		{/if}
		<span
			class="inline-flex items-center rounded-full bg-secondary px-3 py-0.5 text-xs font-medium text-secondary-foreground"
		>
			{series.auto_publish
				? m['recurringEvents.dashboard.autoPublishOn']()
				: m['recurringEvents.dashboard.autoPublishOff']()}
		</span>
	</div>

	{#if series.description}
		<p class="mt-2 text-sm text-muted-foreground">{series.description}</p>
	{/if}

	<p class="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
		<Calendar class="h-3.5 w-3.5" aria-hidden="true" />
		{horizonLabel}
	</p>

	{#if hasRecurrenceRule}
		<div class="mt-2">
			<RecurrenceSummary rule={series.recurrence_rule} />
		</div>
	{/if}

	<!-- Action row. Disabled when the series is missing a template / recurrence
	     rule so the organiser can't PATCH into a 400.
	     Desktop (md+): buttons wrap inline; mobile (< md): single "More actions"
	     trigger opens the bottom action sheet. Both trees render the same
	     data-testids so Playwright hooks still resolve in either viewport. -->
	{#if canEdit}
		<div class="mt-4 border-t border-border pt-4">
			<!-- Desktop action row. Recurring-only actions render only when the
			     series actually has a recurrence rule + template — empty series
			     get a slimmed-down row with just "Series settings". -->
			<div class="hidden flex-wrap gap-2 md:flex">
				<Button
					variant="outline"
					size="sm"
					onclick={onSeriesSettings}
					disabled={!canEdit}
					data-testid="action-series-settings"
				>
					<Settings class="h-4 w-4" aria-hidden="true" />
					{m['recurringEvents.dashboard.actions.seriesSettings']()}
				</Button>
				{#if showRecurringActions}
					<Button
						variant="outline"
						size="sm"
						onclick={onEditTemplate}
						disabled={actionsDisabled}
						data-testid="action-edit-template"
					>
						<FileText class="h-4 w-4" aria-hidden="true" />
						{m['recurringEvents.dashboard.actions.editTemplate']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={onEditRecurrence}
						disabled={actionsDisabled}
						data-testid="action-edit-recurrence"
					>
						<Repeat class="h-4 w-4" aria-hidden="true" />
						{m['recurringEvents.dashboard.actions.editRecurrence']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={onCancelOccurrence}
						disabled={actionsDisabled}
						data-testid="action-cancel-occurrence"
					>
						<CalendarX class="h-4 w-4" aria-hidden="true" />
						{m['recurringEvents.dashboard.actions.cancelOccurrence']()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={onGenerateNow}
						disabled={actionsDisabled}
						data-testid="action-generate-now"
					>
						<RefreshCw class="h-4 w-4" aria-hidden="true" />
						{m['recurringEvents.dashboard.actions.generateNow']()}
					</Button>
					<Button
						variant={isPaused ? 'default' : 'outline'}
						size="sm"
						onclick={onPauseResume}
						disabled={pauseResumeDisabled}
						data-testid="action-pause-resume"
					>
						{#if isPaused}
							<Play class="h-4 w-4" aria-hidden="true" />
							{m['recurringEvents.dashboard.actions.resume']()}
						{:else}
							<Pause class="h-4 w-4" aria-hidden="true" />
							{m['recurringEvents.dashboard.actions.pause']()}
						{/if}
					</Button>
				{/if}
			</div>

			<!-- Mobile trigger. Empty series only have "Series settings" available,
			     so the bottom-sheet trigger is replaced by the direct button to
			     avoid burying a single action behind an extra tap. -->
			{#if showRecurringActions}
				<Button
					variant="outline"
					size="sm"
					onclick={() => (actionSheetOpen = true)}
					class="w-full md:hidden"
					data-testid="action-sheet-trigger"
				>
					<MoreHorizontal class="h-4 w-4" aria-hidden="true" />
					{m['recurringEvents.dashboard.actions.moreActions']()}
				</Button>
			{:else}
				<Button
					variant="outline"
					size="sm"
					onclick={onSeriesSettings}
					class="w-full md:hidden"
					data-testid="action-series-settings-mobile"
				>
					<Settings class="h-4 w-4" aria-hidden="true" />
					{m['recurringEvents.dashboard.actions.seriesSettings']()}
				</Button>
			{/if}
		</div>

		{#if showRecurringActions}
			<!-- Mobile action sheet (rendered outside the bordered block so it can
			     portal to the viewport edge; content mirrors the desktop row). -->
			<SeriesActionSheet
				isOpen={actionSheetOpen}
				{isPaused}
				{actionsDisabled}
				{pauseResumeDisabled}
				onClose={() => (actionSheetOpen = false)}
				{onSeriesSettings}
				{onEditTemplate}
				{onEditRecurrence}
				{onCancelOccurrence}
				{onGenerateNow}
				{onPauseResume}
			/>
		{/if}
	{/if}
</header>
