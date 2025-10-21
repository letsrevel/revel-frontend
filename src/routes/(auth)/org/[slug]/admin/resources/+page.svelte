<script lang="ts">
	import { page } from '$app/stores';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminListResources,
		organizationadminDeleteResource
	} from '$lib/api/generated/sdk.gen';
	import type { AdditionalResourceSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Plus, Search, Filter } from 'lucide-svelte';
	import ResourceList from '$lib/components/resources/ResourceList.svelte';
	import ResourceModal from '$lib/components/resources/ResourceModal.svelte';

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Modal state
	let showModal = $state(false);
	let editingResource = $state<AdditionalResourceSchema | null>(null);

	// Filter state
	let searchQuery = $state('');
	let typeFilter = $state<'all' | 'file' | 'link' | 'text'>('all');
	let visibilityFilter = $state<'all' | 'public' | 'members-only' | 'staff-only' | 'private'>(
		'all'
	);

	// Resources query
	const resourcesQuery = createQuery<AdditionalResourceSchema[]>(() => ({
		queryKey: ['organization-resources', organization.slug, typeFilter, searchQuery],
		queryFn: async () => {
			const response = await organizationadminListResources({
				path: { slug: organization.slug },
				query: {
					resource_type: typeFilter !== 'all' ? typeFilter : undefined,
					search: searchQuery || undefined
				},
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

	// Client-side filtering for visibility
	const filteredResources = $derived.by(() => {
		let result = resourcesQuery.data || [];
		if (visibilityFilter !== 'all') {
			result = result.filter((r) => r.visibility === visibilityFilter);
		}
		return result;
	});

	// Delete mutation
	const deleteMutation = createMutation(() => ({
		mutationFn: async (resourceId: string) => {
			const response = await organizationadminDeleteResource({
				path: { slug: organization.slug, resource_id: resourceId },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to delete resource');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['organization-resources'] });
		}
	}));

	function handleCreate() {
		editingResource = null;
		showModal = true;
	}

	function handleEdit(resource: AdditionalResourceSchema) {
		editingResource = resource;
		showModal = true;
	}

	function handleDelete(resourceId: string) {
		if (confirm('Are you sure you want to delete this resource?')) {
			deleteMutation.mutate(resourceId);
		}
	}

	function handleModalClose() {
		showModal = false;
		editingResource = null;
	}

	function handleModalSuccess() {
		showModal = false;
		editingResource = null;
		queryClient.invalidateQueries({ queryKey: ['organization-resources'] });
	}

	const resources = $derived(filteredResources);
	const isLoading = $derived(resourcesQuery.isLoading);
	const error = $derived(resourcesQuery.error);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">Resources</h1>
			<p class="text-muted-foreground">Manage files, links, and content for your organization</p>
		</div>

		<button
			type="button"
			onclick={handleCreate}
			class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			<Plus class="h-5 w-5" aria-hidden="true" />
			Add Resource
		</button>
	</div>

	<!-- Filters -->
	<div class="flex flex-col gap-3 md:flex-row md:items-center">
		<!-- Search -->
		<div class="relative flex-1">
			<Search
				class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<input
				type="search"
				bind:value={searchQuery}
				placeholder="Search resources..."
				class="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				aria-label="Search resources"
			/>
		</div>

		<!-- Type Filter -->
		<select
			bind:value={typeFilter}
			class="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			aria-label="Filter by type"
		>
			<option value="all">All Types</option>
			<option value="file">Files</option>
			<option value="link">Links</option>
			<option value="text">Text</option>
		</select>

		<!-- Visibility Filter -->
		<select
			bind:value={visibilityFilter}
			class="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			aria-label="Filter by visibility"
		>
			<option value="all">All Visibility</option>
			<option value="public">Public</option>
			<option value="members-only">Members Only</option>
			<option value="staff-only">Staff Only</option>
			<option value="private">Private</option>
		</select>
	</div>

	<!-- Content -->
	{#if error}
		<div class="rounded-md bg-destructive/10 p-4 text-destructive" role="alert">
			<p class="font-semibold">Error</p>
			<p class="mt-1 text-sm">Failed to load resources. Please try again.</p>
		</div>
	{:else if isLoading}
		<div class="flex items-center justify-center py-12">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
				aria-label="Loading"
			></div>
		</div>
	{:else if resources.length === 0}
		<div
			class="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-600"
		>
			<Filter class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<h3 class="mt-4 text-lg font-semibold">No resources found</h3>
			<p class="mt-2 text-sm text-muted-foreground">
				{searchQuery || typeFilter !== 'all' || visibilityFilter !== 'all'
					? 'Try adjusting your filters'
					: 'Get started by creating your first resource'}
			</p>
			{#if !searchQuery && typeFilter === 'all' && visibilityFilter === 'all'}
				<button
					type="button"
					onclick={handleCreate}
					class="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<Plus class="h-5 w-5" aria-hidden="true" />
					Add Resource
				</button>
			{/if}
		</div>
	{:else}
		<ResourceList
			{resources}
			onEdit={handleEdit}
			onDelete={handleDelete}
			isDeleting={$deleteMutation.isPending}
		/>
	{/if}
</div>

<!-- Modal -->
{#if showModal}
	<ResourceModal
		resource={editingResource}
		organizationSlug={organization.slug}
		onClose={handleModalClose}
		onSuccess={handleModalSuccess}
	/>
{/if}
