<script lang="ts">
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Badge } from '$lib/components/ui/badge';
	import { Search, Loader2, FileText, Plus } from 'lucide-svelte';
	import {
		questionnaireListOrgQuestionnaires,
		questionnaireAssignEvent,
		questionnaireUnassignEvent,
		type OrganizationQuestionnaireInListSchema
	} from '$lib/api/generated';
	import { invalidateAll } from '$app/navigation';

	interface Props {
		open: boolean;
		eventId: string;
		currentlyAssigned: OrganizationQuestionnaireInListSchema[];
		organizationId: string;
		organizationSlug: string;
		accessToken: string;
		onClose: () => void;
	}

	let {
		open = $bindable(),
		eventId,
		currentlyAssigned,
		organizationId,
		organizationSlug,
		accessToken,
		onClose
	}: Props = $props();

	// State
	let searchQuery = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let allQuestionnaires = $state<OrganizationQuestionnaireInListSchema[]>([]);
	let selectedIds = $state<Set<string>>(new Set());

	// Initialize selected IDs from currently assigned
	$effect(() => {
		if (open) {
			selectedIds = new Set(currentlyAssigned.map((q) => q.id));
			loadQuestionnaires();
		}
	});

	async function loadQuestionnaires() {
		isLoading = true;
		try {
			const response = await questionnaireListOrgQuestionnaires({
				query: {
					organization_id: organizationId,
					page_size: 100 // Fetch all org questionnaires
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.data) {
				allQuestionnaires = response.data.results || [];
			}
		} catch (err) {
			console.error('Failed to load questionnaires:', err);
			alert('Failed to load questionnaires. Please try again.');
		} finally {
			isLoading = false;
		}
	}

	// Filtered questionnaires based on search
	const filteredQuestionnaires = $derived(
		allQuestionnaires.filter((q) => {
			const query = searchQuery.toLowerCase().trim();
			if (!query) return true;

			return (
				q.questionnaire.name.toLowerCase().includes(query) ||
				q.questionnaire_type.toLowerCase().includes(query)
			);
		})
	);

	// Toggle questionnaire selection
	function toggleQuestionnaire(id: string) {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

	// Save assignments
	async function saveAssignments() {
		isSaving = true;

		try {
			const originalIds = new Set(currentlyAssigned.map((q) => q.id));

			// Find questionnaires to assign (newly selected)
			const toAssign = Array.from(selectedIds).filter((id) => !originalIds.has(id));

			// Find questionnaires to unassign (previously selected but now deselected)
			const toUnassign = Array.from(originalIds).filter((id) => !selectedIds.has(id));

			// Execute assignments
			for (const questionnaireId of toAssign) {
				const response = await questionnaireAssignEvent({
					path: {
						org_questionnaire_id: questionnaireId,
						event_id: eventId
					},
					headers: { Authorization: `Bearer ${accessToken}` }
				});

				if (response.error) {
					throw new Error(`Failed to assign questionnaire ${questionnaireId}`);
				}
			}

			// Execute unassignments
			for (const questionnaireId of toUnassign) {
				const response = await questionnaireUnassignEvent({
					path: {
						org_questionnaire_id: questionnaireId,
						event_id: eventId
					},
					headers: { Authorization: `Bearer ${accessToken}` }
				});

				if (response.error) {
					throw new Error(`Failed to unassign questionnaire ${questionnaireId}`);
				}
			}

			// Refresh data and close modal
			await invalidateAll();
			onClose();
		} catch (err) {
			console.error('Failed to save assignments:', err);
			alert('Failed to save assignments. Please try again.');
		} finally {
			isSaving = false;
		}
	}

	// Type labels
	const typeLabels: Record<string, string> = {
		admission: 'Admission',
		membership: 'Membership',
		feedback: 'Feedback',
		generic: 'Generic'
	};

	// Status labels
	const statusLabels: Record<string, string> = {
		draft: 'Draft',
		ready: 'Ready',
		published: 'Published'
	};

	// Check if there are changes
	const hasChanges = $derived(() => {
		const originalIds = new Set(currentlyAssigned.map((q) => q.id));
		if (originalIds.size !== selectedIds.size) return true;
		return ![...originalIds].every((id) => selectedIds.has(id));
	});
</script>

<Dialog bind:open>
	<DialogContent class="max-h-[90vh] max-w-2xl overflow-hidden p-0">
		<DialogHeader class="border-b p-6 pb-4">
			<div class="flex items-start justify-between">
				<div>
					<DialogTitle>Assign Questionnaires to Event</DialogTitle>
					<p class="mt-1 text-sm text-muted-foreground">
						Select which questionnaires users must complete to RSVP or purchase tickets
					</p>
				</div>
				<Button
					href="/org/{organizationSlug}/admin/questionnaires/new"
					variant="outline"
					size="sm"
					class="gap-2"
				>
					<Plus class="h-4 w-4" />
					New Questionnaire
				</Button>
			</div>
		</DialogHeader>

		<!-- Search Bar -->
		<div class="border-b px-6 py-4">
			<div class="relative">
				<Search
					class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					type="text"
					placeholder="Search questionnaires..."
					bind:value={searchQuery}
					class="pl-10"
					aria-label="Search questionnaires"
				/>
			</div>
		</div>

		<!-- Questionnaires List -->
		<div class="max-h-96 overflow-y-auto px-6 py-4">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
					<span class="ml-2 text-sm text-muted-foreground">Loading questionnaires...</span>
				</div>
			{:else if filteredQuestionnaires.length === 0}
				<div class="py-12 text-center">
					<FileText class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
					<p class="text-sm text-muted-foreground">
						{searchQuery ? 'No questionnaires match your search' : 'No questionnaires available'}
					</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each filteredQuestionnaires as questionnaire (questionnaire.id)}
						<button
							type="button"
							onclick={() => toggleQuestionnaire(questionnaire.id)}
							class="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
							class:border-primary={selectedIds.has(questionnaire.id)}
							class:bg-accent={selectedIds.has(questionnaire.id)}
						>
							<Checkbox
								checked={selectedIds.has(questionnaire.id)}
								onCheckedChange={() => toggleQuestionnaire(questionnaire.id)}
								aria-label={`Select ${questionnaire.questionnaire.name}`}
								class="mt-1"
							/>
							<div class="min-w-0 flex-1">
								<div class="flex items-start justify-between gap-2">
									<h3 class="line-clamp-1 font-medium">{questionnaire.questionnaire.name}</h3>
									<div class="flex flex-shrink-0 gap-1">
										<Badge variant="outline" class="text-xs">
											{typeLabels[questionnaire.questionnaire_type] ||
												questionnaire.questionnaire_type}
										</Badge>
										<Badge
											variant={questionnaire.questionnaire.status === 'published'
												? 'default'
												: 'secondary'}
											class="text-xs"
										>
											{statusLabels[questionnaire.questionnaire.status] ||
												questionnaire.questionnaire.status}
										</Badge>
									</div>
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="border-t bg-muted/30 px-6 py-4">
			<div class="flex items-center justify-between">
				<div class="text-sm text-muted-foreground">
					<span class="font-medium text-foreground">{selectedIds.size}</span>
					{selectedIds.size === 1 ? 'questionnaire' : 'questionnaires'} selected
				</div>
				<div class="flex gap-2">
					<Button variant="outline" onclick={onClose} disabled={isSaving}>Cancel</Button>
					<Button onclick={saveAssignments} disabled={!hasChanges() || isSaving}>
						{#if isSaving}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							Saving...
						{:else}
							Save Assignments
						{/if}
					</Button>
				</div>
			</div>
		</div>
	</DialogContent>
</Dialog>
