<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import type {
		PotluckItemRetrieveSchema,
		PotluckItemCreateSchema,
		EventDetailSchema
	} from '$lib/api/generated/types.gen';
	import PotluckItem from './PotluckItem.svelte';
	import PotluckItemEditModal from './PotluckItemEditModal.svelte';
	import { cn } from '$lib/utils/cn';
	import { ChevronDown, ChevronUp, Plus } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		event: EventDetailSchema;
		permissions: {
			canCreate: boolean;
			hasManagePermission: boolean;
		};
		isAuthenticated: boolean;
		hasRSVPd: boolean;
		initialItems?: PotluckItemRetrieveSchema[];
		class?: string;
	}

	let {
		event,
		permissions,
		isAuthenticated,
		hasRSVPd,
		initialItems = [],
		class: className
	}: Props = $props();

	const queryClient = useQueryClient();

	// Section state
	let isExpanded = $state(hasRSVPd); // Default expanded if user RSVP'd
	let isModalOpen = $state(false);
	let searchQuery = $state('');
	let selectedCategory = $state<string>('all');
	let editingItem = $state<PotluckItemRetrieveSchema | null>(null);

	// Can user claim items (must have RSVP'd "yes")
	let canClaim = $derived(isAuthenticated && hasRSVPd);

	// Query: Fetch potluck items
	const itemsQuery = createQuery(() => ({
		queryKey: ['potluck-items', event.id],
		queryFn: async (): Promise<PotluckItemRetrieveSchema[]> => {
			const response = await fetch(`/api/events/${event.id}/potluck`, {
				credentials: 'include'
			});
			if (!response.ok) throw new Error(m['potluck.error_failedToFetch']());
			return response.json();
		},
		initialData: initialItems,
		refetchInterval: isExpanded ? 5000 : false,
		enabled: isAuthenticated
	}));

	// Error state
	let errorMessage = $state<string | null>(null); // For non-modal errors (claim/unclaim)
	let modalErrorMessage = $state<string | null>(null); // For modal errors (create/update)

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

			if (!createResponse.ok) {
				if (createResponse.status === 403) {
					throw new Error(m['potluck.error_noPermissionCreate']());
				}
				throw new Error(m['potluck.error_failedToCreate']());
			}
			const createdItem = await createResponse.json();

			// If user with manage permission chose not to claim, we're done
			if (permissions.hasManagePermission && !data.claimItem) {
				return createdItem;
			}

			// Otherwise, claim the item
			const claimResponse = await fetch(`/api/events/${event.id}/potluck/${createdItem.id}/claim`, {
				method: 'POST',
				credentials: 'include'
			});

			if (!claimResponse.ok) {
				if (claimResponse.status === 403) {
					throw new Error(m['potluck.error_noPermissionClaim']());
				}
				throw new Error(m['potluck.error_failedToClaim']());
			}
			return claimResponse.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['potluck-items', event.id] });
			isModalOpen = false;
			editingItem = null;
			modalErrorMessage = null;
		},
		onError: (error) => {
			modalErrorMessage = error.message;
		}
	}));

	// Mutation: Claim item
	const claimItemMutation = createMutation<
		PotluckItemRetrieveSchema,
		Error,
		string,
		{ previousItems: PotluckItemRetrieveSchema[] | undefined }
	>(() => ({
		mutationFn: async (itemId: string): Promise<PotluckItemRetrieveSchema> => {
			const response = await fetch(`/api/events/${event.id}/potluck/${itemId}/claim`, {
				method: 'POST',
				credentials: 'include'
			});

			if (!response.ok) {
				if (response.status === 403) {
					throw new Error(m['potluck.error_noPermissionClaim']());
				}
				throw new Error(m['potluck.error_failedToClaim']());
			}
			return response.json();
		},
		onMutate: async (itemId: string) => {
			// Clear previous errors
			errorMessage = null;

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
		onError: (err, _itemId, context) => {
			// Set error message
			errorMessage = err.message;

			// Rollback on error
			if (context?.previousItems) {
				queryClient.setQueryData(['potluck-items', event.id], context.previousItems);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['potluck-items', event.id] });
			errorMessage = null;
		}
	}));

	// Mutation: Unclaim item
	const unclaimItemMutation = createMutation<
		PotluckItemRetrieveSchema,
		Error,
		string,
		{ previousItems: PotluckItemRetrieveSchema[] | undefined }
	>(() => ({
		mutationFn: async (itemId: string): Promise<PotluckItemRetrieveSchema> => {
			const response = await fetch(`/api/events/${event.id}/potluck/${itemId}/claim`, {
				method: 'DELETE',
				credentials: 'include'
			});

			if (!response.ok) {
				if (response.status === 403) {
					throw new Error(m['potluck.error_noPermissionUnclaim']());
				}
				throw new Error(m['potluck.error_failedToUnclaim']());
			}
			return response.json();
		},
		onMutate: async (itemId: string) => {
			// Clear previous errors
			errorMessage = null;

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
		onError: (err, _itemId, context) => {
			// Set error message
			errorMessage = err.message;

			// Rollback on error
			if (context?.previousItems) {
				queryClient.setQueryData(['potluck-items', event.id], context.previousItems);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['potluck-items', event.id] });
			errorMessage = null;
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
			console.log('[PotluckSection] Updating item:', {
				itemId,
				data,
				event_id: event.id,
				hasManagePermission: permissions.hasManagePermission
			});

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

			console.log('[PotluckSection] Update response:', {
				status: response.status,
				ok: response.ok
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error('[PotluckSection] Update failed:', {
					status: response.status,
					errorText
				});

				if (response.status === 403) {
					throw new Error(m['potluck.error_noPermissionEdit']());
				}
				throw new Error(m['potluck.error_failedToUpdate']());
			}

			const updatedItem = await response.json();
			console.log('[PotluckSection] Update successful:', {
				itemId: updatedItem.id,
				is_owned: updatedItem.is_owned,
				is_assigned: updatedItem.is_assigned
			});

			return updatedItem;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['potluck-items', event.id] });
			isModalOpen = false;
			editingItem = null;
			modalErrorMessage = null;
		},
		onError: (error) => {
			console.error('[PotluckSection] Update mutation error:', error);
			modalErrorMessage = error.message;
		}
	}));

	// Mutation: Delete item (organizer only)
	const deleteItemMutation = createMutation<void, Error, string>(() => ({
		mutationFn: async (itemId: string): Promise<void> => {
			console.log('[PotluckSection] Deleting item:', {
				itemId,
				event_id: event.id,
				hasManagePermission: permissions.hasManagePermission
			});

			const response = await fetch(`/api/events/${event.id}/potluck/${itemId}`, {
				method: 'DELETE',
				credentials: 'include'
			});

			console.log('[PotluckSection] Delete response:', {
				status: response.status,
				ok: response.ok
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error('[PotluckSection] Delete failed:', {
					status: response.status,
					errorText
				});

				if (response.status === 403) {
					throw new Error(m['potluck.error_noPermissionDelete']());
				}
				throw new Error(m['potluck.error_failedToDelete']());
			}

			console.log('[PotluckSection] Delete successful');
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['potluck-items', event.id] });
			errorMessage = null;
		},
		onError: (error) => {
			console.error('[PotluckSection] Delete mutation error:', error);
			errorMessage = error.message;
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
			[m['potluck.category_foodDrink']()]: [],
			[m['potluck.category_supplies']()]: [],
			[m['potluck.category_entertainment']()]: [],
			[m['potluck.category_other']()]: []
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

		if (foodDrink.includes(itemType)) return m['potluck.category_foodDrink']();
		if (suppliesServices.includes(itemType)) return m['potluck.category_supplies']();
		if (entertainment.includes(itemType)) return m['potluck.category_entertainment']();
		return m['potluck.category_other']();
	}

	// Event handlers
	function handleToggleExpand() {
		isExpanded = !isExpanded;
	}

	function handleAddClick() {
		editingItem = null; // Ensure we're in create mode
		modalErrorMessage = null; // Clear previous modal errors
		isModalOpen = true;
	}

	function handleModalSubmit(data: {
		name: string;
		item_type: string;
		quantity: string | null;
		note: string | null;
		claimItem?: boolean;
	}) {
		if (editingItem && editingItem.id) {
			// Edit mode
			updateItemMutation.mutate({ itemId: editingItem.id, data });
		} else {
			// Create mode
			createItemMutation.mutate(data as PotluckItemCreateSchema & { claimItem?: boolean });
		}
	}

	function handleModalCancel() {
		isModalOpen = false;
		editingItem = null;
		modalErrorMessage = null; // Clear modal errors on cancel
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
			modalErrorMessage = null; // Clear previous modal errors
			isModalOpen = true;
		}
	}

	function handleDelete(itemId: string) {
		if (confirm(m['potluck.confirmDelete']())) {
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
				<h2 id="potluck-heading" class="text-xl font-semibold">{m['potluck.heading']()}</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					{stats.total}
					{m['common.plurals_items']()} • {stats.claimed}
					{m['common.text_claimed']()} • {stats.unclaimed}
					{m['common.text_stillNeeded']()}
					{#if stats.yours > 0}
						• {m['potluck.youBringing']()} {stats.yours}
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
			<!-- Error banner -->
			{#if errorMessage}
				<div
					class="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3"
					role="alert"
					aria-live="assertive"
				>
					<span class="text-lg" aria-hidden="true">⚠️</span>
					<div class="flex-1">
						<p class="text-sm font-medium text-destructive">{errorMessage}</p>
					</div>
					<button
						type="button"
						onclick={() => (errorMessage = null)}
						aria-label={m['potluck.dismissError']()}
						class="rounded-md p-1 text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<span class="text-sm font-semibold" aria-hidden="true">✕</span>
					</button>
				</div>
			{/if}

			<!-- Info banner for potluck closed state -->
			{#if !permissions.canCreate && hasRSVPd}
				<div
					class="flex items-start gap-3 rounded-md border border-muted-foreground/20 bg-muted/50 p-3"
					role="status"
				>
					<span class="text-lg" aria-hidden="true">🔒</span>
					<div class="flex-1 text-sm">
						<p class="font-medium">{m['potluck.creationClosed']()}</p>
						<p class="mt-1 text-muted-foreground">{m['potluck.creationClosedHint']()}</p>
					</div>
				</div>
			{/if}

			<!-- Add item button & search -->
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				{#if permissions.canCreate}
					<button
						type="button"
						onclick={handleAddClick}
						class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Plus class="h-4 w-4" aria-hidden="true" />
						{permissions.hasManagePermission
							? m['potluck.addItem']()
							: m['potluck.addItemYourBringing']()}
					</button>
				{/if}

				<!-- Search -->
				<input
					type="search"
					bind:value={searchQuery}
					placeholder={m['potluck.searchPlaceholder']()}
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-64"
				/>
			</div>

			<!-- Loading state -->
			{#if itemsQuery.isLoading}
				<div class="py-12 text-center">
					<div
						class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
						role="status"
					>
						<span class="sr-only">{m['potluck.loading']()}</span>
					</div>
				</div>
			{:else if itemsQuery.isError}
				<!-- Error state -->
				<div class="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-center">
					<p class="text-sm text-destructive">{m['potluck.failed']()}</p>
				</div>
			{:else if filteredItems.length === 0}
				<!-- Empty state -->
				<div class="py-12 text-center">
					{#if searchQuery.trim()}
						<p class="text-sm text-muted-foreground">{m['potluck.noMatchingItems']()}</p>
					{:else}
						<p class="text-muted-foreground">{m['potluck.noItems']()}</p>
						{#if permissions.canCreate}
							<p class="mt-2 text-sm text-muted-foreground">
								{m['potluck.beFirst']()}
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
										{canClaim}
										hasManagePermission={permissions.hasManagePermission}
										onClaim={handleClaim}
										onUnclaim={handleUnclaim}
										onEdit={handleEdit}
										onDelete={handleDelete}
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

<!-- Create/Edit item modal -->
<PotluckItemEditModal
	item={editingItem}
	isOpen={isModalOpen}
	hasManagePermission={permissions.hasManagePermission}
	errorMessage={modalErrorMessage}
	onSubmit={handleModalSubmit}
	onCancel={handleModalCancel}
/>
