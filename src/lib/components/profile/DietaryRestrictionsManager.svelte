<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		dietaryListDietaryRestrictions,
		dietaryCreateDietaryRestriction,
		dietaryDeleteDietaryRestriction,
		dietaryUpdateDietaryRestriction,
		dietaryListFoodItems,
		dietaryCreateFoodItem
	} from '$lib/api';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { Plus, Trash2, Loader2, AlertTriangle } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type {
		DietaryRestrictionSchema,
		RestrictionType,
		FoodItemSchema
	} from '$lib/api/generated/types.gen.js';

	interface Props {
		authToken: string;
	}

	let { authToken }: Props = $props();

	// State
	let showAddDialog = $state(false);
	let foodItemName = $state('');
	let foodItemSearch = $state('');
	let selectedFoodItemId = $state<string | null>(null);
	let showSuggestions = $state(false);
	let restrictionType = $state<RestrictionType>('dislike');
	let notes = $state('');
	let isPublic = $state(true);
	let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	const queryClient = useQueryClient();

	// Search for food items with debouncing
	$effect(() => {
		// Clear previous timeout
		if (searchDebounceTimer) {
			clearTimeout(searchDebounceTimer);
		}

		// Set new timeout
		searchDebounceTimer = setTimeout(() => {
			if (foodItemSearch.trim().length > 0) {
				showSuggestions = true;
			} else {
				showSuggestions = false;
			}
		}, 300);

		// Cleanup
		return () => {
			if (searchDebounceTimer) {
				clearTimeout(searchDebounceTimer);
			}
		};
	});

	// Fetch food items for autocomplete
	const foodItemsQuery = createQuery(() => ({
		queryKey: ['dietary', 'food-items', foodItemSearch],
		queryFn: async () => {
			if (!foodItemSearch.trim()) return [];
			const response = await dietaryListFoodItems({
				query: { search: foodItemSearch },
				headers: { Authorization: `Bearer ${authToken}` }
			});
			return response.data ?? [];
		},
		enabled: foodItemSearch.trim().length > 0
	}));

	// Fetch user's dietary restrictions
	const restrictionsQuery = createQuery(() => ({
		queryKey: ['dietary', 'restrictions'],
		queryFn: async () => {
			const response = await dietaryListDietaryRestrictions({
				headers: { Authorization: `Bearer ${authToken}` }
			});
			return response.data;
		}
	}));

	// Create food item mutation (if not selecting from existing)
	const createFoodItemMutation = createMutation(() => ({
		mutationFn: async (name: string) => {
			const response = await dietaryCreateFoodItem({
				body: { name },
				headers: { Authorization: `Bearer ${authToken}` }
			});
			return response.data;
		}
	}));

	// Add restriction mutation
	const addRestrictionMutation = createMutation(() => ({
		mutationFn: async (data: {
			food_item_name?: string;
			food_item_id?: string;
			restriction_type: RestrictionType;
			notes: string;
			is_public: boolean;
		}) => {
			// Ensure at least one of food_item_name or food_item_id is provided
			if (!data.food_item_name && !data.food_item_id) {
				throw new Error('Either food_item_name or food_item_id must be provided');
			}
			const response = await dietaryCreateDietaryRestriction({
				body: data as any, // Type assertion since API expects one field to be present
				headers: { Authorization: `Bearer ${authToken}` }
			});
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['dietary', 'restrictions'] });
			toast.success(m['dietary.toast_restrictionAdded']());
			// Reset form
			showAddDialog = false;
			foodItemName = '';
			foodItemSearch = '';
			selectedFoodItemId = null;
			showSuggestions = false;
			restrictionType = 'dislike';
			notes = '';
			isPublic = true;
		},
		onError: (error: Error) => {
			toast.error(m['dietary.toast_restrictionError']());
			console.error('Failed to add restriction:', error);
		}
	}));

	// Delete restriction mutation
	const deleteRestrictionMutation = createMutation(() => ({
		mutationFn: async (restrictionId: string) => {
			await dietaryDeleteDietaryRestriction({
				path: { restriction_id: restrictionId },
				headers: { Authorization: `Bearer ${authToken}` }
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['dietary', 'restrictions'] });
			toast.success(m['dietary.toast_restrictionRemoved']());
		},
		onError: (error: Error) => {
			toast.error(m['dietary.toast_restrictionError']());
			console.error('Failed to delete restriction:', error);
		}
	}));

	// Update restriction mutation
	const updateRestrictionMutation = createMutation(() => ({
		mutationFn: async ({
			id,
			data
		}: {
			id: string;
			data: { restriction_type?: RestrictionType; notes?: string; is_public?: boolean };
		}) => {
			const response = await dietaryUpdateDietaryRestriction({
				path: { restriction_id: id },
				body: data,
				headers: { Authorization: `Bearer ${authToken}` }
			});
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['dietary', 'restrictions'] });
			toast.success(m['dietary.toast_restrictionAdded']());
		},
		onError: (error: Error) => {
			toast.error(m['dietary.toast_restrictionError']());
			console.error('Failed to update restriction:', error);
		}
	}));

	// Derived state
	let restrictions = $derived(
		(restrictionsQuery.data as DietaryRestrictionSchema[] | undefined) ?? []
	);
	let isLoading = $derived(restrictionsQuery.isLoading);
	let isAddingRestriction = $derived(
		addRestrictionMutation.isPending || createFoodItemMutation.isPending
	);
	let foodItems = $derived((foodItemsQuery.data as FoodItemSchema[] | undefined) ?? []);
	let isFetchingFoodItems = $derived(foodItemsQuery.isFetching);

	// Get severity label
	function getSeverityLabel(type: RestrictionType): string {
		switch (type) {
			case 'dislike':
				return m['dietary.restrictions_severity_dislike']();
			case 'intolerant':
				return m['dietary.restrictions_severity_intolerant']();
			case 'allergy':
				return m['dietary.restrictions_severity_allergy']();
			case 'severe_allergy':
				return m['dietary.restrictions_severity_severe_allergy']();
			default:
				return type;
		}
	}

	// Get severity badge color
	function getSeverityColor(type: RestrictionType): string {
		switch (type) {
			case 'dislike':
				return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
			case 'intolerant':
				return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400';
			case 'allergy':
				return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-400';
			case 'severe_allergy':
				return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400';
			default:
				return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
		}
	}

	// Handlers
	async function handleAddRestriction() {
		const trimmedName = foodItemName.trim() || foodItemSearch.trim();
		if (!trimmedName) return;

		// If a food item is selected from suggestions, use its ID
		if (selectedFoodItemId) {
			addRestrictionMutation.mutate({
				food_item_id: selectedFoodItemId,
				restriction_type: restrictionType,
				notes: notes.trim(),
				is_public: isPublic
			});
		} else {
			// Create new food item first, then add restriction
			try {
				const newFoodItem = await createFoodItemMutation.mutateAsync(trimmedName);
				addRestrictionMutation.mutate({
					food_item_id: newFoodItem?.id ?? undefined,
					food_item_name: trimmedName,
					restriction_type: restrictionType,
					notes: notes.trim(),
					is_public: isPublic
				});
			} catch (error) {
				toast.error(m['dietary.toast_restrictionError']());
				console.error('Failed to create food item:', error);
			}
		}
	}

	function handleSelectFoodItem(item: FoodItemSchema) {
		selectedFoodItemId = item.id ?? null;
		foodItemName = item.name;
		foodItemSearch = item.name;
		showSuggestions = false;
	}

	function handleFoodItemInputChange(value: string) {
		foodItemSearch = value;
		foodItemName = value;
		selectedFoodItemId = null; // Clear selection when typing
	}

	function handleDeleteRestriction(id: string) {
		if (confirm(m['dietary.restrictions_deleteConfirm']())) {
			deleteRestrictionMutation.mutate(id);
		}
	}

	function handleToggleVisibility(restriction: DietaryRestrictionSchema) {
		if (!restriction.id) return;
		updateRestrictionMutation.mutate({
			id: restriction.id,
			data: { is_public: !restriction.is_public }
		});
	}
</script>

<div class="space-y-4">
	<div class="flex items-start justify-between">
		<div>
			<h3 class="text-lg font-semibold">{m['dietary.restrictions_sectionHeading']()}</h3>
			<p class="text-sm text-muted-foreground">
				{m['dietary.restrictions_sectionDescription']()}
			</p>
		</div>
		<button
			type="button"
			onclick={() => (showAddDialog = true)}
			disabled={isLoading}
			class="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<Plus class="h-4 w-4" aria-hidden="true" />
			{m['dietary.profile_addRestrictionButton']()}
		</button>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-8">
			<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
			<span class="sr-only">Loading restrictions...</span>
		</div>
	{:else if restrictions.length === 0}
		<div class="rounded-md border border-dashed p-8 text-center">
			<p class="text-sm text-muted-foreground">{m['dietary.restrictions_emptyState']()}</p>
			<button
				type="button"
				onclick={() => (showAddDialog = true)}
				class="mt-2 text-sm text-primary hover:underline"
			>
				{m['dietary.restrictions_emptyStateAction']()}
			</button>
		</div>
	{:else}
		<ul class="space-y-3" role="list">
			{#each restrictions as restriction (restriction.id)}
				<li class="flex items-start gap-3 rounded-md border p-4">
					<div class="flex-1 space-y-2">
						<div class="flex flex-wrap items-center gap-2">
							<h4 class="font-medium">{restriction.food_item.name}</h4>
							<span
								class="rounded px-2 py-1 text-xs font-medium {getSeverityColor(
									restriction.restriction_type
								)}"
							>
								{getSeverityLabel(restriction.restriction_type)}
							</span>
							<button
								type="button"
								onclick={() => handleToggleVisibility(restriction)}
								class="ml-auto rounded px-2 py-1 text-xs font-medium transition-colors {restriction.is_public
									? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-950 dark:text-green-400'
									: 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}"
								aria-label={restriction.is_public
									? m['dietary.restrictions_publicLabel']()
									: m['dietary.restrictions_privateLabel']()}
							>
								{restriction.is_public
									? m['dietary.restrictions_publicLabel']()
									: m['dietary.restrictions_privateLabel']()}
							</button>
						</div>

						{#if restriction.notes}
							<p class="text-sm text-muted-foreground">{restriction.notes}</p>
						{/if}

						{#if restriction.restriction_type === 'severe_allergy'}
							<div class="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
								<AlertTriangle class="h-4 w-4" aria-hidden="true" />
								<span>Severe allergy - please inform event organizers</span>
							</div>
						{/if}
					</div>

					<button
						type="button"
						onclick={() => restriction.id && handleDeleteRestriction(restriction.id)}
						class="rounded p-2 text-destructive hover:bg-destructive/10"
						aria-label="Remove {restriction.food_item.name}"
					>
						<Trash2 class="h-4 w-4" aria-hidden="true" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<!-- Add Restriction Dialog -->
	{#if showAddDialog}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onclick={(e) => e.target === e.currentTarget && (showAddDialog = false)}
			onkeydown={(e) => e.key === 'Escape' && (showAddDialog = false)}
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-restriction-title"
			tabindex="-1"
		>
			<div class="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
				<h2 id="add-restriction-title" class="mb-2 text-xl font-semibold">
					{m['dietary.restrictions_addButton']()}
				</h2>
				<p class="mb-4 text-sm text-muted-foreground">
					{m['dietary.restrictions_sectionDescription']()}
				</p>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleAddRestriction();
					}}
					class="space-y-4"
				>
					<div class="space-y-2">
						<label for="food-item-name" class="block text-sm font-medium">
							{m['dietary.restrictions_foodItemLabel']()}
						</label>
						<div class="relative">
							<input
								id="food-item-name"
								type="text"
								value={foodItemSearch}
								oninput={(e) => handleFoodItemInputChange((e.target as HTMLInputElement).value)}
								onfocus={() => foodItemSearch.length > 0 && (showSuggestions = true)}
								onblur={() => setTimeout(() => (showSuggestions = false), 200)}
								required
								placeholder={m['dietary.restrictions_foodItemPlaceholder']()}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								autocomplete="off"
							/>
							{#if isFetchingFoodItems}
								<div class="absolute right-3 top-2.5">
									<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
								</div>
							{/if}

							{#if showSuggestions && foodItems.length > 0}
								<ul
									class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-background shadow-lg"
									role="listbox"
								>
									{#each foodItems as item (item.id)}
										<li>
											<button
												type="button"
												onclick={() => handleSelectFoodItem(item)}
												class="w-full px-3 py-2 text-left text-sm hover:bg-accent"
												role="option"
											>
												{item.name}
											</button>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
						{#if selectedFoodItemId}
							<p class="text-xs text-muted-foreground">
								{m['dietary.restrictions_foodItemSelected']()}
							</p>
						{:else if foodItemSearch.trim() && !isFetchingFoodItems && foodItems.length === 0}
							<p class="text-xs text-muted-foreground">
								{m['dietary.restrictions_foodItemNew']()}
							</p>
						{/if}
					</div>

					<div class="space-y-2">
						<label for="restriction-type" class="block text-sm font-medium">
							{m['dietary.restrictions_severityLabel']()}
						</label>
						<select
							id="restriction-type"
							bind:value={restrictionType}
							required
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							<option value="dislike">{m['dietary.restrictions_severity_dislike']()}</option>
							<option value="intolerant">{m['dietary.restrictions_severity_intolerant']()}</option>
							<option value="allergy">{m['dietary.restrictions_severity_allergy']()}</option>
							<option value="severe_allergy"
								>{m['dietary.restrictions_severity_severe_allergy']()}</option
							>
						</select>
					</div>

					<div class="space-y-2">
						<label for="restriction-notes" class="block text-sm font-medium">
							{m['dietary.restrictions_notesLabel']()}
						</label>
						<input
							id="restriction-notes"
							type="text"
							bind:value={notes}
							placeholder={m['dietary.restrictions_notesPlaceholder']()}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						/>
					</div>

					<div class="space-y-2">
						<span class="block text-sm font-medium">
							{m['dietary.addPreference_visibilityLabel']()}
						</span>
						<div class="space-y-2">
							<label class="flex items-start gap-2">
								<input
									type="radio"
									name="visibility"
									value="public"
									checked={isPublic}
									onchange={() => (isPublic = true)}
									class="mt-1"
								/>
								<span class="text-sm">
									{m['dietary.addPreference_visibilityPublic']()}
								</span>
							</label>
							<label class="flex items-start gap-2">
								<input
									type="radio"
									name="visibility"
									value="private"
									checked={!isPublic}
									onchange={() => (isPublic = false)}
									class="mt-1"
								/>
								<span class="text-sm">
									{m['dietary.addPreference_visibilityPrivate']()}
								</span>
							</label>
						</div>
					</div>

					<div class="flex gap-3">
						<button
							type="button"
							onclick={() => (showAddDialog = false)}
							disabled={isAddingRestriction}
							class="flex-1 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
						>
							{m['dietary.restrictions_cancelButton']()}
						</button>
						<button
							type="submit"
							disabled={isAddingRestriction || !foodItemName.trim()}
							class="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>
							{#if isAddingRestriction}
								<span class="flex items-center justify-center gap-2">
									<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
									{m['dietary.restrictions_savingButton']()}
								</span>
							{:else}
								{m['dietary.restrictions_addButton']()}
							{/if}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
