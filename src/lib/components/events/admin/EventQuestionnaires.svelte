<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Plus, X, FileText } from 'lucide-svelte';
	import type { OrganizationQuestionnaireInListSchema } from '$lib/api/generated';
	import { questionnaireUnassignEvent } from '$lib/api/generated/sdk.gen';
	import { invalidateAll } from '$app/navigation';

	interface Props {
		eventId: string | null;
		assignedQuestionnaires: OrganizationQuestionnaireInListSchema[];
		organizationId: string;
		accessToken: string;
		onAssignClick: () => void;
	}

	let {
		eventId,
		assignedQuestionnaires,
		organizationId: _organizationId,
		accessToken,
		onAssignClick
	}: Props = $props();

	let unassigning = $state<string | null>(null);

	// Unassign a questionnaire from this event
	async function unassignQuestionnaire(questionnaireId: string, questionnaireName: string) {
		if (!eventId) return;

		const confirmed = confirm(
			`Remove "${questionnaireName}" requirement from this event?\n\nUsers will no longer need to complete this questionnaire to RSVP.`
		);

		if (!confirmed) return;

		unassigning = questionnaireId;

		try {
			const response = await questionnaireUnassignEvent({
				path: {
					org_questionnaire_id: questionnaireId,
					event_id: eventId
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to unassign questionnaire');
			}

			await invalidateAll();
		} catch (err) {
			console.error('Failed to unassign questionnaire:', err);
			alert('Failed to remove questionnaire. Please try again.');
		} finally {
			unassigning = null;
		}
	}

	// Type and status labels
	const typeLabels: Record<string, string> = {
		admission: 'Admission',
		membership: 'Membership',
		feedback: 'Feedback',
		generic: 'Generic'
	};
</script>

<div class="space-y-4">
	<!-- Header with Add Button -->
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-sm font-medium">Required Questionnaires</h3>
			<p class="mt-1 text-xs text-muted-foreground">
				Questionnaires users must complete to RSVP or purchase tickets
			</p>
		</div>
		<Button onclick={onAssignClick} variant="outline" size="sm" class="gap-2">
			<Plus class="h-4 w-4" />
			Assign Questionnaires
		</Button>
	</div>

	<!-- List of Assigned Questionnaires -->
	{#if assignedQuestionnaires.length === 0}
		<div class="rounded-lg border border-dashed p-8 text-center">
			<FileText class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
			<p class="text-sm font-medium">No questionnaires assigned</p>
			<p class="mt-1 text-xs text-muted-foreground">
				Click "Assign Questionnaires" to require users to complete forms before RSVPing
			</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each assignedQuestionnaires as questionnaire (questionnaire.id)}
				<div class="flex items-center justify-between rounded-lg border p-3">
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<p class="font-medium">{questionnaire.questionnaire.name}</p>
							<Badge variant="outline" class="text-xs">
								{typeLabels[questionnaire.questionnaire_type] || questionnaire.questionnaire_type}
							</Badge>
						</div>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onclick={() =>
							unassignQuestionnaire(questionnaire.id, questionnaire.questionnaire.name)}
						disabled={unassigning === questionnaire.id}
						class="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
						aria-label={`Remove ${questionnaire.questionnaire.name}`}
					>
						<X class="h-4 w-4" />
					</Button>
				</div>
			{/each}
		</div>
	{/if}
</div>
