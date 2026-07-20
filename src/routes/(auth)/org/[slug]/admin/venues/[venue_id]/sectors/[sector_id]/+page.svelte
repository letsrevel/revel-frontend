<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminvenuesGetSector,
		organizationadminvenuesBulkCreateSeats,
		organizationadminvenuesBulkDeleteSeats,
		organizationadminvenuesBulkUpdateSeats,
		organizationadminvenuesPaintSeats,
		organizationadminvenuesUpdateSector
	} from '$lib/api/generated/sdk.gen';
	import type {
		PriceCategorySchema,
		SeatPaintResultSchema,
		VenueSectorWithSeatsSchema,
		VenueSeatInputSchema,
		VenueSeatBulkUpdateItemSchema
	} from '$lib/api/generated/types.gen';
	import {
		countRepricedSeats,
		mergeUnderCoveredTiers,
		type PaintBatch,
		type SeatSavePlan
	} from '$lib/components/venues/seat-grid-save';
	import { authStore } from '$lib/stores/auth.svelte';
	import { ArrowLeft, LayoutDashboard, Users } from '@lucide/svelte';
	import SeatGridEditor, { type AisleMetadata } from '$lib/components/venues/SeatGridEditor.svelte';
	import { toast } from 'svelte-sonner';

	const organization = $derived($page.data.organization);
	const venueId = $derived($page.params.venue_id);
	const sectorId = $derived($page.params.sector_id);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// After any seat/metadata write, refresh every view that renders this sector's
	// geometry. Crucially, EVICT the venue-wide sector list (`venue-sectors`) that
	// the layout designer freezes into its model on first load — invalidation alone
	// leaves the stale cache in place, and the designer would rebuild from it on the
	// next visit (seat/aisle edits wouldn't show up). Removing it forces a fresh
	// fetch. The public seating chart reflects seat changes too.
	function invalidateSectorViews() {
		queryClient.invalidateQueries({ queryKey: ['sector'] });
		queryClient.removeQueries({ queryKey: ['venue-sectors', organization.slug, venueId] });
		queryClient.invalidateQueries({ queryKey: ['seating-chart'] });
	}

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

			if (response.error || !response.data) {
				throw new Error('Failed to load sector');
			}

			return response.data;
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
			invalidateSectorViews();
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
			invalidateSectorViews();
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
			invalidateSectorViews();
		},
		onError: () => {
			toast.error(m['orgAdmin.seats.toast.updateError']());
		}
	}));

	// Paint mutation (price-category painting of existing seats, one batch per call)
	const paintMutation = createMutation(() => ({
		mutationFn: async (batch: PaintBatch) => {
			const response = await organizationadminvenuesPaintSeats({
				path: { slug: organization.slug, venue_id: venueId },
				body: { seat_ids: batch.seat_ids, price_category_id: batch.price_category_id },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to paint seats');
			}

			return response.data;
		},
		onSuccess: () => {
			invalidateSectorViews();
		},
		onError: () => {
			toast.error(m['orgAdmin.seats.toast.paintError']());
		}
	}));

	// Sector metadata update mutation (for aisles and row order). Merge into the
	// existing metadata so we never clobber other keys — notably the layout
	// designer's `transform` (sector-block placement) stored in the same blob.
	const updateSectorMutation = createMutation(() => ({
		mutationFn: async (metadata: { aisles: AisleMetadata }) => {
			const existing = (sectorQuery.data?.metadata ?? {}) as Record<string, unknown>;
			const response = await organizationadminvenuesUpdateSector({
				path: { slug: organization.slug, venue_id: venueId, sector_id: sectorId },
				body: { metadata: { ...existing, aisles: metadata.aisles } },
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
			invalidateSectorViews();
		},
		onError: () => {
			toast.error(m['orgAdmin.seats.toast.metadataError']());
		}
	}));

	// Categories NEW seats were created into (inline paint on the create
	// payload). Erasing never opens a coverage gap — unpainted seats always
	// sell at a tier's base price.
	function createdCategoryIds(plan: SeatSavePlan): string[] {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: built fresh per call and consumed synchronously
		const ids = new Set<string>();
		for (const create of plan.creates) {
			if (create.price_category_id) ids.add(create.price_category_id);
		}
		return [...ids];
	}

	// Precise coverage warning (BE #746): the paint endpoint reports the tiers
	// its operation left under-covered — user-choice, category-priced tiers on
	// the painted sectors whose price map misses a painted category. Their
	// seats in those categories are refused at checkout, so the admin painting
	// them is the person who must hear about it. Silent when nothing is
	// affected (the common case).
	function warnAboutUnderCoveredTiers(results: SeatPaintResultSchema[]) {
		const tiers = mergeUnderCoveredTiers(results);
		if (tiers.length === 0) return;
		const lines = tiers.map((tier) =>
			m['orgAdmin.seats.toast.underCoveredTier']({
				tier: tier.tier_name,
				event: tier.event_name,
				categories: (tier.missing_categories ?? []).map((category) => category.name).join(', ')
			})
		);
		toast.warning(m['orgAdmin.seats.toast.underCoveredTitle'](), {
			description: lines.join(' · '),
			duration: 12_000,
			action: {
				label: m['orgAdmin.seats.toast.underCoveredAction'](),
				onClick: () => {
					const target =
						resolve('/(auth)/org/[slug]/admin/events/[event_id]/edit', {
							slug: organization.slug,
							event_id: tiers[0].event_id
						}) + '?tab=ticketing';
					/* eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve()-built route with a ?tab query suffix the rule can't see through */
					void goto(target);
				}
			}
		});
	}

	// Fallback for saves that painted ONLY via seat creation: creates don't go
	// through the paint endpoint, so there is no precise report for them. (When
	// any paint batch runs it reports the tiers' CURRENT gap — creates are
	// persisted first, so their categories are already reflected and the
	// precise path covers the mixed case.)
	function warnAboutCreatedPaint(plan: SeatSavePlan) {
		const ids = createdCategoryIds(plan);
		if (ids.length === 0) return;
		// Palette cache is warm whenever painting was possible; fall back to a
		// generic phrase if it isn't.
		const categories = queryClient.getQueryData<PriceCategorySchema[]>([
			'org-admin',
			organization.slug,
			'venue',
			venueId,
			'price-categories'
		]);
		const names = ids
			.map((id) => categories?.find((category) => category.id === id)?.name)
			.filter((name): name is string => !!name);
		toast.warning(m['orgAdmin.seats.toast.paintCoverageTitle'](), {
			description: m['orgAdmin.seats.toast.paintCoverageDesc']({
				categories:
					names.length > 0 ? names.join(', ') : m['orgAdmin.seats.toast.paintCoverageFallback']()
			}),
			duration: 10_000
		});
	}

	// Silent-repricing warning (#674): seats moved OUT of a category they were
	// already painted with (repainted or unpainted) change what buyers are
	// charged for every event at this venue — and unlike under-coverage this
	// fails OPEN (sales continue at the new price, nothing else fires). Which
	// tiers/events are actually affected needs BE #747; until then the wording
	// is conditional but the seat detection is exact.
	function warnAboutRepricedSeats(repricedCount: number) {
		if (repricedCount === 0) return;
		toast.warning(m['orgAdmin.seats.toast.repricedTitle'](), {
			description: m['orgAdmin.seats.toast.repricedDesc']({ count: String(repricedCount) }),
			duration: 12_000
		});
	}

	// Orchestrated save: bulk create/update/delete first, then paint batches
	// (existing seats only — new seats carry their paint in the create
	// payload), then sector metadata. Each mutation surfaces its own toast.
	async function handlePersist(plan: SeatSavePlan, metadata: { aisles: AisleMetadata }) {
		// Snapshot the persisted paint BEFORE any mutation: each success
		// invalidates the sector query, so by the time the toasts run the
		// refetched data would already show the new paint (baseline lost).

		const baselinePaint = new Map<string, string | null>(
			(sectorQuery.data?.seats ?? [])
				.filter((seat): seat is typeof seat & { id: string } => !!seat.id)
				.map((seat) => [seat.id, seat.price_category_id ?? null])
		);
		try {
			const bulkOps: Promise<unknown>[] = [];
			if (plan.creates.length > 0) {
				bulkOps.push(bulkCreateMutation.mutateAsync(plan.creates));
			}
			if (plan.updates.length > 0) {
				bulkOps.push(bulkUpdateMutation.mutateAsync(plan.updates));
			}
			if (plan.deleteLabels.length > 0) {
				bulkOps.push(bulkDeleteMutation.mutateAsync(plan.deleteLabels));
			}
			await Promise.all(bulkOps);

			const paintResults: SeatPaintResultSchema[] = [];
			for (const batch of plan.paintBatches) {
				const result = await paintMutation.mutateAsync(batch);
				if (result) paintResults.push(result);
			}
			if (plan.paintBatches.length > 0) {
				toast.success(m['orgAdmin.seats.toast.painted']());
			}

			await updateSectorMutation.mutateAsync(metadata);
			if (paintResults.length > 0) {
				warnAboutUnderCoveredTiers(paintResults);
			} else {
				warnAboutCreatedPaint(plan);
			}
			warnAboutRepricedSeats(countRepricedSeats(plan.paintBatches, baselinePaint));
		} catch {
			// Each mutation's onError handler has already surfaced a toast;
			// stop the sequence so later steps don't run against a failed save.
		}
	}

	function handleBackToSectors() {
		goto(
			resolve('/(auth)/org/[slug]/admin/venues/[venue_id]', {
				slug: organization.slug,
				venue_id: venueId
			})
		);
	}

	function handleBackToDesigner() {
		goto(
			resolve('/(auth)/org/[slug]/admin/venues/[venue_id]/designer', {
				slug: organization.slug,
				venue_id: venueId
			})
		);
	}

	const sector = $derived(sectorQuery.data);
	const isLoading = $derived(sectorQuery.isLoading);
	const error = $derived(sectorQuery.error);
	const isSaving = $derived(
		bulkCreateMutation.isPending ||
			bulkDeleteMutation.isPending ||
			bulkUpdateMutation.isPending ||
			paintMutation.isPending ||
			updateSectorMutation.isPending
	);

	// Standing sectors have no seats to edit — show the empty state instead of
	// the grid editor. Admin sector reads expose `kind` (BE #734).
	const isStandingSector = $derived(sector?.kind === 'standing');
</script>

<svelte:head>
	<title>
		{sector
			? m['orgAdmin.seats.pageTitle']({ sectorName: sector.name })
			: m['orgAdmin.seats.loading']()} - {organization.name}
	</title>
</svelte:head>

<div class="space-y-6">
	<!-- Back navigation: to the sector list, or back to the layout designer so
	     the grid-editor ⇄ designer round-trip is not a dead end. -->
	<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
		<button
			type="button"
			onclick={handleBackToSectors}
			class="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" />
			{m['orgAdmin.seats.backToSectors']()}
		</button>
		<button
			type="button"
			onclick={handleBackToDesigner}
			class="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
		>
			<LayoutDashboard class="h-4 w-4" />
			{m['orgAdmin.seats.backToDesigner']?.() ?? 'Back to designer'}
		</button>
	</div>

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

		{#if isStandingSector}
			<!-- Standing sectors have no seat map: explain instead of the editor -->
			<div class="rounded-lg border bg-card p-8 text-center">
				<Users class="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
				<h2 class="mt-3 text-lg font-semibold">
					{m['orgAdmin.seats.standing.title']()}
				</h2>
				<p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
					{m['orgAdmin.seats.standing.description']()}
				</p>
				{#if sector.capacity != null}
					<p class="mt-3 text-sm">
						{m['orgAdmin.sectors.form.capacityLabel']()}: <strong>{sector.capacity}</strong>
					</p>
				{/if}
			</div>
		{:else}
			<!-- Seat Grid Editor -->
			<SeatGridEditor
				existingSeats={sector.seats || []}
				sectorMetadata={sector.metadata as { aisles?: AisleMetadata } | null}
				organizationSlug={organization.slug}
				{venueId}
				onPersist={handlePersist}
				{isSaving}
			/>
		{/if}
	{/if}
</div>
