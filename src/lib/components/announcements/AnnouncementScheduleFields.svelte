<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/ui/label';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import DateTimePicker from '$lib/components/forms/DateTimePicker.svelte';
	import DurationInput from '$lib/components/forms/DurationInput.svelte';
	import { cn } from '$lib/utils/cn';
	import { CalendarClock, Send } from 'lucide-svelte';

	export type SendMode = 'now' | 'schedule';
	export type ScheduleKind = 'absolute' | 'relative';
	export type ScheduleAnchor = 'event_start' | 'event_end';
	export type OffsetDirection = 'before' | 'after';

	interface Props {
		sendMode: SendMode;
		scheduleKind: ScheduleKind;
		scheduledAt: string;
		scheduleAnchor: ScheduleAnchor;
		offsetDirection: OffsetDirection;
		offsetMinutes: number | null;
		/** Relative-to-event scheduling is only meaningful when targeting an event. */
		isEventTarget: boolean;
		disabled?: boolean;
		error?: string;
	}

	let {
		sendMode = $bindable('now'),
		scheduleKind = $bindable('absolute'),
		scheduledAt = $bindable(''),
		scheduleAnchor = $bindable('event_start'),
		offsetDirection = $bindable('before'),
		offsetMinutes = $bindable(null),
		isEventTarget,
		disabled = false,
		error
	}: Props = $props();

	// Minimum selectable time for absolute scheduling: now.
	const nowIso = new Date().toISOString();

	// If the user picks "relative" but is no longer targeting an event, fall back
	// to absolute so we never submit a relative schedule the backend can't anchor.
	$effect(() => {
		if (!isEventTarget && scheduleKind === 'relative') {
			scheduleKind = 'absolute';
		}
	});

	const modeOptions: Array<{ value: SendMode; label: string; icon: typeof Send }> = [
		{ value: 'now', label: m['announcements.schedule.sendNow'](), icon: Send },
		{ value: 'schedule', label: m['announcements.schedule.schedule'](), icon: CalendarClock }
	];

	function anchorLabel(a: ScheduleAnchor): string {
		return a === 'event_start'
			? m['announcements.schedule.anchor.eventStart']()
			: m['announcements.schedule.anchor.eventEnd']();
	}

	function directionLabel(d: OffsetDirection): string {
		return d === 'before'
			? m['announcements.schedule.direction.before']()
			: m['announcements.schedule.direction.after']();
	}
</script>

<div class="space-y-3">
	<Label>{m['announcements.schedule.legend']()}</Label>

	<!-- Send now / Schedule toggle -->
	<div
		class="grid grid-cols-2 gap-2"
		role="radiogroup"
		aria-label={m['announcements.schedule.legend']()}
	>
		{#each modeOptions as option (option.value)}
			<button
				type="button"
				role="radio"
				aria-checked={sendMode === option.value}
				onclick={() => (sendMode = option.value)}
				{disabled}
				class={cn(
					'flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors',
					sendMode === option.value
						? 'border-primary bg-primary/5 text-foreground'
						: 'border-border text-muted-foreground hover:border-primary/50',
					disabled && 'cursor-not-allowed opacity-50'
				)}
			>
				<option.icon class="h-4 w-4" aria-hidden="true" />
				{option.label}
			</button>
		{/each}
	</div>

	{#if sendMode === 'schedule'}
		<div class="space-y-3 rounded-lg border p-3">
			<!-- Absolute / relative kind (relative only when targeting an event) -->
			{#if isEventTarget}
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						aria-pressed={scheduleKind === 'absolute'}
						onclick={() => (scheduleKind = 'absolute')}
						{disabled}
						class={cn(
							'rounded-full border px-3 py-1 text-xs transition-colors',
							scheduleKind === 'absolute'
								? 'border-primary bg-primary/10 text-primary'
								: 'border-border text-muted-foreground hover:border-primary hover:text-primary',
							disabled && 'cursor-not-allowed opacity-50'
						)}
					>
						{m['announcements.schedule.kind.absolute']()}
					</button>
					<button
						type="button"
						aria-pressed={scheduleKind === 'relative'}
						onclick={() => (scheduleKind = 'relative')}
						{disabled}
						class={cn(
							'rounded-full border px-3 py-1 text-xs transition-colors',
							scheduleKind === 'relative'
								? 'border-primary bg-primary/10 text-primary'
								: 'border-border text-muted-foreground hover:border-primary hover:text-primary',
							disabled && 'cursor-not-allowed opacity-50'
						)}
					>
						{m['announcements.schedule.kind.relative']()}
					</button>
				</div>
			{/if}

			{#if scheduleKind === 'absolute'}
				<DateTimePicker
					bind:value={scheduledAt}
					label={m['announcements.schedule.atLabel']()}
					min={nowIso}
					{disabled}
					required
				/>
			{:else}
				<div class="space-y-3">
					<DurationInput
						bind:value={offsetMinutes}
						storageUnit="minutes"
						defaultUnit="hours"
						label={m['announcements.schedule.offsetLabel']()}
						min={1}
						{disabled}
						required
					/>
					<div class="grid gap-3 sm:grid-cols-2">
						<div class="space-y-1.5">
							<Label for="schedule-direction">{m['announcements.schedule.directionLabel']()}</Label>
							<Select
								type="single"
								value={offsetDirection}
								onValueChange={(v) => v && (offsetDirection = v as OffsetDirection)}
								{disabled}
							>
								<SelectTrigger id="schedule-direction" class="w-full">
									{directionLabel(offsetDirection)}
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="before">{directionLabel('before')}</SelectItem>
									<SelectItem value="after">{directionLabel('after')}</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div class="space-y-1.5">
							<Label for="schedule-anchor">{m['announcements.schedule.anchorLabel']()}</Label>
							<Select
								type="single"
								value={scheduleAnchor}
								onValueChange={(v) => v && (scheduleAnchor = v as ScheduleAnchor)}
								{disabled}
							>
								<SelectTrigger id="schedule-anchor" class="w-full">
									{anchorLabel(scheduleAnchor)}
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="event_start">{anchorLabel('event_start')}</SelectItem>
									<SelectItem value="event_end">{anchorLabel('event_end')}</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<p class="text-xs text-muted-foreground">{m['announcements.schedule.relativeHelp']()}</p>
				</div>
			{/if}

			{#if error}
				<p class="text-sm text-destructive">{error}</p>
			{/if}
		</div>
	{/if}
</div>
