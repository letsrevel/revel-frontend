<script lang="ts">
	/**
	 * Freeform layout designer route (#659, designer part 2).
	 *
	 * Loads the venue's sectors (with seats) and price categories, freezes the
	 * designer model on first load (so the persisted-frame math stays stable
	 * across refetches), and orchestrates the save plan: sector shape updates
	 * first (seat writes validate against the stored polygon), then per-sector
	 * seat position batches. Unsaved changes are guarded on navigation.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/state';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminvenuesBulkUpdateSeats,
		organizationadminvenuesGetVenue,
		organizationadminvenuesListPriceCategories,
		organizationadminvenuesListSectors,
		organizationadminvenuesUpdateSector
	} from '$lib/api/generated/sdk.gen';
	import type {
		PriceCategorySchema,
		VenueDetailSchema,
		VenueSectorWithSeatsSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { ArrowLeft } from '@lucide/svelte';
	import SeatMapDesigner from '$lib/components/venues/designer/SeatMapDesigner.svelte';
	import {
		buildDesignerModel,
		type DesignerModel
	} from '$lib/components/venues/designer/designer-model';
	import {
		seatBatchErrorMessage,
		shapeUpdateErrorMessage,
		type DesignerSavePlan
	} from '$lib/components/venues/designer/designer-save';
	import { toast } from 'svelte-sonner';

	const organization = $derived(page.data.organization);
	const venueId = $derived(page.params.venue_id);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	const authHeaders = $derived({ Authorization: `Bearer ${accessToken}` });

	const venueQuery = createQuery<VenueDetailSchema>(() => ({
		queryKey: ['venue', organization.slug, venueId],
		queryFn: async () => {
			const response = await organizationadminvenuesGetVenue({
				path: { slug: organization.slug, venue_id: venueId },
				headers: authHeaders
			});
			if (response.error || !response.data) throw new Error('Failed to load venue');
			return response.data;
		}
	}));

	const sectorsQuery = createQuery<VenueSectorWithSeatsSchema[]>(() => ({
		queryKey: ['venue-sectors', organization.slug, venueId],
		queryFn: async () => {
			const response = await organizationadminvenuesListSectors({
				path: { slug: organization.slug, venue_id: venueId },
				headers: authHeaders
			});
			if (response.error) throw new Error('Failed to load sectors');
			return (response.data as VenueSectorWithSeatsSchema[]) || [];
		}
	}));

	const categoriesQuery = createQuery<PriceCategorySchema[]>(() => ({
		queryKey: ['venue-price-categories', organization.slug, venueId],
		queryFn: async () => {
			const response = await organizationadminvenuesListPriceCategories({
				path: { slug: organization.slug, venue_id: venueId },
				headers: authHeaders
			});
			if (response.error) throw new Error('Failed to load price categories');
			return response.data ?? [];
		}
	}));

	// Freeze the model on first successful load: the designer's global frame
	// (sector origins, persist offsets) must not shift under unsaved edits when
	// the sector queries refetch after a save.
	let model = $state<DesignerModel | null>(null);
	$effect(() => {
		const sectors = sectorsQuery.data;
		if (sectors && !model) {
			model = buildDesignerModel(sectors);
		}
	});

	const saveMutation = createMutation(() => ({
		mutationFn: async (plan: DesignerSavePlan) => {
			const genericError = m['seatDesigner.saveError']();
			// Shapes first: seat position writes validate against the stored shape.
			for (const update of plan.shapeUpdates) {
				const response = await organizationadminvenuesUpdateSector({
					path: { slug: organization.slug, venue_id: venueId, sector_id: update.sectorId },
					body: { shape: update.shape },
					headers: authHeaders
				});
				if (response.error) {
					throw new Error(shapeUpdateErrorMessage(response.error, update, genericError));
				}
			}
			for (const batch of plan.seatBatches) {
				const response = await organizationadminvenuesBulkUpdateSeats({
					path: { slug: organization.slug, venue_id: venueId, sector_id: batch.sectorId },
					body: { seats: batch.seats },
					headers: authHeaders
				});
				if (response.error) {
					throw new Error(seatBatchErrorMessage(response.error, batch, genericError));
				}
			}
		},
		onSuccess: () => {
			toast.success(m['seatDesigner.saved']());
		},
		onError: (error: Error) => {
			toast.error(error.message);
		},
		onSettled: () => {
			// Partial failures may have written some batches — refresh everything
			// that renders this venue's geometry.
			queryClient.invalidateQueries({ queryKey: ['venue-sectors'] });
			queryClient.invalidateQueries({ queryKey: ['sector'] });
			queryClient.invalidateQueries({ queryKey: ['venue', organization.slug, venueId] });
			queryClient.invalidateQueries({ queryKey: ['seating-chart'] });
		}
	}));

	async function handleSave(plan: DesignerSavePlan): Promise<boolean> {
		try {
			await saveMutation.mutateAsync(plan);
			return true;
		} catch {
			return false;
		}
	}

	// --- unsaved-changes guard ------------------------------------------------
	let dirty = $state(false);

	beforeNavigate((navigation) => {
		if (!dirty) return;
		const message = m['seatDesigner.unsavedChanges']();
		if (!confirm(message)) navigation.cancel();
	});

	function handleBeforeUnload(event: BeforeUnloadEvent) {
		if (dirty) event.preventDefault();
	}

	function sectorEditorHref(sectorId: string): string {
		return resolve('/(auth)/org/[slug]/admin/venues/[venue_id]/sectors/[sector_id]', {
			slug: organization.slug,
			venue_id: venueId,
			sector_id: sectorId
		});
	}

	function handleBackToVenue() {
		goto(
			resolve('/(auth)/org/[slug]/admin/venues/[venue_id]', {
				slug: organization.slug,
				venue_id: venueId
			})
		);
	}

	const venue = $derived(venueQuery.data);
	// Read every query's properties unconditionally (never via `||`
	// short-circuiting) — TanStack Query's tracked-props optimization drops
	// updates for properties that were never read (see the venue page).
	const isLoading = $derived.by(() => {
		const venueLoading = venueQuery.isLoading;
		const sectorsLoading = sectorsQuery.isLoading;
		const categoriesLoading = categoriesQuery.isLoading;
		return venueLoading || sectorsLoading || categoriesLoading;
	});
	const error = $derived.by(() => {
		const venueError = venueQuery.error;
		const sectorsError = sectorsQuery.error;
		const categoriesError = categoriesQuery.error;
		return venueError || sectorsError || categoriesError;
	});
	const pageTitle = $derived(
		venue ? m['seatDesigner.pageTitle']({ venueName: venue.name }) : m['seatDesigner.title']()
	);
</script>

<svelte:window onbeforeunload={handleBeforeUnload} />

<svelte:head>
	<title>{pageTitle} - {organization.name}</title>
</svelte:head>

<div class="space-y-6">
	<button
		type="button"
		onclick={handleBackToVenue}
		class="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
	>
		<ArrowLeft class="h-4 w-4" />
		{m['seatDesigner.backToVenue']()}
	</button>

	{#if error}
		<div class="rounded-md bg-destructive/10 p-4 text-destructive" role="alert">
			<p class="font-semibold">{m['seatDesigner.error.title']()}</p>
			<p class="mt-1 text-sm">
				{m['seatDesigner.error.description']()}
			</p>
		</div>
	{:else if isLoading || !model}
		<div class="flex items-center justify-center py-12">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
				aria-label={m['seatDesigner.loading']()}
			></div>
		</div>
	{:else}
		<div>
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">{pageTitle}</h1>
			<p class="text-muted-foreground">
				{m['seatDesigner.pageDescription']()}
			</p>
		</div>

		{#if model.sectors.length === 0}
			<div
				class="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-600"
			>
				<p class="text-sm text-muted-foreground">
					{m['seatDesigner.empty']()}
				</p>
			</div>
		{:else}
			<SeatMapDesigner
				{model}
				priceCategories={categoriesQuery.data ?? []}
				isSaving={saveMutation.isPending}
				onSave={handleSave}
				onDirtyChange={(value) => (dirty = value)}
				{sectorEditorHref}
			/>
		{/if}
	{/if}
</div>
