<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { organizationadminresourcesListResources } from '$lib/api/generated/sdk.gen';
	import type { AdditionalResourceSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { FileText, Link as LinkIcon, AlignLeft, ExternalLink, Plus } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		organizationSlug: string;
		eventId?: string | null;
		selectedResourceIds?: string[];
		onSelectionChange?: (resourceIds: string[]) => void;
		disabled?: boolean;
	}

	let {
		organizationSlug,
		eventId = null,
		selectedResourceIds = [],
		onSelectionChange,
		disabled = false
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	// Fetch organization resources
	const resourcesQuery = createQuery<AdditionalResourceSchema[]>(() => ({
		queryKey: ['organization-resources-for-event', organizationSlug, eventId],
		queryFn: async () => {
			const response = await organizationadminresourcesListResources({
				path: { slug: organizationSlug },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to load resources');
			}

			return response.data?.results || [];
		}
	}));

	// Local selected set
	let selectedSet = $state(new Set(selectedResourceIds));

	// Sync with prop changes
	$effect(() => {
		selectedSet = new Set(selectedResourceIds);
	});

	function toggleResource(resourceId: string) {
		if (disabled) return;

		const newSet = new Set(selectedSet);
		if (newSet.has(resourceId)) {
			newSet.delete(resourceId);
		} else {
			newSet.add(resourceId);
		}

		selectedSet = newSet;
		onSelectionChange?.(Array.from(newSet));
	}

	function isSelected(resourceId: string): boolean {
		return selectedSet.has(resourceId);
	}

	// Get icon based on resource type
	function getResourceIcon(type: string) {
		switch (type) {
			case 'file':
				return FileText;
			case 'link':
				return LinkIcon;
			case 'text':
				return AlignLeft;
			default:
				return FileText;
		}
	}

	const resources = $derived(resourcesQuery.data || []);
	const isLoading = $derived(resourcesQuery.isLoading);
	const error = $derived(resourcesQuery.error);

	// Track last fetch time for debounced refresh on focus
	let lastFetchTime = $state(Date.now());

	// Refresh resources when window regains focus (user returns from new tab after creating a resource)
	$effect(() => {
		function handleFocus() {
			// Debounce: only refresh if 2+ seconds have passed since last fetch
			if (Date.now() - lastFetchTime > 2000) {
				resourcesQuery.refetch();
				lastFetchTime = Date.now();
			}
		}

		window.addEventListener('focus', handleFocus);
		return () => window.removeEventListener('focus', handleFocus);
	});
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
				{m['eventResourcesAdmin.attachResources']()}
			</h3>
			<p class="mt-1 text-xs text-muted-foreground">
				{m['eventResourcesAdmin.makeResourcesAvailable']()}
			</p>
		</div>

		<a
			href="/org/{organizationSlug}/admin/resources"
			class="inline-flex items-center gap-1 rounded text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			target="_blank"
			rel="noopener noreferrer"
		>
			<Plus class="h-3 w-3" aria-hidden="true" />
			Add new resource
			<ExternalLink class="h-3 w-3" aria-hidden="true" />
		</a>
	</div>

	<!-- Resource List -->
	{#if error}
		<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
			Failed to load resources
		</div>
	{:else if isLoading}
		<div class="flex items-center justify-center py-8">
			<div
				class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
				aria-label="Loading resources"
			></div>
		</div>
	{:else if resources.length === 0}
		<div
			class="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center dark:border-gray-600"
		>
			<FileText class="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
			<p class="mt-2 text-sm text-muted-foreground">
				{m['eventResourcesAdmin.noResourcesAvailable']()}
			</p>
			<a
				href="/org/{organizationSlug}/admin/resources"
				class="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
				target="_blank"
				rel="noopener noreferrer"
			>
				Create your first resource
				<ExternalLink class="h-3 w-3" aria-hidden="true" />
			</a>
		</div>
	{:else}
		<div class="space-y-2">
			{#each resources as resource (resource.id)}
				{@const ResourceIcon = getResourceIcon(resource.resource_type)}
				<button
					type="button"
					onclick={() => resource.id && toggleResource(resource.id)}
					{disabled}
					class={cn(
						'flex w-full items-center gap-3 rounded-md border p-3 text-left transition-all hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
						isSelected(resource.id || '') && 'border-primary bg-primary/5'
					)}
				>
					<!-- Checkbox -->
					<div
						class={cn(
							'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
							isSelected(resource.id || '') ? 'border-primary bg-primary' : 'border-input'
						)}
					>
						{#if isSelected(resource.id || '')}
							<svg
								class="h-3 w-3 text-primary-foreground"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								aria-hidden="true"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="3"
									d="M5 13l4 4L19 7"
								/>
							</svg>
						{/if}
					</div>

					<!-- Resource Icon & Info -->
					<div class="flex min-w-0 flex-1 items-center gap-2">
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
							<ResourceIcon class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
						</div>

						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">
								{resource.name || 'Untitled Resource'}
							</p>
							<p class="text-xs text-muted-foreground">
								{resource.resource_type}
								{#if resource.visibility && resource.visibility !== 'public'}
									· {resource.visibility.replace('-', ' ')}
								{/if}
							</p>
						</div>
					</div>
				</button>
			{/each}
		</div>

		{#if selectedSet.size > 0}
			<p class="text-xs text-muted-foreground">
				{selectedSet.size}
				{selectedSet.size === 1 ? 'resource' : 'resources'} attached
			</p>
		{/if}
	{/if}
</div>
