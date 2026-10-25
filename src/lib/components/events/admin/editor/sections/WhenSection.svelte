<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import { Calendar } from '@lucide/svelte';
	import { formatDateTimeReadback } from '$lib/utils/date';
	import CheckInFields from '../../CheckInFields.svelte';
	import ScheduleEditor from '../../ScheduleEditor.svelte';
	import type { ScheduleRow } from '../../schedule-rows';
	import EditorSection from './EditorSection.svelte';
	import EditorSubGroup from './EditorSubGroup.svelte';
	import type { EditorFormData, EditorMode, EditorUpdate } from '../types';

	interface Props {
		formData: EditorFormData;
		validationErrors: Record<string, string>;
		/** `create` stops after the end time; `edit` adds check-in window and schedule. */
		mode: EditorMode;
		onUpdate: EditorUpdate;
		/** Schedule sessions exist only once the event does. */
		eventId?: string | null;
		scheduleRows?: ScheduleRow[];
		disabled?: boolean;
	}

	let {
		formData,
		validationErrors,
		mode,
		onUpdate,
		eventId = null,
		scheduleRows = $bindable([]),
		disabled = false
	}: Props = $props();

	// Unambiguous textual readbacks for the native datetime inputs; '' when the
	// value is empty or unparseable, so the hint is gated on the rendered text.
	const startReadback = $derived(formatDateTimeReadback(formData.start));
	const endReadback = $derived(formatDateTimeReadback(formData.end));

	const inputClass =
		'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
</script>

<EditorSection
	id="section-when"
	title={m['eventEditor.sectionWhen']()}
	subtitle={m['eventEditor.subtitleWhen']()}
>
	<div class="space-y-4">
		<!-- Start Date/Time -->
		<div class="space-y-2">
			<label for="event-start" class="block text-sm font-medium">
				<span class="flex items-center gap-2">
					<Calendar class="h-4 w-4" aria-hidden="true" />
					{m['essentialsStep.startDateTime']()} <span class="text-destructive">*</span>
				</span>
			</label>
			<input
				id="event-start"
				type="datetime-local"
				value={formData.start || ''}
				oninput={(e) => onUpdate({ start: e.currentTarget.value })}
				required
				aria-invalid={!!validationErrors.start}
				aria-describedby={validationErrors.start ? 'event-start-error' : undefined}
				class={cn(inputClass, validationErrors.start && 'border-destructive')}
			/>
			{#if validationErrors.start}
				<p id="event-start-error" class="text-sm text-destructive" role="alert">
					{validationErrors.start}
				</p>
			{/if}
			{#if startReadback}
				<p class="text-xs text-muted-foreground">
					{m['dateTimePicker.selectedDate']({ value: startReadback })}
				</p>
			{/if}
			<p class="text-xs text-muted-foreground">
				{m['essentialsStep.localTimezoneHint']({
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
				})}
			</p>
		</div>

		<!-- Open-ended toggle -->
		<div class="space-y-2">
			<label class="flex items-center gap-2 text-sm font-medium">
				<input
					type="checkbox"
					checked={formData.is_open_ended ?? false}
					onchange={(e) => onUpdate({ is_open_ended: e.currentTarget.checked })}
					class="h-4 w-4 rounded border-input"
				/>
				{m['essentialsStep.openEndedToggle']()}
			</label>
			<p class="text-xs text-muted-foreground">{m['essentialsStep.openEndedHelp']()}</p>
		</div>

		<!-- End Date/Time (hidden when open-ended) -->
		{#if !formData.is_open_ended}
			<div class="space-y-2">
				<label for="event-end" class="block text-sm font-medium">
					<span class="flex items-center gap-2">
						<Calendar class="h-4 w-4" aria-hidden="true" />
						{m['essentialsStep.endDateTime']()} <span class="text-destructive">*</span>
					</span>
				</label>
				<input
					id="event-end"
					type="datetime-local"
					value={formData.end || ''}
					oninput={(e) => onUpdate({ end: e.currentTarget.value })}
					required
					aria-invalid={!!validationErrors.end}
					aria-describedby={validationErrors.end ? 'event-end-error' : undefined}
					class={cn(inputClass, validationErrors.end && 'border-destructive')}
				/>
				{#if validationErrors.end}
					<p id="event-end-error" class="text-sm text-destructive" role="alert">
						{validationErrors.end}
					</p>
				{/if}
				{#if endReadback}
					<p class="text-xs text-muted-foreground">
						{m['dateTimePicker.selectedDate']({ value: endReadback })}
					</p>
				{/if}
			</div>
		{/if}
	</div>

	{#if mode === 'edit'}
		{#if formData.requires_ticket}
			<EditorSubGroup title={m['eventEditor.subCheckIn']()}>
				<CheckInFields {formData} {onUpdate} />
			</EditorSubGroup>
		{/if}

		{#if eventId}
			<EditorSubGroup>
				<ScheduleEditor bind:rows={scheduleRows} eventStart={formData.start ?? ''} {disabled} />
			</EditorSubGroup>
		{/if}
	{/if}
</EditorSection>
