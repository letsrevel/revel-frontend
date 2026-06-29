<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { DurationInput } from '$lib/components/forms';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import { CalendarClock, Plus, Trash2, AlertTriangle } from 'lucide-svelte';
	import { emptyRow, rowCompleteness, startsBeforeAnchor, type ScheduleRow } from './schedule-rows';
	import { formatDateTimeReadback } from '$lib/utils/date';

	interface Props {
		/** Editor rows, owned by the parent (bindable). */
		rows: ScheduleRow[];
		/** `datetime-local` string for the event start — the offset anchor. */
		eventStart: string;
		disabled?: boolean;
	}

	let { rows = $bindable([]), eventStart, disabled = false }: Props = $props();

	function addRow(): void {
		rows = [...rows, emptyRow(eventStart)];
	}

	function removeRow(id: number): void {
		rows = rows.filter((r) => r.id !== id);
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-start gap-2">
		<CalendarClock class="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
		<div>
			<h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
				{m['eventScheduleAdmin.title']()}
			</h3>
			<p class="mt-1 text-xs text-muted-foreground">
				{m['eventScheduleAdmin.description']()}
			</p>
		</div>
	</div>

	{#if rows.length === 0}
		<div
			class="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center dark:border-gray-600"
		>
			<CalendarClock class="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
			<p class="mt-2 text-sm text-muted-foreground">{m['eventScheduleAdmin.empty']()}</p>
		</div>
	{:else}
		<ul class="space-y-4">
			{#each rows as row, index (row.id)}
				{@const completeness = rowCompleteness(row)}
				{@const titleInvalid = completeness === 'invalid' && !row.title.trim()}
				{@const startMissing = completeness === 'invalid' && !row.startLocal}
				{@const startBefore = startsBeforeAnchor(row, eventStart)}
				{@const startReadback = formatDateTimeReadback(row.startLocal)}
				<li class="space-y-3 rounded-lg border bg-muted/30 p-4">
					<div class="flex items-center justify-between">
						<span class="text-xs font-medium text-muted-foreground">
							{m['eventScheduleAdmin.sessionNumber']({ number: index + 1 })}
						</span>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onclick={() => removeRow(row.id)}
							{disabled}
							aria-label={m['eventScheduleAdmin.removeSession']()}
							class="h-8 px-2 text-destructive hover:text-destructive"
						>
							<Trash2 class="h-4 w-4" aria-hidden="true" />
						</Button>
					</div>

					<!-- Title -->
					<div>
						<Label for="schedule-title-{row.id}">
							{m['eventScheduleAdmin.sessionTitle']()} <span class="text-destructive">*</span>
						</Label>
						<Input
							id="schedule-title-{row.id}"
							bind:value={row.title}
							maxlength={150}
							placeholder={m['eventScheduleAdmin.sessionTitlePlaceholder']()}
							{disabled}
							aria-invalid={titleInvalid}
							aria-describedby={titleInvalid ? `schedule-title-error-${row.id}` : undefined}
						/>
						{#if titleInvalid}
							<p
								id="schedule-title-error-{row.id}"
								class="mt-1 text-xs text-destructive"
								role="alert"
							>
								{m['eventScheduleAdmin.titleRequired']()}
							</p>
						{/if}
					</div>

					<!-- Start + Duration -->
					<div class="grid gap-3 sm:grid-cols-2">
						<div>
							<Label for="schedule-start-{row.id}">
								{m['eventScheduleAdmin.startsAt']()} <span class="text-destructive">*</span>
							</Label>
							<Input
								id="schedule-start-{row.id}"
								type="datetime-local"
								bind:value={row.startLocal}
								{disabled}
								aria-invalid={startMissing}
								aria-describedby={startMissing
									? `schedule-start-error-${row.id}`
									: startBefore
										? `schedule-start-warning-${row.id}`
										: undefined}
							/>
							{#if startMissing}
								<p
									id="schedule-start-error-{row.id}"
									class="mt-1 text-xs text-destructive"
									role="alert"
								>
									{m['eventScheduleAdmin.startRequired']()}
								</p>
							{:else if startBefore}
								<p
									id="schedule-start-warning-{row.id}"
									class="mt-1 flex items-start gap-1 text-xs text-amber-600 dark:text-amber-500"
								>
									<AlertTriangle class="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
									{m['eventScheduleAdmin.beforeStartWarning']()}
								</p>
							{/if}
							{#if startReadback && !startMissing}
								<p class="mt-1 text-xs text-muted-foreground">
									{m['dateTimePicker.selectedDate']({ value: startReadback })}
								</p>
							{/if}
						</div>
						<DurationInput
							id="schedule-duration-{row.id}"
							label={m['eventScheduleAdmin.duration']()}
							bind:value={row.durationMinutes}
							storageUnit="minutes"
							defaultUnit="minutes"
							emptyValue={null}
							emptyLabel={m['eventScheduleAdmin.noDuration']()}
							{disabled}
						/>
					</div>

					<!-- Location -->
					<div>
						<Label for="schedule-location-{row.id}">
							{m['eventScheduleAdmin.location']()}
						</Label>
						<Input
							id="schedule-location-{row.id}"
							bind:value={row.location}
							maxlength={150}
							placeholder={m['eventScheduleAdmin.locationPlaceholder']()}
							{disabled}
						/>
					</div>

					<!-- Description -->
					<MarkdownEditor
						id="schedule-description-{row.id}"
						label={m['eventScheduleAdmin.descriptionLabel']()}
						bind:value={row.description}
						rows={2}
						placeholder={m['eventScheduleAdmin.descriptionPlaceholder']()}
						{disabled}
					/>

					<!-- Required -->
					<label class="flex cursor-pointer items-start gap-2">
						<input
							type="checkbox"
							bind:checked={row.isRequired}
							{disabled}
							class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
						/>
						<div>
							<span class="text-sm font-medium">{m['eventScheduleAdmin.required']()}</span>
							<p class="text-xs text-muted-foreground">{m['eventScheduleAdmin.requiredHelp']()}</p>
						</div>
					</label>
				</li>
			{/each}
		</ul>
	{/if}

	<Button type="button" variant="outline" size="sm" onclick={addRow} {disabled}>
		<Plus class="mr-1 h-4 w-4" aria-hidden="true" />
		{m['eventScheduleAdmin.addSession']()}
	</Button>
</div>
