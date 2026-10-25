<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { VenueDetailSchema } from '$lib/api/generated/types.gen';
	import RsvpFields from '../../RsvpFields.svelte';
	import CapacityFields from '../../CapacityFields.svelte';
	import EditorSection from './EditorSection.svelte';
	import EditorSubGroup from './EditorSubGroup.svelte';
	import type { EditorFormData, EditorUpdate } from '../types';

	interface Props {
		formData: EditorFormData;
		selectedVenue: VenueDetailSchema | null;
		isEditMode: boolean;
		onUpdate: EditorUpdate;
	}

	const { formData, selectedVenue, isEditMode, onUpdate }: Props = $props();
</script>

<EditorSection
	id="section-attendance"
	title={m['eventEditor.sectionAttendance']()}
	subtitle={m['eventEditor.subtitleAttendance']()}
>
	<!-- RSVP options only apply to non-ticketed events -->
	{#if !formData.requires_ticket}
		<EditorSubGroup divider={false} title={m['detailsStep.rsvpOptions']()}>
			<RsvpFields {formData} {onUpdate} />
		</EditorSubGroup>
	{/if}

	<EditorSubGroup divider={!formData.requires_ticket} title={m['detailsStep.capacity']()}>
		<CapacityFields {formData} {selectedVenue} {isEditMode} {onUpdate} />
	</EditorSubGroup>

	{#if formData.requires_ticket}
		<EditorSubGroup>
			<label
				class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
			>
				<input
					type="checkbox"
					checked={formData.require_ticket_names ?? true}
					onchange={(e) => onUpdate({ require_ticket_names: e.currentTarget.checked })}
					class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
				/>
				<div class="flex-1">
					<div class="font-medium">{m['detailsStep.requireTicketNames']()}</div>
					<div class="text-sm text-muted-foreground">
						{m['detailsStep.requireTicketNamesHint']()}
					</div>
				</div>
			</label>
		</EditorSubGroup>
	{/if}
</EditorSection>
