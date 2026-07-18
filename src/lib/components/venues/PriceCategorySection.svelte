<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminvenuesListPriceCategories,
		organizationadminvenuesDeletePriceCategory
	} from '$lib/api/generated/sdk.gen';
	import type { PriceCategorySchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { extractApiErrorDetail } from './api-error-detail';
	import { Plus, Edit, Trash2, Tag } from '@lucide/svelte';
	import PriceCategoryModal from './PriceCategoryModal.svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		organizationSlug: string;
		venueId: string;
	}

	const { organizationSlug, venueId }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	const listQueryKey = $derived([
		'org-admin',
		organizationSlug,
		'venue',
		venueId,
		'price-categories'
	]);

	// Modal state
	let showModal = $state(false);
	let editingCategory = $state<PriceCategorySchema | null>(null);

	// Price categories query
	const categoriesQuery = createQuery<PriceCategorySchema[]>(() => ({
		queryKey: listQueryKey,
		queryFn: async () => {
			const response = await organizationadminvenuesListPriceCategories({
				path: { slug: organizationSlug, venue_id: venueId },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error || !response.data) {
				throw new Error('Failed to load price categories');
			}

			return response.data;
		}
	}));

	// Delete mutation — the backend refuses deletion (400 with a detail) while
	// any ticket tier references the category; that detail explains WHY, so it
	// is surfaced to the admin behind a localized lead-in.
	const deleteMutation = createMutation(() => ({
		mutationFn: async (categoryId: string) => {
			const response = await organizationadminvenuesDeletePriceCategory({
				path: { slug: organizationSlug, venue_id: venueId, category_id: categoryId },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error(extractApiErrorDetail(response.error) ?? '');
			}

			return response.data;
		},
		onSuccess: () => {
			toast.success(m['orgAdmin.priceCategories.delete.success']?.() ?? 'Price category deleted');
			queryClient.invalidateQueries({ queryKey: listQueryKey });
		},
		onError: (error: Error) => {
			const lead =
				m['orgAdmin.priceCategories.delete.error']?.() ?? 'Failed to delete price category';
			toast.error(error.message ? `${lead}: ${error.message}` : lead);
		}
	}));

	function handleCreate() {
		editingCategory = null;
		showModal = true;
	}

	function handleEdit(category: PriceCategorySchema) {
		editingCategory = category;
		showModal = true;
	}

	function handleDelete(categoryId: string) {
		if (
			confirm(
				m['orgAdmin.priceCategories.delete.confirm']?.() ??
					'Delete this price category? Seats using it will lose their category and can be repainted.'
			)
		) {
			deleteMutation.mutate(categoryId);
		}
	}

	function handleModalClose() {
		showModal = false;
		editingCategory = null;
	}

	function handleModalSuccess() {
		showModal = false;
		editingCategory = null;
		queryClient.invalidateQueries({ queryKey: listQueryKey });
	}

	// Match backend ordering: display_order, then name.
	const categories = $derived(
		[...(categoriesQuery.data ?? [])].sort(
			(a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name)
		)
	);
</script>

<section class="space-y-4" aria-labelledby="price-categories-heading">
	<!-- Section header -->
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			<h2 id="price-categories-heading" class="text-xl font-bold tracking-tight">
				{m['orgAdmin.priceCategories.sectionTitle']?.() ?? 'Price Categories'}
			</h2>
			<p class="text-sm text-muted-foreground">
				{m['orgAdmin.priceCategories.sectionDescription']?.() ??
					'Group seats into price levels — Best Available tiers auto-assign seats from a category.'}
			</p>
		</div>

		<button
			type="button"
			onclick={handleCreate}
			class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			<Plus class="h-5 w-5" aria-hidden="true" />
			{m['orgAdmin.priceCategories.createButton']?.() ?? 'Add Price Category'}
		</button>
	</div>

	{#if categoriesQuery.error}
		<div class="rounded-md bg-destructive/10 p-4 text-destructive" role="alert">
			<p class="font-semibold">
				{m['orgAdmin.priceCategories.error.title']?.() ?? 'Error loading price categories'}
			</p>
			<p class="mt-1 text-sm">
				{m['orgAdmin.priceCategories.error.description']?.() ??
					'Failed to load price categories. Please try again.'}
			</p>
		</div>
	{:else if categoriesQuery.isLoading}
		<div role="status" class="flex items-center justify-center py-8">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
				aria-hidden="true"
			></div>
			<span class="sr-only">
				{m['orgAdmin.priceCategories.loading']?.() ?? 'Loading price categories...'}
			</span>
		</div>
	{:else if categories.length === 0}
		<div
			class="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600"
		>
			<Tag class="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
			<h3 class="mt-3 text-lg font-semibold">
				{m['orgAdmin.priceCategories.empty.title']?.() ?? 'No price categories yet'}
			</h3>
			<p class="mt-2 text-sm text-muted-foreground">
				{m['orgAdmin.priceCategories.empty.description']?.() ??
					'Price categories group seats into price levels (e.g., Gold, Silver). Ticket tiers with Best Available seating assign seats from a price category.'}
			</p>
			<button
				type="button"
				onclick={handleCreate}
				class="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<Plus class="h-5 w-5" aria-hidden="true" />
				{m['orgAdmin.priceCategories.createButton']?.() ?? 'Add Price Category'}
			</button>
		</div>
	{:else}
		<ul class="divide-y rounded-lg border bg-card shadow-sm">
			{#each categories as category (category.id)}
				<li class="flex items-center justify-between gap-4 p-3">
					<div class="flex min-w-0 items-center gap-3">
						<!-- Swatch is decorative: color is always paired with the name and hex text -->
						<span
							class="inline-block h-4 w-4 shrink-0 rounded-full border border-border"
							style="background-color: {category.color}"
							aria-hidden="true"
						></span>
						<div class="min-w-0">
							<p class="truncate font-medium">{category.name}</p>
							<p class="text-xs text-muted-foreground">
								<span class="font-mono">{category.color}</span>
								<span aria-hidden="true"> · </span>
								{m['orgAdmin.priceCategories.card.order']?.({
									order: String(category.display_order ?? 0)
								}) ?? `Order: ${category.display_order ?? 0}`}
							</p>
						</div>
					</div>

					<div class="flex shrink-0 gap-1">
						<button
							type="button"
							onclick={() => handleEdit(category)}
							class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-label={m['orgAdmin.priceCategories.card.edit']?.({ name: category.name }) ??
								`Edit price category ${category.name}`}
							title={m['orgAdmin.priceCategories.card.edit']?.({ name: category.name }) ??
								`Edit price category ${category.name}`}
						>
							<Edit class="h-4 w-4" />
						</button>
						<button
							type="button"
							onclick={() => category.id && handleDelete(category.id)}
							class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-label={m['orgAdmin.priceCategories.card.delete']?.({ name: category.name }) ??
								`Delete price category ${category.name}`}
							title={m['orgAdmin.priceCategories.card.delete']?.({ name: category.name }) ??
								`Delete price category ${category.name}`}
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<!-- Modal -->
{#if showModal}
	<PriceCategoryModal
		category={editingCategory}
		{organizationSlug}
		{venueId}
		onClose={handleModalClose}
		onSuccess={handleModalSuccess}
	/>
{/if}
