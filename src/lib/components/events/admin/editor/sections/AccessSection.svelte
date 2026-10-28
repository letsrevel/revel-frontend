<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { OrganizationQuestionnaireInListSchema } from '$lib/api/generated';
	import { AlertTriangle, Eye, Users } from '@lucide/svelte';
	import AdmissionScreeningSection from '../../AdmissionScreeningSection.svelte';
	import EventQuestionnaireAssignmentModal from '../../EventQuestionnaireAssignmentModal.svelte';
	import EditorSection from './EditorSection.svelte';
	import EditorSubGroup from './EditorSubGroup.svelte';
	import RadioTileGroup, { type RadioTileOption } from './RadioTileGroup.svelte';
	import AccessExplanation from './AccessExplanation.svelte';
	import TicketingModeField from './TicketingModeField.svelte';
	import type { EditorFormData, EditorMode, EditorUpdate } from '../types';

	interface Props {
		formData: EditorFormData;
		/** `create` stops after the ticketing choice; `edit` adds admission and guest access. */
		mode: EditorMode;
		/** True once the event exists: ticketing mode is a read-only statement. */
		ticketingLocked: boolean;
		onUpdate: EditorUpdate;
		questionnaires?: OrganizationQuestionnaireInListSchema[];
		eventId?: string | null;
		organizationId?: string;
		organizationSlug?: string;
		accessToken?: string;
	}

	const {
		formData,
		mode,
		ticketingLocked,
		onUpdate,
		questionnaires = [],
		eventId = null,
		organizationId = '',
		organizationSlug = '',
		accessToken = ''
	}: Props = $props();

	let isQuestionnaireModalOpen = $state(false);

	const visibilityOptions: RadioTileOption[] = $derived([
		{
			value: 'public',
			title: m['SFwESEssentialsStep.public'](),
			description: m['SFwESEssentialsStep.anyoneCanSee']()
		},
		{
			value: 'unlisted',
			title: m['SFwESEssentialsStep.unlisted'](),
			description: m['SFwESEssentialsStep.unlistedDescription']()
		},
		{
			value: 'private',
			title: m['SFwESEssentialsStep.private'](),
			description: m['SFwESEssentialsStep.onlyInvitedUsers']()
		},
		{
			value: 'members-only',
			title: m['SFwESEssentialsStep.membersOnly'](),
			description: m['SFwESEssentialsStep.membersOnlyDescription']()
		},
		{
			value: 'staff-only',
			title: m['SFwESEssentialsStep.staffOnly'](),
			description: m['SFwESEssentialsStep.staffOnlyDescription']()
		}
	]);

	const eventTypeOptions: RadioTileOption[] = $derived([
		{
			value: 'public',
			title: m['SFwESEssentialsStep.public'](),
			description: m['SFwESEssentialsStep.everyoneCanAttend']()
		},
		{
			value: 'private',
			title: m['SFwESEssentialsStep.private'](),
			description: m['SFwESEssentialsStep.onlyInvitedPeople']()
		},
		{
			value: 'members-only',
			title: m['SFwESEssentialsStep.membersOnly'](),
			description: m['SFwESEssentialsStep.onlyOrganizationMembers']()
		}
	]);
</script>

<EditorSection
	id="section-access"
	title={m['eventEditor.sectionAccess']()}
	subtitle={m['eventEditor.subtitleAccess']()}
>
	<!-- Visibility -->
	<div class="space-y-2">
		<p class="text-sm font-medium">
			<span class="flex items-center gap-2">
				<Eye class="h-4 w-4" aria-hidden="true" />
				{m['SFwESEssentialsStep.visibilityHeading']()}
			</span>
			<span class="mt-0.5 block text-xs font-normal text-muted-foreground">
				{m['SFwESEssentialsStep.visibilitySubLabel']()}
			</span>
		</p>
		<RadioTileGroup
			name="visibility"
			options={visibilityOptions}
			value={formData.visibility}
			ariaLabel={m['essentialsStep.eventVisibilityAriaLabel']()}
			onSelect={(value) =>
				onUpdate({ visibility: value as NonNullable<EditorFormData['visibility']> })}
		/>
	</div>

	<!-- Event type -->
	<div class="space-y-2">
		<p class="text-sm font-medium">
			<span class="flex items-center gap-2">
				<Users class="h-4 w-4" aria-hidden="true" />
				{m['SFwESEssentialsStep.eventTypeHeading']()}
			</span>
			<span class="mt-0.5 block text-xs font-normal text-muted-foreground">
				{m['SFwESEssentialsStep.eventTypeSubLabel']()}
			</span>
		</p>
		<p class="text-xs text-muted-foreground">{m['SFwESEssentialsStep.eventTypeExplanation']()}</p>
		<RadioTileGroup
			name="event_type"
			options={eventTypeOptions}
			value={formData.event_type}
			ariaLabel={m['essentialsStep.eventTypeAriaLabel']()}
			columnsClass="sm:grid-cols-3"
			onSelect={(value) =>
				onUpdate({ event_type: value as NonNullable<EditorFormData['event_type']> })}
		/>
	</div>

	<AccessExplanation visibility={formData.visibility} eventType={formData.event_type} />

	<EditorSubGroup>
		<TicketingModeField
			requiresTicket={formData.requires_ticket ?? false}
			locked={ticketingLocked}
			onChange={(requiresTicket) => onUpdate({ requires_ticket: requiresTicket })}
		/>
	</EditorSubGroup>

	{#if mode === 'edit'}
		<EditorSubGroup title={m['detailsStep.admissionScreening']()}>
			<AdmissionScreeningSection
				bare
				{formData}
				{eventId}
				{organizationId}
				{accessToken}
				{questionnaires}
				{onUpdate}
				onAssignQuestionnaire={() => (isQuestionnaireModalOpen = true)}
			/>
		</EditorSubGroup>

		<EditorSubGroup title={m['eventEditor.subGuestAttendance']()}>
			<label
				class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
			>
				<input
					type="checkbox"
					checked={formData.can_attend_without_login || false}
					onchange={(e) => onUpdate({ can_attend_without_login: e.currentTarget.checked })}
					class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
				/>
				<div class="flex-1">
					<div class="font-medium">{m['detailsStep.canAttendWithoutLogin']()}</div>
					<div class="text-sm text-muted-foreground">
						{m['detailsStep.canAttendWithoutLoginHint']()}
					</div>
				</div>
			</label>

			{#if formData.can_attend_without_login}
				<div class="rounded-lg border border-destructive bg-destructive/10 p-4" role="alert">
					<div class="flex items-start gap-3">
						<AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
						<div class="flex-1 space-y-1">
							<p class="font-medium text-destructive">
								{m['detailsStep.guestAttendanceWarningTitle']()}
							</p>
							<p class="text-sm text-destructive/90">
								{m['detailsStep.guestAttendanceWarningBody']()}
							</p>
						</div>
					</div>
				</div>
			{/if}
		</EditorSubGroup>
	{/if}
</EditorSection>

<!-- Questionnaire Assignment Modal -->
{#if isQuestionnaireModalOpen && eventId && organizationId && organizationSlug && accessToken}
	<EventQuestionnaireAssignmentModal
		bind:open={isQuestionnaireModalOpen}
		{eventId}
		currentlyAssigned={questionnaires}
		{organizationId}
		{organizationSlug}
		{accessToken}
		onClose={() => (isQuestionnaireModalOpen = false)}
	/>
{/if}
