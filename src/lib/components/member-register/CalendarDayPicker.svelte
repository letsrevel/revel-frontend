<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { formatCalendarDay, isCalendarDay } from '$lib/member-register/calendar-day';

	interface Props {
		id: string;
		label: string;
		/** `YYYY-MM-DD` or '' for no day. Never converted through a timezone. */
		value: string;
		/** IANA name of the organization's timezone, or null when it is not known. */
		timezone: string | null;
		onChange: (value: string) => void;
		class?: string;
	}

	const { id, label, value, timezone, onChange, class: className = '' }: Props = $props();

	const day = $derived(isCalendarDay(value) ? formatCalendarDay(value) : '');
	const readback = $derived(
		day
			? timezone
				? m['memberRegister.dayReadback']({ day, timezone })
				: m['memberRegister.dayReadbackOrgTz']({ day })
			: ''
	);
	const hintId = $derived(`${id}-hint`);
</script>

<div class={className}>
	<Label for={id}>{label}</Label>
	<div class="mt-2 flex items-center gap-2">
		<Input
			{id}
			type="date"
			{value}
			aria-describedby={hintId}
			oninput={(e) => onChange(e.currentTarget.value)}
		/>
		{#if value}
			<Button type="button" variant="outline" size="sm" onclick={() => onChange('')}>
				{m['memberRegister.dayClear']()}
			</Button>
		{/if}
	</div>
	<p id={hintId} class="mt-1 text-xs text-muted-foreground" data-testid="calendar-day-readback">
		{#if readback}
			{readback}
		{:else if timezone}
			{m['memberRegister.dayHint']({ timezone })}
		{:else}
			{m['memberRegister.dayHintOrgTz']()}
		{/if}
	</p>
</div>
