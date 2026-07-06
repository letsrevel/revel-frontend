<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Badge } from '$lib/components/ui/badge';
	import { Search, Loader2, FileText, AlertCircle } from '@lucide/svelte';
	import {
		questionnaireListOrgQuestionnaires,
		questionnaireReplaceEventSeries,
		type OrganizationQuestionnaireInListSchema,
		type EventSeriesRetrieveSchema
	} from '$lib/api/generated';
	import { invalidateAll } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';

	interface Props {
		open: boolean;
		series: EventSeriesRetrieveSchema;
		organizationId: string;
		accessToken: string;
		onClose: () => void;
	}

	let { open = $bindable(), series, organizationId, accessToken, onClose }: Props = $props();

	// State
	let searchQuery = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let allQuestionnaires = $state<OrganizationQuestionnaireInListSchema[]>([]);
	const selectedIds = new SvelteSet<string>();

	// Get currently assigned questionnaires from series
	function getCurrentlyAssigned(): string[] {
		// Check if series has questionnaires field
		if ('questionnaires' in series && Array.isArray(series.questionnaires)) {
			return series.questionnaires.map((q: { id: string }) => q.id);
		}
		// Check if series has organization_questionnaires field
		if (
			'organization_questionnaires' in series &&
			Array.isArray(series.organization_questionnaires)
		) {
			return series.organization_questionnaires.map((q: { id: string }) => q.id);
		}
		return [];
	}

	// Initialize selected IDs from currently assigned
	$effect(() => {
		if (open) {
			selectedIds.clear();
			for (const id of getCurrentlyAssigned()) selectedIds.add(id);
			loadQuestionnaires();
		}
	});

	async function loadQuestionnaires() {
		isLoading = true;
		try {
			const response = await questionnaireListOrgQuestionnaires({
				query: {
					organization_id: organizationId,
					page_size: 100
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.data) {
				allQuestionnaires = response.data.results || [];
			}
		} catch (err) {
			console.error('Failed to load questionnaires:', err);
			alert(m['seriesQuestionnaireAssignmentModal.loadError']());
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
		if (selectedIds.has(id)) {
			selectedIds.delete(id);
		} else {
			selectedIds.add(id);
		}
	}

	// Save assignments
	async function saveAssignments() {
		isSaving = true;

		try {
			// Find the org questionnaire IDs to assign
			const questionnairesToAssign = Array.from(selectedIds);

			// Execute assignment using the questionnaireReplaceEventSeries API
			// We need to do this for each selected questionnaire
			for (const questionnaireId of questionnairesToAssign) {
				const response = await questionnaireReplaceEventSeries({
					path: { org_questionnaire_id: questionnaireId },
					body: { event_series_ids: [series.id] },
					headers: { Authorization: `Bearer ${accessToken}` }
				});

				if (response.error) {
					throw new Error(`Failed to assign questionnaire ${questionnaireId}`);
				}
			}

			// For unselected questionnaires, we need to remove this series from their assigned series
			const originalIds = new Set(getCurrentlyAssigned());
			const toUnassign = Array.from(originalIds).filter((id) => !selectedIds.has(id));

			for (const questionnaireId of toUnassign) {
				// Get the questionnaire's current series assignments
				const questionnaire = allQuestionnaires.find((q) => q.id === questionnaireId);
				if (
					questionnaire &&
					'event_series' in questionnaire &&
					Array.isArray(questionnaire.event_series)
				) {
					// Remove this series from the list
					const remainingSeriesIds = questionnaire.event_series
						.filter((s: { id: string }) => s.id !== series.id)
						.map((s: { id: string }) => s.id);

					const response = await questionnaireReplaceEventSeries({
						path: { org_questionnaire_id: questionnaireId },
						body: { event_series_ids: remainingSeriesIds },
						headers: { Authorization: `Bearer ${accessToken}` }
					});

					if (response.error) {
						throw new Error(`Failed to unassign questionnaire ${questionnaireId}`);
					}
				}
			}

			// Refresh data and close modal
			await invalidateAll();
			onClose();
		} catch (err) {
			console.error('Failed to save assignments:', err);
			alert(m['seriesQuestionnaireAssignmentModal.saveError']());
		} finally {
			isSaving = false;
		}
	}

	// Type labels
	const typeLabels: Record<string, string> = {
		admission: m['seriesQuestionnaireAssignmentModal.typeAdmission'](),
		membership: m['seriesQuestionnaireAssignmentModal.typeMembership'](),
		feedback: m['seriesQuestionnaireAssignmentModal.typeFeedback'](),
		generic: m['seriesQuestionnaireAssignmentModal.typeGeneric']()
	};

	// Status labels
	const statusLabels: Record<string, string> = {
		draft: m['seriesQuestionnaireAssignmentModal.statusDraft'](),
		ready: m['seriesQuestionnaireAssignmentModal.statusReady'](),
		published: m['seriesQuestionnaireAssignmentModal.statusPublished']()
	};

	// Check if there are changes
	const hasChanges = $derived.by(() => {
		const originalIds = new Set(getCurrentlyAssigned());
		if (originalIds.size !== selectedIds.size) return true;
		return ![...originalIds].every((id) => selectedIds.has(id));
	});
</script>

<Dialog bind:open>
	<DialogContent class="max-h-[90vh] max-w-2xl overflow-hidden p-0">
		<DialogHeader class="border-b p-6 pb-4">
			<DialogTitle>{m['seriesQuestionnaireAssignmentModal.assignQuestionnaires']()}</DialogTitle>
			<p class="mt-1 text-sm text-muted-foreground">
				{m['seriesQuestionnaireAssignmentModal.subtitle']({ seriesName: series.name })}
			</p>
		</DialogHeader>

		<!-- Warning Banner -->
		<div class="mx-6 mt-4 flex gap-2 rounded-md bg-orange-50 p-3 text-sm dark:bg-orange-950">
			<AlertCircle
				class="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400"
				aria-hidden="true"
			/>
			<p class="text-orange-900 dark:text-orange-100">
				<strong>{m['seriesQuestionnaireAssignmentModal.appliesToAllEvents']()}</strong>
				{m['seriesQuestionnaireAssignmentModal.allEventsSuffix']()}
			</p>
		</div>

		<!-- Search Bar -->
		<div class="border-b px-6 py-4">
			<div class="relative">
				<Search
					class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					type="text"
					placeholder={m['seriesQuestionnaireAssignmentModal.searchPlaceholder']()}
					bind:value={searchQuery}
					class="pl-10"
					aria-label={m['seriesQuestionnaireAssignmentModal.searchLabel']()}
				/>
			</div>
		</div>

		<!-- Questionnaires List -->
		<div class="max-h-96 overflow-y-auto px-6 py-4">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
					<span class="ml-2 text-sm text-muted-foreground"
						>{m['seriesQuestionnaireAssignmentModal.loadingQuestionnaires']()}</span
					>
				</div>
			{:else if filteredQuestionnaires.length === 0}
				<div class="py-12 text-center">
					<FileText class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
					<p class="text-sm text-muted-foreground">
						{searchQuery
							? m['seriesQuestionnaireAssignmentModal.noneMatch']()
							: m['seriesQuestionnaireAssignmentModal.noneAvailable']()}
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
							<div
								onclick={(e) => e.stopPropagation()}
								onkeydown={(e) => e.stopPropagation()}
								role="presentation"
							>
								<Checkbox
									checked={selectedIds.has(questionnaire.id)}
									onCheckedChange={() => toggleQuestionnaire(questionnaire.id)}
									aria-label={m['seriesQuestionnaireAssignmentModal.selectItem']({
										name: questionnaire.questionnaire.name
									})}
									class="mt-1"
								/>
							</div>
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
					{selectedIds.size === 1
						? m['seriesQuestionnaireAssignmentModal.countSingular']()
						: m['seriesQuestionnaireAssignmentModal.countPlural']()}
					{m['seriesQuestionnaireAssignmentModal.selectedSuffix']()}
				</div>
				<div class="flex gap-2">
					<Button variant="outline" onclick={onClose} disabled={isSaving}
						>{m['seriesQuestionnaireAssignmentModal.cancel']()}</Button
					>
					<Button onclick={saveAssignments} disabled={!hasChanges || isSaving}>
						{#if isSaving}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							{m['seriesQuestionnaireAssignmentModal.saving']()}
						{:else}
							{m['seriesQuestionnaireAssignmentModal.saveAssignments']()}
						{/if}
					</Button>
				</div>
			</div>
		</div>
	</DialogContent>
</Dialog>
