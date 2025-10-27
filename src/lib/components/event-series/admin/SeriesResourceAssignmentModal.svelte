<script lang="ts">
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Badge } from '$lib/components/ui/badge';
	import { Search, Loader2, Box, AlertCircle, FileText, Link, File } from 'lucide-svelte';
	import {
		organizationadminListResources,
		organizationadminUpdateResource,
		type AdditionalResourceSchema,
		type EventSeriesRetrieveSchema
	} from '$lib/api/generated';
	import { invalidateAll } from '$app/navigation';

	interface Props {
		open: boolean;
		series: EventSeriesRetrieveSchema;
		organizationSlug: string;
		accessToken: string;
		onClose: () => void;
	}

	let { open = $bindable(), series, organizationSlug, accessToken, onClose }: Props = $props();

	// State
	let searchQuery = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let allResources = $state<AdditionalResourceSchema[]>([]);
	let selectedIds = $state<Set<string>>(new Set());

	// Get currently assigned resources from series
	function getCurrentlyAssigned(): string[] {
		// Check if series has additional_resources field
		if ('additional_resources' in series && Array.isArray(series.additional_resources)) {
			return series.additional_resources.map((r: any) => r.id);
		}
		return [];
	}

	// Initialize selected IDs from currently assigned
	$effect(() => {
		if (open) {
			selectedIds = new Set(getCurrentlyAssigned());
			loadResources();
		}
	});

	async function loadResources() {
		isLoading = true;
		try {
			const response = await organizationadminListResources({
				path: { slug: organizationSlug },
				query: {
					page_size: 100
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.data) {
				allResources = response.data.results || [];
			}
		} catch (err) {
			console.error('Failed to load resources:', err);
			alert('Failed to load resources. Please try again.');
		} finally {
			isLoading = false;
		}
	}

	// Filtered resources based on search
	const filteredResources = $derived(
		allResources.filter((r) => {
			const query = searchQuery.toLowerCase().trim();
			if (!query) return true;

			return (
				r.name.toLowerCase().includes(query) ||
				(r.description && r.description.toLowerCase().includes(query))
			);
		})
	);

	// Toggle resource selection
	function toggleResource(id: string) {
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
			const originalIds = new Set(getCurrentlyAssigned());

			// Find resources to update
			const toAssign = Array.from(selectedIds).filter((id) => !originalIds.has(id));
			const toUnassign = Array.from(originalIds).filter((id) => !selectedIds.has(id));

			// Assign resources to this series
			for (const resourceId of toAssign) {
				const resource = allResources.find((r) => r.id === resourceId);
				if (!resource) continue;

				// Get current series assignments
				const currentSeriesIds = (resource.event_series || []).map((s: any) => s.id);

				// Add this series
				const updatedSeriesIds = [...currentSeriesIds, series.id];

				const response = await organizationadminUpdateResource({
					path: { slug: organizationSlug, resource_id: resourceId },
					body: { event_series_ids: updatedSeriesIds },
					headers: { Authorization: `Bearer ${accessToken}` }
				});

				if (response.error) {
					throw new Error(`Failed to assign resource ${resourceId}`);
				}
			}

			// Unassign resources from this series
			for (const resourceId of toUnassign) {
				const resource = allResources.find((r) => r.id === resourceId);
				if (!resource) continue;

				// Get current series assignments and remove this series
				const currentSeriesIds = (resource.event_series || []).map((s: any) => s.id);
				const updatedSeriesIds = currentSeriesIds.filter((id: string) => id !== series.id);

				const response = await organizationadminUpdateResource({
					path: { slug: organizationSlug, resource_id: resourceId },
					body: { event_series_ids: updatedSeriesIds },
					headers: { Authorization: `Bearer ${accessToken}` }
				});

				if (response.error) {
					throw new Error(`Failed to unassign resource ${resourceId}`);
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

	// Resource type labels
	const typeLabels: Record<string, string> = {
		link: 'Link',
		text: 'Text',
		file: 'File'
	};

	// Resource type icons
	function getResourceIcon(type: string) {
		switch (type) {
			case 'link':
				return Link;
			case 'text':
				return FileText;
			case 'file':
				return File;
			default:
				return Box;
		}
	}

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
			<DialogTitle>Assign Resources to Event Series</DialogTitle>
			<p class="mt-1 text-sm text-muted-foreground">
				Select which resources should be available for events in "{series.name}"
			</p>
		</DialogHeader>

		<!-- Warning Banner -->
		<div class="mx-6 mt-4 flex gap-2 rounded-md bg-orange-50 p-3 text-sm dark:bg-orange-950">
			<AlertCircle
				class="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400"
				aria-hidden="true"
			/>
			<p class="text-orange-900 dark:text-orange-100">
				<strong>Applies to all events:</strong> Resources assigned here will be available for
				<strong>all events</strong> in this series, including future events.
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
					placeholder="Search resources..."
					bind:value={searchQuery}
					class="pl-10"
					aria-label="Search resources"
				/>
			</div>
		</div>

		<!-- Resources List -->
		<div class="max-h-96 overflow-y-auto px-6 py-4">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
					<span class="ml-2 text-sm text-muted-foreground">Loading resources...</span>
				</div>
			{:else if filteredResources.length === 0}
				<div class="py-12 text-center">
					<Box class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
					<p class="text-sm text-muted-foreground">
						{searchQuery ? 'No resources match your search' : 'No resources available'}
					</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each filteredResources as resource (resource.id)}
						{@const Icon = getResourceIcon(resource.type)}
						<button
							type="button"
							onclick={() => toggleResource(resource.id)}
							class="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
							class:border-primary={selectedIds.has(resource.id)}
							class:bg-accent={selectedIds.has(resource.id)}
						>
							<Checkbox
								checked={selectedIds.has(resource.id)}
								onCheckedChange={() => toggleResource(resource.id)}
								aria-label={`Select ${resource.name}`}
								class="mt-1"
							/>
							<div class="min-w-0 flex-1">
								<div class="flex items-start justify-between gap-2">
									<div class="flex items-center gap-2">
										<Icon class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
										<h3 class="line-clamp-1 font-medium">{resource.name}</h3>
									</div>
									<Badge variant="outline" class="flex-shrink-0 text-xs">
										{typeLabels[resource.type] || resource.type}
									</Badge>
								</div>
								{#if resource.description}
									<p class="mt-1 line-clamp-2 text-sm text-muted-foreground">
										{resource.description}
									</p>
								{/if}
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
					{selectedIds.size === 1 ? 'resource' : 'resources'} selected
				</div>
				<div class="flex gap-2">
					<Button variant="outline" onclick={onClose} disabled={isSaving}>Cancel</Button>
					<Button onclick={saveAssignments} disabled={!hasChanges || isSaving}>
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
