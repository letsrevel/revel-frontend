<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import {
		formatCalendarDay,
		isCalendarDay,
		isPickableDay
	} from '$lib/member-register/calendar-day';

	interface Props {
		id: string;
		label: string;
		/** `YYYY-MM-DD` or '' for no day. Never converted through a timezone. */
		value: string;
		/** IANA name of the organization's timezone. */
		timezone: string;
		onChange: (value: string) => void;
		class?: string;
	}

	const { id, label, value, timezone, onChange, class: className = '' }: Props = $props();

	const day = $derived(isCalendarDay(value) ? formatCalendarDay(value) : '');
	const readback = $derived(day ? m['memberRegister.dayReadback']({ day, timezone }) : '');
	// Commit on `change`, not `input`: a native date input emits `input` for every
	// half-typed segment. Only a complete, plausible day applies; an explicit clear
	// (empty value WITHOUT a half-typed segment) clears the filter.
	function handleChange(e: Event & { currentTarget: HTMLInputElement }) {
		const el = e.currentTarget;
		if (el.value === '') {
			if (!el.validity.badInput) onChange('');
			return;
		}
		if (isPickableDay(el.value)) onChange(el.value);
	}

	const hintId = $derived(`${id}-hint`);
</script>

<div class={className}>
	<Label for={id}>{label}</Label>
	<div class="mt-2 flex items-center gap-2">
		<Input {id} type="date" {value} aria-describedby={hintId} onchange={handleChange} />
		{#if value}
			<Button type="button" variant="outline" size="sm" onclick={() => onChange('')}>
				{m['memberRegister.dayClear']()}
			</Button>
		{/if}
	</div>
	<p id={hintId} class="mt-1 text-xs text-muted-foreground" data-testid="calendar-day-readback">
		{#if readback}
			{readback}
		{:else}
			{m['memberRegister.dayHint']({ timezone })}
		{/if}
	</p>
</div>
