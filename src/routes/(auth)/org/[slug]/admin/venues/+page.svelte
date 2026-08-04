<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminvenuesListVenues,
		organizationadminvenuesDeleteVenue
	} from '$lib/api/generated/sdk.gen';
	import type { VenueDetailSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Plus, Search, Building2 } from '@lucide/svelte';
	import VenueCard from '$lib/components/venues/VenueCard.svelte';
	import VenueModal from '$lib/components/venues/VenueModal.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { toast } from 'svelte-sonner';

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Modal state
	let showModal = $state(false);
	let editingVenue = $state<VenueDetailSchema | null>(null);

	// Search state
	let searchQuery = $state('');

	// Venues query
	const venuesQuery = createQuery<VenueDetailSchema[]>(() => ({
		queryKey: ['organization-venues', organization.slug, searchQuery],
		queryFn: async () => {
			const response = await organizationadminvenuesListVenues({
				path: { slug: organization.slug },
				query: {
					search: searchQuery || undefined
				},
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to load venues');
			}

			return response.data?.results || [];
		}
	}));

	// Delete mutation
	const deleteMutation = createMutation(() => ({
		mutationFn: async (venueId: string) => {
			const response = await organizationadminvenuesDeleteVenue({
				path: { slug: organization.slug, venue_id: venueId },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to delete venue');
			}

			return response.data;
		},
		onSuccess: () => {
			toast.success(m['orgAdmin.venues.delete.success']());
			queryClient.invalidateQueries({ queryKey: ['organization-venues'] });
		},
		onError: () => {
			toast.error(m['orgAdmin.venues.delete.error']());
		}
	}));

	function handleCreate() {
		editingVenue = null;
		showModal = true;
	}

	function handleEdit(venue: VenueDetailSchema) {
		editingVenue = venue;
		showModal = true;
	}

	function handleDelete(venueId: string) {
		if (confirm(m['orgAdmin.venues.delete.confirm']())) {
			deleteMutation.mutate(venueId);
		}
	}

	function handleManageSectors(venue: VenueDetailSchema) {
		goto(
			resolve('/(auth)/org/[slug]/admin/venues/[venue_id]', {
				slug: organization.slug,
				venue_id: venue.id ?? ''
			})
		);
	}

	function handleModalClose() {
		showModal = false;
		editingVenue = null;
	}

	function handleModalSuccess() {
		showModal = false;
		editingVenue = null;
		queryClient.invalidateQueries({ queryKey: ['organization-venues'] });
	}

	const venues = $derived(venuesQuery.data || []);
	const isLoading = $derived(venuesQuery.isLoading);
	const error = $derived(venuesQuery.error);
</script>

<svelte:head>
	<title>{m['orgAdmin.venues.pageTitle']()} - {organization.name}</title>
	<meta
		name="description"
		content={m['orgAdmin.venues.metaDescription']({ orgName: organization.name })}
	/>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	{#snippet headerActions()}
		<button
			type="button"
			onclick={handleCreate}
			class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			<Plus class="h-5 w-5" aria-hidden="true" />
			{m['orgAdmin.venues.createButton']()}
		</button>
	{/snippet}
	<!-- No kicker: orgAdmin.nav.venues and orgAdmin.venues.pageTitle are both
	     literally "Venues" — a kicker repeating the title verbatim is noise. -->
	<PageHeader
		title={m['orgAdmin.venues.pageTitle']()}
		subtitle={m['orgAdmin.venues.pageDescription']()}
		actions={headerActions}
	/>

	<!-- Search -->
	<div class="relative max-w-md">
		<Search
			class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			aria-hidden="true"
		/>
		<input
			type="search"
			bind:value={searchQuery}
			placeholder={m['orgAdmin.venues.searchPlaceholder']()}
			class="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			aria-label={m['orgAdmin.venues.searchPlaceholder']()}
		/>
	</div>

	<!-- Content -->
	{#if error}
		<div class="rounded-md bg-destructive/10 p-4 text-destructive" role="alert">
			<p class="font-semibold">{m['orgAdmin.venues.error.title']()}</p>
			<p class="mt-1 text-sm">{m['orgAdmin.venues.error.description']()}</p>
		</div>
	{:else if isLoading}
		<div class="flex items-center justify-center py-12">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
				aria-label={m['orgAdmin.venues.loading']()}
			></div>
		</div>
	{:else if venues.length === 0}
		<EmptyState
			icon={Building2}
			title={m['orgAdmin.venues.empty.title']()}
			body={searchQuery
				? m['orgAdmin.venues.empty.withSearch']()
				: m['orgAdmin.venues.empty.description']()}
			level={2}
		>
			{#snippet action()}
				{#if !searchQuery}
					<button
						type="button"
						onclick={handleCreate}
						class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Plus class="h-5 w-5" aria-hidden="true" />
						{m['orgAdmin.venues.createButton']()}
					</button>
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each venues as venue (venue.id)}
				<VenueCard
					{venue}
					onEdit={handleEdit}
					onDelete={handleDelete}
					onManageSectors={handleManageSectors}
				/>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal -->
{#if showModal}
	<VenueModal
		venue={editingVenue}
		organizationSlug={organization.slug}
		onClose={handleModalClose}
		onSuccess={handleModalSuccess}
	/>
{/if}
