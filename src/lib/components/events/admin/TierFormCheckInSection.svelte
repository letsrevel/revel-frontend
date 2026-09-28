<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { AlertTriangle, DoorOpen, X } from '@lucide/svelte';
	import { tick } from 'svelte';
	import { formatDateTimeReadback } from '$lib/utils/date';
	import {
		checkInPickError,
		isResolvedWindowEmpty,
		offsetFromPicked,
		offsetPickerBounds,
		splitMinutes,
		type TierCheckInEventContext
	} from './check-in-offset';

	interface Props {
		/** Picked `datetime-local` values; '' = inherit the event's check-in window. */
		opensAt: string;
		closesAt: string;
		/** The event form's own `datetime-local` values the offsets are relative to. */
		eventContext: TierCheckInEventContext;
		isPending: boolean;
	}

	let { opensAt = $bindable(), closesAt = $bindable(), eventContext, isPending }: Props = $props();

	const eventStart = $derived(eventContext.start);
	const bounds = $derived(offsetPickerBounds(eventStart));

	/** "1 day 2 hours before event start" for a signed offset in minutes. */
	function relativeLabel(offset: number): string {
		if (offset === 0) return m['tierCheckIn.atStart']();
		const { days, hours, minutes } = splitMinutes(offset);
		const parts: string[] = [];
		if (days) parts.push(m['tierCheckIn.days']({ count: days }));
		if (hours) parts.push(m['tierCheckIn.hours']({ count: hours }));
		if (minutes) parts.push(m['tierCheckIn.minutes']({ count: minutes }));
		const duration = parts.join(' ');
		return offset < 0
			? m['tierCheckIn.before']({ duration })
			: m['tierCheckIn.after']({ duration });
	}

	function describe(picked: string) {
		const offset = offsetFromPicked(eventStart, picked);
		const error = checkInPickError(eventStart, picked);
		return {
			readback: formatDateTimeReadback(picked),
			relative: offset !== null && !error ? relativeLabel(offset) : '',
			error: error ? m[`tierCheckIn.${error}`]() : ''
		};
	}

	/** Clearing unmounts the focused clear button — hand focus back to its input. */
	async function clear(id: string, onChange: (next: string) => void): Promise<void> {
		onChange('');
		await tick();
		document.getElementById(id)?.focus();
	}

	const opens = $derived(describe(opensAt));
	const closes = $derived(describe(closesAt));

	// Soft warning only: the backend validates the resolved window on save, but
	// an event check-in window edited LATER can still invert an inherited side.
	const windowEmpty = $derived(
		(opensAt !== '' || closesAt !== '') &&
			!opens.error &&
			!closes.error &&
			isResolvedWindowEmpty({
				eventStart,
				eventEnd: eventContext.end,
				eventCheckInStart: eventContext.checkInStart,
				eventCheckInEnd: eventContext.checkInEnd,
				opensOffset: opensAt ? offsetFromPicked(eventStart, opensAt) : null,
				closesOffset: closesAt ? offsetFromPicked(eventStart, closesAt) : null
			})
	);
</script>

{#snippet picker(
	id: string,
	label: string,
	clearLabel: string,
	value: string,
	info: { readback: string; relative: string; error: string },
	onChange: (next: string) => void
)}
	<div>
		<Label for={id}>{label}</Label>
		<div class="flex items-center gap-2">
			<Input
				{id}
				type="datetime-local"
				{value}
				min={bounds.min}
				max={bounds.max}
				oninput={(e) => onChange(e.currentTarget.value)}
				disabled={isPending}
				aria-invalid={info.error ? 'true' : undefined}
				aria-describedby={`${id}-hint`}
			/>
			{#if value}
				<Button
					type="button"
					variant="ghost"
					size="icon"
					class="shrink-0"
					aria-label={clearLabel}
					onclick={() => clear(id, onChange)}
					disabled={isPending}
				>
					<X class="h-4 w-4" aria-hidden="true" />
				</Button>
			{/if}
		</div>
		<!-- Always mounted and polite-live: errors and the relative hint change while
		     focus stays in the field, and aria-describedby only speaks on focus. -->
		<div id={`${id}-hint`} class="mt-1 space-y-0.5 text-xs" aria-live="polite">
			{#if info.error}
				<p class="text-destructive">{info.error}</p>
			{:else if value}
				{#if info.readback}
					<p class="text-muted-foreground">
						{m['dateTimePicker.selectedDate']({ value: info.readback })}
					</p>
				{/if}
				{#if info.relative}
					<p class="font-medium text-foreground">{info.relative}</p>
				{/if}
			{:else}
				<p class="text-muted-foreground">{m['tierCheckIn.defaultsHint']()}</p>
			{/if}
		</div>
	</div>
{/snippet}

<div class="space-y-3">
	<fieldset class="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
		<legend class="sr-only">{m['tierCheckIn.sectionTitle']()}</legend>
		<div>
			<div class="flex items-center gap-2 text-sm font-medium" aria-hidden="true">
				<DoorOpen class="h-4 w-4 text-primary" />
				{m['tierCheckIn.sectionTitle']()}
			</div>
			<p class="mt-1 text-xs text-muted-foreground">{m['tierCheckIn.sectionHelp']()}</p>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{@render picker(
				'tier-check-in-opens',
				m['tierCheckIn.opensLabel'](),
				m['tierCheckIn.clearOpens'](),
				opensAt,
				opens,
				(next) => (opensAt = next)
			)}
			{@render picker(
				'tier-check-in-closes',
				m['tierCheckIn.closesLabel'](),
				m['tierCheckIn.clearCloses'](),
				closesAt,
				closes,
				(next) => (closesAt = next)
			)}
		</div>

		{#if opensAt || closesAt}
			<p class="text-xs text-muted-foreground">{m['tierCheckIn.relativeNote']()}</p>
		{/if}
	</fieldset>

	<!-- Sits on the dialog surface, not the muted fieldset: the audited
	     "MyTicketModal warning banner" recipe (highlight/20 over --background).
	     The role="status" wrapper stays mounted so the warning is announced when it
	     appears — a live region born with its content often is not. -->
	<div role="status">
		{#if windowEmpty}
			<div
				class="flex items-start gap-2 rounded-md border border-highlight/40 bg-highlight/20 p-3 text-sm"
			>
				<AlertTriangle
					class="mt-0.5 h-4 w-4 shrink-0 text-highlight-foreground dark:text-highlight"
					aria-hidden="true"
				/>
				<p class="text-highlight-foreground dark:text-highlight">
					{m['tierCheckIn.emptyWindow']()}
				</p>
			</div>
		{/if}
	</div>
</div>
