<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminvenuesGetVenue,
		organizationadminvenuesListSectors,
		organizationadminvenuesDeleteSector
	} from '$lib/api/generated/sdk.gen';
	import type { VenueDetailSchema, VenueSectorWithSeatsSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Plus, ArrowLeft, LayoutGrid } from 'lucide-svelte';
	import SectorCard from '$lib/components/venues/SectorCard.svelte';
	import SectorModal from '$lib/components/venues/SectorModal.svelte';
	import { toast } from 'svelte-sonner';

	const organization = $derived($page.data.organization);
	const venueId = $derived($page.params.venue_id);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Modal state
	let showModal = $state(false);
	let editingSector = $state<VenueSectorWithSeatsSchema | null>(null);

	// Venue query
	const venueQuery = createQuery<VenueDetailSchema>(() => ({
		queryKey: ['venue', organization.slug, venueId],
		queryFn: async () => {
			const response = await organizationadminvenuesGetVenue({
				path: { slug: organization.slug, venue_id: venueId },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to load venue');
			}

			return response.data!;
		}
	}));

	// Sectors query
	const sectorsQuery = createQuery<VenueSectorWithSeatsSchema[]>(() => ({
		queryKey: ['venue-sectors', organization.slug, venueId],
		queryFn: async () => {
			const response = await organizationadminvenuesListSectors({
				path: { slug: organization.slug, venue_id: venueId },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to load sectors');
			}

			return (response.data as VenueSectorWithSeatsSchema[]) || [];
		}
	}));

	// Delete mutation
	const deleteMutation = createMutation(() => ({
		mutationFn: async (sectorId: string) => {
			const response = await organizationadminvenuesDeleteSector({
				path: { slug: organization.slug, venue_id: venueId, sector_id: sectorId },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to delete sector');
			}

			return response.data;
		},
		onSuccess: () => {
			toast.success(m['orgAdmin.sectors.delete.success']());
			queryClient.invalidateQueries({ queryKey: ['venue-sectors'] });
		},
		onError: () => {
			toast.error(m['orgAdmin.sectors.delete.error']());
		}
	}));

	function handleCreate() {
		editingSector = null;
		showModal = true;
	}

	function handleEdit(sector: VenueSectorWithSeatsSchema) {
		editingSector = sector;
		showModal = true;
	}

	function handleDelete(sectorId: string) {
		if (confirm(m['orgAdmin.sectors.delete.confirm']())) {
			deleteMutation.mutate(sectorId);
		}
	}

	function handleManageSeats(sector: VenueSectorWithSeatsSchema) {
		goto(`/org/${organization.slug}/admin/venues/${venueId}/sectors/${sector.id}`);
	}

	function handleModalClose() {
		showModal = false;
		editingSector = null;
	}

	function handleModalSuccess() {
		showModal = false;
		editingSector = null;
		queryClient.invalidateQueries({ queryKey: ['venue-sectors'] });
	}

	function handleBackToVenues() {
		goto(`/org/${organization.slug}/admin/venues`);
	}

	const venue = $derived(venueQuery.data);
	const sectors = $derived(sectorsQuery.data || []);
	const isLoading = $derived(venueQuery.isLoading || sectorsQuery.isLoading);
	const error = $derived(venueQuery.error || sectorsQuery.error);
</script>

<svelte:head>
	<title>
		{venue
			? m['orgAdmin.sectors.pageTitle']({ venueName: venue.name })
			: m['orgAdmin.sectors.loading']()} - {organization.name}
	</title>
</svelte:head>

<div class="space-y-6">
	<!-- Back button -->
	<button
		type="button"
		onclick={handleBackToVenues}
		class="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
	>
		<ArrowLeft class="h-4 w-4" />
		{m['orgAdmin.sectors.backToVenue']()}
	</button>

	{#if error}
		<div class="rounded-md bg-destructive/10 p-4 text-destructive" role="alert">
			<p class="font-semibold">{m['orgAdmin.sectors.error.title']()}</p>
			<p class="mt-1 text-sm">{m['orgAdmin.sectors.error.description']()}</p>
		</div>
	{:else if isLoading}
		<div class="flex items-center justify-center py-12">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
				aria-label={m['orgAdmin.sectors.loading']()}
			></div>
		</div>
	{:else if venue}
		<!-- Header -->
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div>
				<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
					{m['orgAdmin.sectors.pageTitle']({ venueName: venue.name })}
				</h1>
				<p class="text-muted-foreground">{m['orgAdmin.sectors.pageDescription']()}</p>
			</div>

			<button
				type="button"
				onclick={handleCreate}
				class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<Plus class="h-5 w-5" aria-hidden="true" />
				{m['orgAdmin.sectors.createButton']()}
			</button>
		</div>

		<!-- Content -->
		{#if sectors.length === 0}
			<div
				class="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-600"
			>
				<LayoutGrid class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
				<h3 class="mt-4 text-lg font-semibold">{m['orgAdmin.sectors.empty.title']()}</h3>
				<p class="mt-2 text-sm text-muted-foreground">
					{m['orgAdmin.sectors.empty.description']()}
				</p>
				<button
					type="button"
					onclick={handleCreate}
					class="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<Plus class="h-5 w-5" aria-hidden="true" />
					{m['orgAdmin.sectors.createButton']()}
				</button>
			</div>
		{:else}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each sectors as sector (sector.id)}
					<SectorCard
						{sector}
						onEdit={handleEdit}
						onDelete={handleDelete}
						onManageSeats={handleManageSeats}
					/>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<!-- Modal -->
{#if showModal}
	<SectorModal
		sector={editingSector}
		organizationSlug={organization.slug}
		{venueId}
		onClose={handleModalClose}
		onSuccess={handleModalSuccess}
	/>
{/if}
