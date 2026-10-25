<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventCreateSchema } from '$lib/api/generated/types.gen';
	import { formatDateTimeReadback } from '$lib/utils/date';

	interface Props {
		formData: Partial<EventCreateSchema>;
		onUpdate: (data: Partial<EventCreateSchema>) => void;
	}

	const { formData, onUpdate }: Props = $props();

	const rsvpReadback = $derived(formatDateTimeReadback(formData.rsvp_before));
</script>

<!-- RSVP deadline + RSVP notes (non-ticketed events). Shared by the wizard's
     DetailsStep accordion and the event editor's Attendance section. -->
<div class="space-y-4">
	<div class="space-y-2">
		<label for="rsvp-before" class="block text-sm font-medium">
			{m['detailsStep.rsvpDeadline']()}
		</label>
		<input
			id="rsvp-before"
			type="datetime-local"
			value={formData.rsvp_before || ''}
			oninput={(e) => onUpdate({ rsvp_before: e.currentTarget.value })}
			class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		/>
		{#if rsvpReadback}
			<p class="text-xs text-muted-foreground">
				{m['dateTimePicker.selectedDate']({ value: rsvpReadback })}
			</p>
		{/if}
		<p class="text-xs text-muted-foreground">
			{m['detailsStep.rsvpDeadlineHint']({
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
			})}
		</p>
	</div>

	<div class="space-y-2">
		<label
			class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
		>
			<input
				type="checkbox"
				checked={formData.accept_rsvp_notes || false}
				onchange={(e) => onUpdate({ accept_rsvp_notes: e.currentTarget.checked })}
				class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
			/>
			<div class="flex-1">
				<div class="font-medium">{m['detailsStep.acceptRsvpNotes']()}</div>
				<div class="text-sm text-muted-foreground">
					{m['detailsStep.acceptRsvpNotesHint']()}
				</div>
			</div>
		</label>
	</div>
</div>
