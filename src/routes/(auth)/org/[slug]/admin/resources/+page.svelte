<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminresourcesListResources,
		organizationadminresourcesDeleteResource
	} from '$lib/api/generated/sdk.gen';
	import type { AdditionalResourceSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Plus, Search, Filter, AlertTriangle } from '@lucide/svelte';
	import ResourceList from '$lib/components/resources/ResourceList.svelte';
	import ResourceModal from '$lib/components/resources/ResourceModal.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Modal state
	let showModal = $state(false);
	let editingResource = $state<AdditionalResourceSchema | null>(null);

	// Filter state
	let searchQuery = $state('');
	let typeFilter = $state<'all' | 'file' | 'link' | 'text'>('all');
	let visibilityFilter = $state<
		'all' | 'public' | 'members-only' | 'staff-only' | 'attendees-only' | 'private'
	>('all');

	// Resources query
	const resourcesQuery = createQuery<AdditionalResourceSchema[]>(() => ({
		queryKey: ['organization-resources', organization.slug, typeFilter, searchQuery],
		queryFn: async () => {
			const response = await organizationadminresourcesListResources({
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
			const response = await organizationadminresourcesDeleteResource({
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
		if (confirm(m['orgAdmin.resources.confirmDelete']())) {
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
	{#snippet resourcesHeaderActions()}
		<button
			type="button"
			onclick={handleCreate}
			class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			<Plus class="h-5 w-5" aria-hidden="true" />
			{m['orgAdmin.resources.addResourceButton']()}
		</button>
	{/snippet}

	<PageHeader
		title={m['orgAdmin.resources.pageTitle']()}
		subtitle={m['orgAdmin.resources.pageDescription']()}
		actions={resourcesHeaderActions}
	/>

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
				placeholder={m['orgAdmin.resources.searchPlaceholder']()}
				class="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				aria-label={m['orgAdmin.resources.searchPlaceholder']()}
			/>
		</div>

		<!-- Type Filter -->
		<select
			bind:value={typeFilter}
			class="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			aria-label={m['orgAdmin.resources.filters.type.label']()}
		>
			<option value="all">{m['orgAdmin.resources.filters.type.allTypes']()}</option>
			<option value="file">{m['orgAdmin.resources.filters.type.files']()}</option>
			<option value="link">{m['orgAdmin.resources.filters.type.links']()}</option>
			<option value="text">{m['orgAdmin.resources.filters.type.text']()}</option>
		</select>

		<!-- Visibility Filter -->
		<select
			bind:value={visibilityFilter}
			class="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			aria-label={m['orgAdmin.resources.filters.visibility.label']()}
		>
			<option value="all">{m['orgAdmin.resources.filters.visibility.allVisibility']()}</option>
			<option value="public">{m['orgAdmin.resources.filters.visibility.public']()}</option>
			<option value="members-only"
				>{m['orgAdmin.resources.filters.visibility.membersOnly']()}</option
			>
			<option value="staff-only">{m['orgAdmin.resources.filters.visibility.staffOnly']()}</option>
			<option value="attendees-only"
				>{m['orgAdmin.resources.filters.visibility.attendeesOnly']()}</option
			>
			<option value="private">{m['orgAdmin.resources.filters.visibility.private']()}</option>
		</select>
	</div>

	<!-- Content -->
	{#if error}
		<!-- dark:bg-destructive/25 dark:text-destructive-foreground (AutoEvalRecommendation's
		     pattern): plain text-destructive on this /10 tint measured 2.69-2.95:1 in dark
		     mode, under the 3:1 non-text floor; the /25 tint + destructive-foreground (white)
		     icon pairing measures ~14-15:1 instead. -->
		<div
			class="flex gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 dark:bg-destructive/25"
			role="alert"
		>
			<AlertTriangle
				class="h-5 w-5 shrink-0 text-destructive dark:text-destructive-foreground"
				aria-hidden="true"
			/>
			<div>
				<p class="font-semibold text-foreground">{m['orgAdmin.resources.error.title']()}</p>
				<p class="mt-1 text-sm text-foreground">{m['orgAdmin.resources.error.description']()}</p>
			</div>
		</div>
	{:else if isLoading}
		<div class="flex items-center justify-center py-12">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
				aria-label={m['orgAdmin.resources.loading']()}
			></div>
		</div>
	{:else if resources.length === 0}
		<EmptyState
			icon={Filter}
			title={m['orgAdmin.resources.empty.title']()}
			body={searchQuery || typeFilter !== 'all' || visibilityFilter !== 'all'
				? m['orgAdmin.resources.empty.withFilters']()
				: m['orgAdmin.resources.empty.noFilters']()}
			action={!searchQuery && typeFilter === 'all' && visibilityFilter === 'all'
				? resourcesHeaderActions
				: undefined}
		/>
	{:else}
		<ResourceList
			{resources}
			onEdit={handleEdit}
			onDelete={handleDelete}
			isDeleting={deleteMutation.isPending}
		/>
	{/if}
</div>

<!-- Modal -->
{#if showModal}
	<ResourceModal
		resource={editingResource}
		organizationSlug={organization.slug}
		organizationId={organization.id}
		onClose={handleModalClose}
		onSuccess={handleModalSuccess}
	/>
{/if}
