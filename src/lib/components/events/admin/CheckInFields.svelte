<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventCreateSchema } from '$lib/api/generated/types.gen';
	import { formatDateTimeReadback } from '$lib/utils/date';

	interface Props {
		formData: Partial<EventCreateSchema>;
		onUpdate: (data: Partial<EventCreateSchema>) => void;
	}

	const { formData, onUpdate }: Props = $props();

	const checkInStartReadback = $derived(formatDateTimeReadback(formData.check_in_starts_at));
	const checkInEndReadback = $derived(formatDateTimeReadback(formData.check_in_ends_at));
</script>

<!-- Check-in window (ticketed events only). Shared by the wizard's DetailsStep
     and the event editor's Date & time section. -->
<div class="space-y-4">
	<div class="space-y-2">
		<label for="check-in-starts" class="block text-sm font-medium">
			{m['detailsStep.checkinOpensAt']()}
		</label>
		<input
			id="check-in-starts"
			type="datetime-local"
			value={formData.check_in_starts_at || ''}
			oninput={(e) => onUpdate({ check_in_starts_at: e.currentTarget.value })}
			class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		/>
		{#if checkInStartReadback}
			<p class="text-xs text-muted-foreground">
				{m['dateTimePicker.selectedDate']({ value: checkInStartReadback })}
			</p>
		{/if}
		<p class="text-xs text-muted-foreground">
			{m['detailsStep.checkinOpensAtHint']({
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
			})}
		</p>
	</div>

	<div class="space-y-2">
		<label for="check-in-ends" class="block text-sm font-medium">
			{m['detailsStep.checkinClosesAt']()}
		</label>
		<input
			id="check-in-ends"
			type="datetime-local"
			value={formData.check_in_ends_at || ''}
			oninput={(e) => onUpdate({ check_in_ends_at: e.currentTarget.value })}
			class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		/>
		{#if checkInEndReadback}
			<p class="text-xs text-muted-foreground">
				{m['dateTimePicker.selectedDate']({ value: checkInEndReadback })}
			</p>
		{/if}
		<p class="text-xs text-muted-foreground">
			{m['detailsStep.checkinClosesAtHint']({
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
			})}
		</p>
	</div>
</div>
