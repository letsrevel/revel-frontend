<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { VenueDetailSchema } from '$lib/api/generated/types.gen';
	import RsvpFields from '../../RsvpFields.svelte';
	import CapacityFields from '../../CapacityFields.svelte';
	import EditorSection from './EditorSection.svelte';
	import EditorSubGroup from './EditorSubGroup.svelte';
	import type { EditorFormData, EditorUpdate } from '../types';
	import AdminWarningList from '$lib/components/admin-warnings/AdminWarningList.svelte';
	import { compactWarnings, withAction } from '$lib/utils/admin-warnings/types';
	import { rsvpOnTicketedWarning } from '$lib/utils/admin-warnings/event';

	interface Props {
		formData: EditorFormData;
		selectedVenue: VenueDetailSchema | null;
		isEditMode: boolean;
		onUpdate: EditorUpdate;
		/** Saved event id (edit mode). */
		eventId?: string | null;
	}

	const { formData, selectedVenue, isEditMode, onUpdate, eventId = null }: Props = $props();

	// RsvpFields is not rendered for ticketed events, so a stale RSVP deadline is flagged here.
	const rsvpWarnings = $derived.by(() => {
		const warning = rsvpOnTicketedWarning(formData);
		return compactWarnings([
			warning &&
				withAction(warning, {
					label: () => m['adminWarnings.clearDeadline'](),
					run: () => onUpdate({ rsvp_before: '' })
				})
		]);
	});
</script>

<EditorSection
	id="section-attendance"
	title={m['eventEditor.sectionAttendance']()}
	subtitle={m['eventEditor.subtitleAttendance']()}
>
	<!-- RSVP options only apply to non-ticketed events -->
	{#if !formData.requires_ticket}
		<EditorSubGroup divider={false} title={m['detailsStep.rsvpOptions']()}>
			<RsvpFields {formData} {onUpdate} {eventId} />
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
					id="require-ticket-names"
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

	<AdminWarningList
		warnings={rsvpWarnings}
		entityId={eventId ?? undefined}
		fallbackFocusId="require-ticket-names"
	/>
</EditorSection>
