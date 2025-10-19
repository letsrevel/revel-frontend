<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import type {
		PotluckItemRetrieveSchema,
		PotluckItemCreateSchema,
		EventDetailSchema
	} from '$lib/api/generated/types.gen';
	import PotluckItem from './PotluckItem.svelte';
	import PotluckItemForm from './PotluckItemForm.svelte';
	import PotluckItemEditModal from './PotluckItemEditModal.svelte';
	import { cn } from '$lib/utils/cn';
	import { ChevronDown, ChevronUp, Plus } from 'lucide-svelte';

	interface Props {
		event: EventDetailSchema;
		isOrganizer: boolean;
		isAuthenticated: boolean;
		hasRSVPd: boolean;
		initialItems?: PotluckItemRetrieveSchema[];
		class?: string;
	}

	let {
		event,
		isOrganizer,
		isAuthenticated,
		hasRSVPd,
		initialItems = [],
		class: className
	}: Props = $props();

	const queryClient = useQueryClient();

	// Section state
	let isExpanded = $state(hasRSVPd); // Default expanded if user RSVP'd
	let isFormOpen = $state(false);
	let searchQuery = $state('');
	let selectedCategory = $state<string>('all');
	let editingItem = $state<PotluckItemRetrieveSchema | null>(null);

	// Can user interact with potluck
	let canInteract = $derived(isAuthenticated && (hasRSVPd || isOrganizer));

	// Query: Fetch potluck items
	const itemsQuery = createQuery(() => ({
		queryKey: ['potluck-items', event.id],
		queryFn: async (): Promise<PotluckItemRetrieveSchema[]> => {
			const response = await fetch(`/api/events/${event.id}/potluck`, {
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Failed to fetch potluck items');
			return response.json();
		},
		initialData: initialItems,
		refetchInterval: isExpanded ? 5000 : false,
		enabled: isAuthenticated
	}));

	// Mutation: Create item
	const createItemMutation = createMutation<
		PotluckItemRetrieveSchema,
		Error,
		PotluckItemCreateSchema & { claimItem?: boolean }
	>(() => ({
		mutationFn: async (
			data: PotluckItemCreateSchema & { claimItem?: boolean }
		): Promise<PotluckItemRetrieveSchema> => {
			// Create the item
			const createResponse = await fetch(`/api/events/${event.id}/potluck`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					name: data.name,
					item_type: data.item_type,
					quantity: data.quantity || undefined,
					note: data.note || undefined
				})
			});
			if (!createResponse.ok) throw new Error('Failed to create item');
			const createdItem = await createResponse.json();

			// If organizer chose not to claim, we're done
			if (isOrganizer && !data.claimItem) {
				return createdItem;
			}

			// Otherwise, claim the item
			const claimResponse = await fetch(`/api/events/${event.id}/potluck/${createdItem.id}/claim`, {
				method: 'POST',
				credentials: 'include'
			});
			if (!claimResponse.ok) throw new Error('Failed to claim item');
			return claimResponse.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['potluck-items', event.id] });
			isFormOpen = false;
		}
	}));

	// Mutation: Claim item
	const claimItemMutation = createMutation<PotluckItemRetrieveSchema, Error, string>(() => ({
		mutationFn: async (itemId: string): Promise<PotluckItemRetrieveSchema> => {
			const response = await fetch(`/api/events/${event.id}/potluck/${itemId}/claim`, {
				method: 'POST',
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Failed to claim item');
			return response.json();
		},
		onMutate: async (itemId: string) => {
			// Optimistic update
			await queryClient.cancelQueries({ queryKey: ['potluck-items', event.id] });
			const previousItems = queryClient.getQueryData<PotluckItemRetrieveSchema[]>([
				'potluck-items',
				event.id
			]);

			queryClient.setQueryData<PotluckItemRetrieveSchema[]>(['potluck-items', event.id], (old) => {
				return old?.map((item) =>
					item.id === itemId ? { ...item, is_assigned: true, is_owned: true } : item
				);
			});

			return { previousItems };
		},
		onError: (_err, _itemId, context) => {
			// Rollback on error
			if (context?.previousItems) {
				queryClient.setQueryData(['potluck-items', event.id], context.previousItems);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['potluck-items', event.id] });
		}
	}));

	// Mutation: Unclaim item
	const unclaimItemMutation = createMutation<PotluckItemRetrieveSchema, Error, string>(() => ({
		mutationFn: async (itemId: string): Promise<PotluckItemRetrieveSchema> => {
			const response = await fetch(`/api/events/${event.id}/potluck/${itemId}/claim`, {
				method: 'DELETE',
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Failed to unclaim item');
			return response.json();
		},
		onMutate: async (itemId: string) => {
			// Optimistic update
			await queryClient.cancelQueries({ queryKey: ['potluck-items', event.id] });
			const previousItems = queryClient.getQueryData<PotluckItemRetrieveSchema[]>([
				'potluck-items',
				event.id
			]);

			queryClient.setQueryData<PotluckItemRetrieveSchema[]>(['potluck-items', event.id], (old) => {
				return old?.map((item) =>
					item.id === itemId ? { ...item, is_assigned: false, is_owned: false } : item
				);
			});

			return { previousItems };
		},
		onError: (_err, _itemId, context) => {
			// Rollback on error
			if (context?.previousItems) {
				queryClient.setQueryData(['potluck-items', event.id], context.previousItems);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['potluck-items', event.id] });
		}
	}));

	// Mutation: Update item (owner or organizer only)
	const updateItemMutation = createMutation<
		PotluckItemRetrieveSchema,
		Error,
		{
			itemId: string;
			data: { name: string; item_type: string; quantity: string | null; note: string | null };
		}
	>(() => ({
		mutationFn: async ({
			itemId,
			data
		}: {
			itemId: string;
			data: { name: string; item_type: string; quantity: string | null; note: string | null };
		}): Promise<PotluckItemRetrieveSchema> => {
			const response = await fetch(`/api/events/${event.id}/potluck/${itemId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					name: data.name,
					item_type: data.item_type,
					quantity: data.quantity || undefined,
					note: data.note || undefined
				})
			});
			if (!response.ok) throw new Error('Failed to update item');
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['potluck-items', event.id] });
			editingItem = null;
		}
	}));

	// Mutation: Delete item (organizer only)
	const deleteItemMutation = createMutation<void, Error, string>(() => ({
		mutationFn: async (itemId: string): Promise<void> => {
			const response = await fetch(`/api/events/${event.id}/potluck/${itemId}`, {
				method: 'DELETE',
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Failed to delete item');
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['potluck-items', event.id] });
		}
	}));

	// Computed: Filter and group items
	let filteredItems = $derived.by(() => {
		const items = itemsQuery.data || [];

		// Apply search filter
		let filtered = items;
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = items.filter(
				(item) =>
					item.name.toLowerCase().includes(query) || item.item_type.toLowerCase().includes(query)
			);
		}

		// Apply category filter
		if (selectedCategory !== 'all') {
			filtered = filtered.filter((item) => {
				const category = getCategoryForItemType(item.item_type);
				return category === selectedCategory;
			});
		}

		return filtered;
	});

	// Group items by category
	let groupedItems = $derived.by(() => {
		const groups: Record<string, PotluckItemRetrieveSchema[]> = {
			'Food & Drink': [],
			'Supplies & Services': [],
			'Entertainment & Fun': [],
			Other: []
		};

		filteredItems.forEach((item) => {
			const category = getCategoryForItemType(item.item_type);
			groups[category].push(item);
		});

		// Sort items within each category: owned first, then unclaimed, then claimed by others
		Object.keys(groups).forEach((category) => {
			groups[category].sort((a, b) => {
				if (a.is_owned && !b.is_owned) return -1;
				if (!a.is_owned && b.is_owned) return 1;
				if (!a.is_assigned && b.is_assigned) return -1;
				if (a.is_assigned && !b.is_assigned) return 1;
				return 0;
			});
		});

		return groups;
	});

	// Stats
	let stats = $derived.by(() => {
		const items = itemsQuery.data || [];
		return {
			total: items.length,
			claimed: items.filter((i) => i.is_assigned).length,
			unclaimed: items.filter((i) => !i.is_assigned).length,
			yours: items.filter((i) => i.is_owned).length
		};
	});

	// Helper: Get category for item type
	function getCategoryForItemType(itemType: string): string {
		const foodDrink = [
			'food',
			'main_course',
			'side_dish',
			'dessert',
			'drink',
			'alcohol',
			'non_alcoholic'
		];
		const suppliesServices = ['supplies', 'labor', 'transport', 'care'];
		const entertainment = ['entertainment', 'toys', 'sexual_health'];

		if (foodDrink.includes(itemType)) return 'Food & Drink';
		if (suppliesServices.includes(itemType)) return 'Supplies & Services';
		if (entertainment.includes(itemType)) return 'Entertainment & Fun';
		return 'Other';
	}

	// Event handlers
	function handleToggleExpand() {
		isExpanded = !isExpanded;
	}

	function handleAddClick() {
		isFormOpen = true;
	}

	function handleFormSubmit(data: PotluckItemCreateSchema & { claimItem?: boolean }) {
		createItemMutation.mutate(data);
	}

	function handleFormCancel() {
		isFormOpen = false;
	}

	function handleClaim(itemId: string) {
		claimItemMutation.mutate(itemId);
	}

	function handleUnclaim(itemId: string) {
		unclaimItemMutation.mutate(itemId);
	}

	function handleEdit(itemId: string) {
		const item = itemsQuery.data?.find((i) => i.id === itemId);
		if (item) {
			editingItem = item;
		}
	}

	function handleEditSubmit(data: {
		name: string;
		item_type: string;
		quantity: string | null;
		note: string | null;
	}) {
		if (editingItem && editingItem.id) {
			updateItemMutation.mutate({ itemId: editingItem.id, data });
		}
	}

	function handleEditCancel() {
		editingItem = null;
	}

	function handleDelete(itemId: string) {
		if (confirm('Are you sure you want to delete this item?')) {
			deleteItemMutation.mutate(itemId);
		}
	}
</script>

<section aria-labelledby="potluck-heading" class={cn('rounded-lg border bg-card', className)}>
	<!-- Header -->
	<div class="border-b p-4">
		<button
			type="button"
			onclick={handleToggleExpand}
			aria-expanded={isExpanded}
			aria-controls="potluck-content"
			class="flex w-full items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			<div class="flex-1">
				<h2 id="potluck-heading" class="text-xl font-semibold">🥗 Potluck Coordination</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					{stats.total} items • {stats.claimed} claimed • {stats.unclaimed} still needed
					{#if stats.yours > 0}
						• You're bringing {stats.yours}
					{/if}
				</p>
			</div>
			<div class="ml-4">
				{#if isExpanded}
					<ChevronUp class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				{:else}
					<ChevronDown class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				{/if}
			</div>
		</button>
	</div>

	<!-- Content (expandable) -->
	{#if isExpanded}
		<div id="potluck-content" class="space-y-4 p-4">
			<!-- Add item button & search -->
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				{#if canInteract}
					<button
						type="button"
						onclick={handleAddClick}
						disabled={!event.potluck_open && !isOrganizer}
						class={cn(
							'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
							event.potluck_open || isOrganizer
								? 'bg-primary text-primary-foreground hover:bg-primary/90'
								: 'cursor-not-allowed bg-muted text-muted-foreground opacity-60'
						)}
					>
						<Plus class="h-4 w-4" aria-hidden="true" />
						{isOrganizer ? 'Add potluck item' : "Add item you'll bring"}
					</button>
				{/if}

				<!-- Search -->
				<input
					type="search"
					bind:value={searchQuery}
					placeholder="Search items..."
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-64"
				/>
			</div>

			<!-- Add item form -->
			{#if isFormOpen}
				<PotluckItemForm
					{isOrganizer}
					isOpen={isFormOpen}
					onSubmit={handleFormSubmit}
					onCancel={handleFormCancel}
				/>
			{/if}

			<!-- Loading state -->
			{#if itemsQuery.isLoading}
				<div class="py-12 text-center">
					<div
						class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
						role="status"
					>
						<span class="sr-only">Loading potluck items...</span>
					</div>
				</div>
			{:else if itemsQuery.isError}
				<!-- Error state -->
				<div class="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-center">
					<p class="text-sm text-destructive">Failed to load potluck items. Please try again.</p>
				</div>
			{:else if filteredItems.length === 0}
				<!-- Empty state -->
				<div class="py-12 text-center">
					{#if searchQuery.trim()}
						<p class="text-sm text-muted-foreground">No items match your search.</p>
					{:else}
						<p class="text-muted-foreground">No items yet!</p>
						{#if canInteract}
							<p class="mt-2 text-sm text-muted-foreground">
								Be the first to add something you'll bring.
							</p>
						{/if}
					{/if}
				</div>
			{:else}
				<!-- Items grouped by category -->
				{#each Object.entries(groupedItems) as [category, items] (category)}
					{#if items.length > 0}
						<div class="space-y-3">
							<h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
								{category} ({items.length})
							</h3>
							<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{#each items as item (item.id)}
									<PotluckItem
										{item}
										{isOrganizer}
										canClaim={canInteract}
										onClaim={handleClaim}
										onUnclaim={handleUnclaim}
										onEdit={handleEdit}
										onDelete={isOrganizer ? handleDelete : undefined}
									/>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
			{/if}
		</div>
	{/if}
</section>

<!-- Edit item modal -->
{#if editingItem}
	<PotluckItemEditModal
		item={editingItem}
		isOpen={!!editingItem}
		onSubmit={handleEditSubmit}
		onCancel={handleEditCancel}
	/>
{/if}
