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
	import { Edit, Eye, FileText, Trash2 } from 'lucide-svelte';
	import type { OrganizationQuestionnaireInListSchema } from '$lib/api/generated';
	import { questionnaireDeleteOrgQuestionnaire } from '$lib/api/generated/sdk.gen';
	import { invalidateAll } from '$app/navigation';

	interface Props {
		questionnaire: OrganizationQuestionnaireInListSchema;
		organizationSlug: string;
	}

	let { questionnaire, organizationSlug }: Props = $props();

	// Delete state
	let isDeleting = $state(false);

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

	// Event assignment count (events + series)
	const assignmentCount = $derived(
		(questionnaire.events?.length || 0) + (questionnaire.event_series?.length || 0)
	);

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
				<CardDescription class="mt-1">
					<Badge variant={typeVariant} class="text-xs">
						{typeLabel}
					</Badge>
				</CardDescription>
			</div>
			<FileText class="h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
		</div>
	</CardHeader>
	<CardContent>
		<div class="space-y-4">
			<!-- Stats -->
			<div class="flex gap-4 text-sm text-muted-foreground">
				{#if assignmentCount > 0}
					<div>
						<span class="font-medium text-foreground">{assignmentCount}</span>
						{assignmentCount === 1 ? 'assignment' : 'assignments'}
					</div>
				{:else}
					<div>Not assigned to any events</div>
				{/if}
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
					class="flex-1 gap-2"
				>
					<Eye class="h-4 w-4" />
					Submissions
				</Button>
			</div>

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
