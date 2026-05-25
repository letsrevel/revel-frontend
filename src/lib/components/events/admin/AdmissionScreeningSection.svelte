<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { ShieldCheck, ChevronDown, ChevronRight } from 'lucide-svelte';
	import EventQuestionnaires from './EventQuestionnaires.svelte';
	import type { EventCreateSchema } from '$lib/api/generated/types.gen';
	import type { OrganizationQuestionnaireInListSchema } from '$lib/api/generated';

	type AdmissionFormShape = Partial<EventCreateSchema> & {
		requires_full_profile?: boolean;
	};

	interface Props {
		formData: AdmissionFormShape;
		isOpen: boolean;
		onToggle: () => void;
		onUpdate: (data: AdmissionFormShape) => void;
		/** Present only once the event is saved — questionnaires are assigned by id. */
		eventId?: string | null;
		organizationId?: string;
		accessToken?: string;
		questionnaires?: OrganizationQuestionnaireInListSchema[];
		/** Opens the questionnaire-assignment modal (owned by the parent). */
		onAssignQuestionnaire: () => void;
	}

	const {
		formData,
		isOpen,
		onToggle,
		onUpdate,
		eventId = null,
		organizationId = '',
		accessToken = '',
		questionnaires = [],
		onAssignQuestionnaire
	}: Props = $props();
</script>

<!-- Admission & Screening Section -->
<div class="overflow-hidden rounded-lg border border-border">
	<button
		type="button"
		onclick={onToggle}
		class="flex w-full items-center justify-between bg-muted/50 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		aria-expanded={isOpen}
	>
		<div class="flex items-center gap-2 font-semibold">
			<ShieldCheck class="h-5 w-5" aria-hidden="true" />
			{m['detailsStep.admissionScreening']()}
		</div>
		{#if isOpen}
			<ChevronDown class="h-5 w-5" aria-hidden="true" />
		{:else}
			<ChevronRight class="h-5 w-5" aria-hidden="true" />
		{/if}
	</button>

	{#if isOpen}
		<div class="space-y-4 p-4">
			<!-- Require Full Profile -->
			<label
				class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
			>
				<input
					type="checkbox"
					checked={formData.requires_full_profile || false}
					onchange={(e) => onUpdate({ requires_full_profile: e.currentTarget.checked })}
					class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
				/>
				<div class="flex-1">
					<div class="font-medium">
						{m['detailsStep.requireFullProfile']?.() ?? 'Require Complete Profile'}
					</div>
					<div class="text-sm text-muted-foreground">
						{m['detailsStep.requireFullProfileHint']?.() ??
							'Attendees must have a profile picture, name, and pronouns to RSVP or purchase tickets'}
					</div>
				</div>
			</label>

			<!-- Accept Invitation Requests -->
			<label
				class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
			>
				<input
					type="checkbox"
					checked={formData.accept_invitation_requests || false}
					onchange={(e) => onUpdate({ accept_invitation_requests: e.currentTarget.checked })}
					class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
				/>
				<div class="flex-1">
					<div class="font-medium">{m['detailsStep.acceptInvitationRequests']()}</div>
					<div class="text-sm text-muted-foreground">
						{m['detailsStep.invitationRequestHint']()}
					</div>
				</div>
			</label>

			<!-- Questionnaires -->
			{#if eventId && organizationId && accessToken}
				<EventQuestionnaires
					{eventId}
					assignedQuestionnaires={questionnaires}
					{organizationId}
					{accessToken}
					onAssignClick={onAssignQuestionnaire}
				/>
			{:else if questionnaires.length > 0}
				<div class="space-y-2">
					<p class="text-sm text-muted-foreground">
						{m['detailsStep.saveToAssignQuestionnaires']()}
					</p>
				</div>
			{/if}

			<!-- Application Deadline (Apply Before) -->
			<div class="space-y-2">
				<label for="apply-before" class="block text-sm font-medium">
					{m['detailsStep.applicationDeadline']?.() ?? 'Application Deadline'}
				</label>
				<input
					id="apply-before"
					type="datetime-local"
					value={formData.apply_before || ''}
					oninput={(e) => onUpdate({ apply_before: e.currentTarget.value || null })}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				/>
				<p class="text-xs text-muted-foreground">
					{m['detailsStep.applicationDeadlineHint']?.({
						timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
					}) ??
						`Deadline for submitting invitation requests or questionnaires. Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}
				</p>
			</div>
		</div>
	{/if}
</div>
