<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Plus, X, FileText, AlertTriangle } from 'lucide-svelte';
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
			m['eventQuestionnaires.confirmUnassign']({ name: questionnaireName })
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
			alert(m['eventQuestionnaires.error_failedToUnassign']());
		} finally {
			unassigning = null;
		}
	}

	// Type and status labels
	const typeLabels: Record<string, () => string> = {
		admission: () => m['eventQuestionnaires.type_admission'](),
		membership: () => m['eventQuestionnaires.type_membership'](),
		feedback: () => m['eventQuestionnaires.type_feedback'](),
		generic: () => m['eventQuestionnaires.type_generic']()
	};

	// Status styling
	const statusStyles: Record<string, { bg: string; text: string; label: () => string }> = {
		draft: {
			bg: 'bg-amber-100 dark:bg-amber-900/30',
			text: 'text-amber-700 dark:text-amber-300',
			label: () => m['eventQuestionnaires.status_draft']()
		},
		ready: {
			bg: 'bg-blue-100 dark:bg-blue-900/30',
			text: 'text-blue-700 dark:text-blue-300',
			label: () => m['eventQuestionnaires.status_ready']()
		},
		published: {
			bg: 'bg-green-100 dark:bg-green-900/30',
			text: 'text-green-700 dark:text-green-300',
			label: () => m['eventQuestionnaires.status_published']()
		}
	};

	// Check if any questionnaire is not published
	const hasUnpublishedQuestionnaires = $derived(
		assignedQuestionnaires.some((q) => q.questionnaire.status !== 'published')
	);
</script>

<div class="space-y-4">
	<!-- Header with Add Button -->
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-sm font-medium">{m['eventQuestionnaires.requiredQuestionnaires']()}</h3>
			<p class="mt-1 text-xs text-muted-foreground">
				{m['eventQuestionnaires.description']()}
			</p>
		</div>
		<Button onclick={onAssignClick} variant="outline" size="sm" class="gap-2">
			<Plus class="h-4 w-4" />
			{m['eventQuestionnaires.assignQuestionnaires']()}
		</Button>
	</div>

	<!-- Warning if any questionnaire is not published -->
	{#if hasUnpublishedQuestionnaires}
		<div
			class="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 p-3 dark:border-orange-700 dark:bg-orange-950/50"
		>
			<AlertTriangle
				class="h-5 w-5 flex-shrink-0 text-orange-600 dark:text-orange-400"
				aria-hidden="true"
			/>
			<p class="text-sm text-orange-800 dark:text-orange-200">
				{m['eventQuestionnaires.unpublishedWarning']()}
			</p>
		</div>
	{/if}

	<!-- List of Assigned Questionnaires -->
	{#if assignedQuestionnaires.length === 0}
		<div class="rounded-lg border border-dashed p-8 text-center">
			<FileText class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
			<p class="text-sm font-medium">{m['eventQuestionnaires.noQuestionnairesAssigned']()}</p>
			<p class="mt-1 text-xs text-muted-foreground">
				{m['eventQuestionnaires.noQuestionnairesHint']()}
			</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each assignedQuestionnaires as questionnaire (questionnaire.id)}
				{@const status = questionnaire.questionnaire.status}
				{@const style = statusStyles[status] || statusStyles.draft}
				{@const isNotPublished = status !== 'published'}
				<div
					class="flex items-center justify-between rounded-lg border p-3 {isNotPublished
						? 'border-orange-200 dark:border-orange-800'
						: ''}"
				>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-2">
							{#if isNotPublished}
								<Tooltip.Root>
									<Tooltip.Trigger>
										<AlertTriangle
											class="h-4 w-4 text-orange-500"
											aria-label={m['eventQuestionnaires.notEnforcedTooltip']()}
										/>
									</Tooltip.Trigger>
									<Tooltip.Content>
										<p>{m['eventQuestionnaires.notEnforcedTooltip']()}</p>
									</Tooltip.Content>
								</Tooltip.Root>
							{/if}
							<p class="font-medium">{questionnaire.questionnaire.name}</p>
							<Badge variant="outline" class="text-xs">
								{typeLabels[questionnaire.questionnaire_type]?.() ||
									questionnaire.questionnaire_type}
							</Badge>
							<Badge class="{style.bg} {style.text} text-xs">
								{style.label()}
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
