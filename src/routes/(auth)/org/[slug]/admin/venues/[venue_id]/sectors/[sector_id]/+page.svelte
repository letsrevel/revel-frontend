<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminvenuesGetSector,
		organizationadminvenuesBulkCreateSeats,
		organizationadminvenuesBulkDeleteSeats,
		organizationadminvenuesBulkUpdateSeats,
		organizationadminvenuesUpdateSector
	} from '$lib/api/generated/sdk.gen';
	import type {
		VenueSectorWithSeatsSchema,
		VenueSeatInputSchema,
		VenueSeatBulkUpdateItemSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { ArrowLeft } from 'lucide-svelte';
	import SeatGridEditor, { type AisleMetadata } from '$lib/components/venues/SeatGridEditor.svelte';
	import { toast } from 'svelte-sonner';

	const organization = $derived($page.data.organization);
	const venueId = $derived($page.params.venue_id);
	const sectorId = $derived($page.params.sector_id);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Sector query
	const sectorQuery = createQuery<VenueSectorWithSeatsSchema>(() => ({
		queryKey: ['sector', organization.slug, venueId, sectorId],
		queryFn: async () => {
			const response = await organizationadminvenuesGetSector({
				path: { slug: organization.slug, venue_id: venueId, sector_id: sectorId },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to load sector');
			}

			return response.data!;
		}
	}));

	// Bulk create mutation
	const bulkCreateMutation = createMutation(() => ({
		mutationFn: async (seats: VenueSeatInputSchema[]) => {
			const response = await organizationadminvenuesBulkCreateSeats({
				path: { slug: organization.slug, venue_id: venueId, sector_id: sectorId },
				body: { seats },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to create seats');
			}

			return response.data;
		},
		onSuccess: () => {
			toast.success(m['orgAdmin.seats.toast.saved']());
			queryClient.invalidateQueries({ queryKey: ['sector'] });
		},
		onError: () => {
			toast.error(m['orgAdmin.seats.toast.saveError']());
		}
	}));

	// Bulk delete mutation
	const bulkDeleteMutation = createMutation(() => ({
		mutationFn: async (labels: string[]) => {
			const response = await organizationadminvenuesBulkDeleteSeats({
				path: { slug: organization.slug, venue_id: venueId, sector_id: sectorId },
				body: { labels },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to delete seats');
			}

			return response.data;
		},
		onSuccess: () => {
			toast.success(m['orgAdmin.seats.toast.deleted']());
			queryClient.invalidateQueries({ queryKey: ['sector'] });
		},
		onError: () => {
			toast.error(m['orgAdmin.seats.toast.deleteError']());
		}
	}));

	// Bulk update mutation (for existing seats - position changes due to aisles)
	const bulkUpdateMutation = createMutation(() => ({
		mutationFn: async (seats: VenueSeatBulkUpdateItemSchema[]) => {
			const response = await organizationadminvenuesBulkUpdateSeats({
				path: { slug: organization.slug, venue_id: venueId, sector_id: sectorId },
				body: { seats },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to update seats');
			}

			return response.data;
		},
		onSuccess: () => {
			toast.success(m['orgAdmin.seats.toast.updated']());
			queryClient.invalidateQueries({ queryKey: ['sector'] });
		},
		onError: () => {
			toast.error(m['orgAdmin.seats.toast.updateError']());
		}
	}));

	// Sector metadata update mutation (for aisles and row order)
	const updateSectorMutation = createMutation(() => ({
		mutationFn: async (metadata: { aisles: AisleMetadata }) => {
			const response = await organizationadminvenuesUpdateSector({
				path: { slug: organization.slug, venue_id: venueId, sector_id: sectorId },
				body: { metadata },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to update sector metadata');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['sector'] });
		},
		onError: () => {
			toast.error(m['orgAdmin.seats.toast.metadataError']());
		}
	}));

	function handleSave(seats: VenueSeatInputSchema[]) {
		bulkCreateMutation.mutate(seats);
	}

	function handleUpdate(seats: VenueSeatBulkUpdateItemSchema[]) {
		bulkUpdateMutation.mutate(seats);
	}

	function handleDelete(labels: string[]) {
		bulkDeleteMutation.mutate(labels);
	}

	function handleMetadataChange(metadata: { aisles: AisleMetadata }) {
		updateSectorMutation.mutate(metadata);
	}

	function handleBackToSectors() {
		goto(`/org/${organization.slug}/admin/venues/${venueId}`);
	}

	const sector = $derived(sectorQuery.data);
	const isLoading = $derived(sectorQuery.isLoading);
	const error = $derived(sectorQuery.error);
	const isSaving = $derived(
		bulkCreateMutation.isPending ||
			bulkDeleteMutation.isPending ||
			bulkUpdateMutation.isPending ||
			updateSectorMutation.isPending
	);
</script>

<svelte:head>
	<title>
		{sector
			? m['orgAdmin.seats.pageTitle']({ sectorName: sector.name })
			: m['orgAdmin.seats.loading']()} - {organization.name}
	</title>
</svelte:head>

<div class="space-y-6">
	<!-- Back button -->
	<button
		type="button"
		onclick={handleBackToSectors}
		class="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
	>
		<ArrowLeft class="h-4 w-4" />
		{m['orgAdmin.seats.backToSectors']()}
	</button>

	{#if error}
		<div class="rounded-md bg-destructive/10 p-4 text-destructive" role="alert">
			<p class="font-semibold">{m['orgAdmin.seats.error.title']()}</p>
			<p class="mt-1 text-sm">{m['orgAdmin.seats.error.description']()}</p>
		</div>
	{:else if isLoading}
		<div class="flex items-center justify-center py-12">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
				aria-label={m['orgAdmin.seats.loading']()}
			></div>
		</div>
	{:else if sector}
		<!-- Header -->
		<div>
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
				{m['orgAdmin.seats.pageTitle']({ sectorName: sector.name })}
			</h1>
			<p class="text-muted-foreground">{m['orgAdmin.seats.pageDescription']()}</p>
		</div>

		<!-- Seat Grid Editor -->
		<SeatGridEditor
			existingSeats={sector.seats || []}
			sectorMetadata={sector.metadata as { aisles?: AisleMetadata } | null}
			onSave={handleSave}
			onUpdate={handleUpdate}
			onDelete={handleDelete}
			onMetadataChange={handleMetadataChange}
			{isSaving}
		/>
	{/if}
</div>
