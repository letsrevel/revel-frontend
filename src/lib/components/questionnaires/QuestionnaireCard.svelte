<script lang="ts">
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Edit, Eye, FileText, Trash2, CalendarCheck, AlertCircle } from 'lucide-svelte';
	import type {
		OrganizationQuestionnaireInListSchema,
		OrganizationQuestionnaireSchema
	} from '$lib/api/generated';
	import {
		questionnaireDeleteOrgQuestionnaire,
		questionnaireGetOrgQuestionnaire
	} from '$lib/api/generated/sdk.gen';
	import { invalidateAll } from '$app/navigation';
	import QuestionnaireAssignmentModal from './QuestionnaireAssignmentModal.svelte';
	import {
		Tooltip,
		TooltipContent,
		TooltipProvider,
		TooltipTrigger
	} from '$lib/components/ui/tooltip';

	interface Props {
		questionnaire: OrganizationQuestionnaireInListSchema;
		organizationSlug: string;
		organizationId: string;
		accessToken: string;
	}

	let { questionnaire, organizationSlug, organizationId, accessToken }: Props = $props();

	// Delete state
	let isDeleting = $state(false);

	// Assignment modal state
	let isAssignmentModalOpen = $state(false);
	let fullQuestionnaire = $state<OrganizationQuestionnaireSchema | null>(null);
	let isLoadingFullQuestionnaire = $state(false);

	// Open assignment modal (load full questionnaire data)
	async function openAssignmentModal() {
		isLoadingFullQuestionnaire = true;
		isAssignmentModalOpen = true;

		try {
			const response = await questionnaireGetOrgQuestionnaire({
				path: { org_questionnaire_id: questionnaire.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.data) {
				fullQuestionnaire = response.data;
			}
		} catch (err) {
			console.error('Failed to load questionnaire:', err);
			alert('Failed to load questionnaire. Please try again.');
			isAssignmentModalOpen = false;
		} finally {
			isLoadingFullQuestionnaire = false;
		}
	}

	// Format questionnaire type for display
	const typeLabels: Record<string, string> = {
		admission: 'Admission',
		membership: 'Membership',
		feedback: 'Feedback',
		generic: 'Generic'
	};

	const typeLabel = $derived(
		typeLabels[questionnaire.questionnaire_type] || questionnaire.questionnaire_type
	);

	// Get type badge variant
	const typeVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
		admission: 'default',
		membership: 'secondary',
		feedback: 'outline',
		generic: 'outline'
	};

	const typeVariant = $derived(typeVariants[questionnaire.questionnaire_type] || 'outline');

	// Status labels and variants
	const statusLabels: Record<string, string> = {
		draft: 'Draft',
		ready: 'Ready',
		published: 'Published'
	};

	const statusLabel = $derived(
		statusLabels[questionnaire.questionnaire.status] || questionnaire.questionnaire.status
	);

	// Get status badge variant
	const statusVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
		draft: 'outline',
		ready: 'secondary',
		published: 'default'
	};

	const statusVariant = $derived(statusVariants[questionnaire.questionnaire.status] || 'outline');

	// Event assignment count (events + series)
	const assignmentCount = $derived(
		(questionnaire.events?.length || 0) + (questionnaire.event_series?.length || 0)
	);

	// Create tooltip text for assigned events
	const assignmentTooltip = $derived(() => {
		const events = questionnaire.events || [];
		const series = questionnaire.event_series || [];
		const allAssignments = [
			...events.map((e) => e.name),
			...series.map((s) => `${s.name} (series)`)
		];

		if (allAssignments.length === 0) return 'Not assigned to any events';
		if (allAssignments.length <= 3) return `Assigned to ${allAssignments.join(', ')}`;

		const first = allAssignments.slice(0, 2).join(', ');
		const remaining = allAssignments.length - 2;
		return `Assigned to ${first} and ${remaining} more`;
	});

	// Handle delete
	async function handleDelete() {
		const confirmed = confirm(
			`Are you sure you want to delete "${questionnaire.questionnaire.name}"?\n\nThis action cannot be undone.`
		);

		if (!confirmed) return;

		isDeleting = true;

		try {
			const response = await questionnaireDeleteOrgQuestionnaire({
				path: { org_questionnaire_id: questionnaire.id }
			});

			if (response.error) {
				throw new Error('Failed to delete questionnaire');
			}

			// Refresh the page data
			await invalidateAll();
		} catch (err) {
			console.error('Failed to delete questionnaire:', err);
			alert('Failed to delete questionnaire. Please try again.');
		} finally {
			isDeleting = false;
		}
	}
</script>

<Card class="transition-all hover:shadow-md">
	<CardHeader>
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0 flex-1">
				<CardTitle class="line-clamp-1">{questionnaire.questionnaire.name}</CardTitle>
				<CardDescription class="mt-1 flex flex-wrap gap-1">
					<Badge variant={typeVariant} class="text-xs">
						{typeLabel}
					</Badge>
					<Badge variant={statusVariant} class="text-xs">
						{statusLabel}
					</Badge>
				</CardDescription>
			</div>
			<FileText class="h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
		</div>
	</CardHeader>
	<CardContent>
		<div class="space-y-4">
			<!-- Pending Evaluations Alert -->
			{#if questionnaire.pending_evaluations_count > 0}
				<div
					class="flex items-center gap-2 rounded-md border border-orange-500/50 bg-orange-50 px-3 py-2 text-sm text-orange-900 dark:border-orange-500/30 dark:bg-orange-950/20 dark:text-orange-200"
					role="status"
				>
					<AlertCircle class="h-4 w-4 shrink-0" aria-hidden="true" />
					<p class="font-medium">
						{questionnaire.pending_evaluations_count}
						{questionnaire.pending_evaluations_count === 1
							? 'submission needs'
							: 'submissions need'} review
					</p>
				</div>
			{/if}

			<!-- Stats with Tooltip -->
			<div class="flex gap-4 text-sm text-muted-foreground">
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger class="cursor-help underline decoration-dotted underline-offset-4">
							{#if assignmentCount > 0}
								<span>
									<span class="font-medium text-foreground">{assignmentCount}</span>
									{assignmentCount === 1 ? 'assignment' : 'assignments'}
								</span>
							{:else}
								<span>Not assigned to any events</span>
							{/if}
						</TooltipTrigger>
						<TooltipContent>
							<p class="max-w-xs text-sm">{assignmentTooltip()}</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>

			<!-- Actions -->
			<div class="flex gap-2">
				<Button
					href="/org/{organizationSlug}/admin/questionnaires/{questionnaire.id}"
					variant="outline"
					size="sm"
					class="flex-1 gap-2"
				>
					<Edit class="h-4 w-4" />
					Edit
				</Button>
				<Button
					href="/org/{organizationSlug}/admin/questionnaires/{questionnaire.id}/submissions"
					variant="outline"
					size="sm"
					class="relative flex-1 gap-2"
				>
					<Eye class="h-4 w-4" />
					Submissions
					{#if questionnaire.pending_evaluations_count > 0}
						<Badge
							variant="destructive"
							class="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs"
						>
							{questionnaire.pending_evaluations_count}
						</Badge>
					{/if}
				</Button>
			</div>

			<!-- Assign to Events Button -->
			<Button
				variant="outline"
				size="sm"
				onclick={openAssignmentModal}
				disabled={isLoadingFullQuestionnaire}
				class="w-full gap-2"
			>
				<CalendarCheck class="h-4 w-4" />
				Assign to Events
			</Button>

			<!-- Delete Button -->
			<Button
				variant="outline"
				size="sm"
				onclick={handleDelete}
				disabled={isDeleting}
				class="w-full gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
			>
				<Trash2 class="h-4 w-4" />
				{isDeleting ? 'Deleting...' : 'Delete'}
			</Button>
		</div>
	</CardContent>
</Card>

<!-- Assignment Modal -->
{#if isAssignmentModalOpen && fullQuestionnaire}
	<QuestionnaireAssignmentModal
		bind:open={isAssignmentModalOpen}
		questionnaire={fullQuestionnaire}
		{organizationId}
		{accessToken}
		onClose={() => (isAssignmentModalOpen = false)}
	/>
{/if}
