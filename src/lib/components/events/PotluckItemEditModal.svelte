<script lang="ts">
	import type { PotluckItemRetrieveSchema } from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import { X } from 'lucide-svelte';

	interface Props {
		item: PotluckItemRetrieveSchema;
		isOpen: boolean;
		onSubmit: (data: {
			name: string;
			item_type: string;
			quantity: string | null;
			note: string | null;
		}) => void;
		onCancel: () => void;
		class?: string;
	}

	let { item, isOpen, onSubmit, onCancel, class: className }: Props = $props();

	// Form state - initialize with item data
	let name = $state(item.name);
	let itemType = $state(item.item_type);
	let quantity = $state(item.quantity || '');
	let note = $state(''); // Note is not in retrieve schema, only note_html

	// Item type options
	const ITEM_TYPE_OPTIONS = [
		{ value: 'food', label: 'Food' },
		{ value: 'main_course', label: 'Main Course' },
		{ value: 'side_dish', label: 'Side Dish' },
		{ value: 'dessert', label: 'Dessert' },
		{ value: 'drink', label: 'Drink' },
		{ value: 'alcohol', label: 'Alcohol' },
		{ value: 'non_alcoholic', label: 'Non-Alcoholic' },
		{ value: 'supplies', label: 'Supplies' },
		{ value: 'labor', label: 'Labor/Help' },
		{ value: 'entertainment', label: 'Entertainment' },
		{ value: 'sexual_health', label: 'Sexual Health' },
		{ value: 'toys', label: 'Toys' },
		{ value: 'care', label: 'Care' },
		{ value: 'transport', label: 'Transport' },
		{ value: 'misc', label: 'Other' }
	];

	// Validation
	let errors = $state<Record<string, string>>({});

	let isValid = $derived.by(() => {
		return name.trim().length > 0 && name.trim().length <= 100 && itemType.trim().length > 0;
	});

	// Reset form when item changes
	$effect(() => {
		if (isOpen) {
			name = item.name;
			itemType = item.item_type;
			quantity = item.quantity || '';
			note = '';
			errors = {};
		}
	});

	// Form handlers
	function handleSubmit(event: Event) {
		event.preventDefault();

		// Clear previous errors
		errors = {};

		// Validate
		if (!name.trim()) {
			errors.name = 'Item name is required';
			return;
		}

		if (name.trim().length > 100) {
			errors.name = 'Item name must be 100 characters or less';
			return;
		}

		if (!itemType) {
			errors.itemType = 'Please select an item type';
			return;
		}

		if (quantity.length > 20) {
			errors.quantity = 'Quantity must be 20 characters or less';
			return;
		}

		// Submit the form
		onSubmit({
			name: name.trim(),
			item_type: itemType,
			quantity: quantity.trim() || null,
			note: note.trim() || null
		});
	}

	function handleCancel() {
		errors = {};
		onCancel();
	}

	// Auto-focus the name field when the modal opens
	let nameInput = $state<HTMLInputElement | undefined>();
	$effect(() => {
		if (isOpen && nameInput) {
			nameInput.focus();
		}
	});
</script>

{#if isOpen}
	<!-- Modal backdrop -->
	<div
		class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
		onclick={handleCancel}
		role="presentation"
	></div>

	<!-- Modal content -->
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="edit-modal-title"
		class={cn(
			'fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-lg border bg-card p-6 shadow-lg',
			className
		)}
	>
		<div class="mb-4 flex items-center justify-between">
			<h2 id="edit-modal-title" class="text-lg font-semibold">Edit potluck item</h2>
			<button
				type="button"
				onclick={handleCancel}
				aria-label="Close modal"
				class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<X class="h-5 w-5" aria-hidden="true" />
			</button>
		</div>

		<form onsubmit={handleSubmit} class="space-y-4">
			<!-- Item Name -->
			<div>
				<label for="edit-item-name" class="mb-1.5 block text-sm font-medium">
					Item name <span class="text-destructive">*</span>
				</label>
				<input
					id="edit-item-name"
					type="text"
					bind:this={nameInput}
					bind:value={name}
					placeholder="e.g., Pasta Salad"
					maxlength="100"
					aria-required="true"
					aria-invalid={!!errors.name}
					aria-describedby={errors.name ? 'edit-name-error' : undefined}
					class={cn(
						'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
						errors.name && 'border-destructive'
					)}
				/>
				{#if errors.name}
					<p id="edit-name-error" class="mt-1 text-sm text-destructive">
						{errors.name}
					</p>
				{/if}
			</div>

			<!-- Item Type & Quantity -->
			<div class="grid gap-4 md:grid-cols-2">
				<!-- Item Type -->
				<div>
					<label for="edit-item-type" class="mb-1.5 block text-sm font-medium">
						Category <span class="text-destructive">*</span>
					</label>
					<select
						id="edit-item-type"
						bind:value={itemType}
						aria-required="true"
						aria-invalid={!!errors.itemType}
						aria-describedby={errors.itemType ? 'edit-type-error' : undefined}
						class={cn(
							'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
							errors.itemType && 'border-destructive'
						)}
					>
						{#each ITEM_TYPE_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
					{#if errors.itemType}
						<p id="edit-type-error" class="mt-1 text-sm text-destructive">
							{errors.itemType}
						</p>
					{/if}
				</div>

				<!-- Quantity -->
				<div>
					<label for="edit-quantity" class="mb-1.5 block text-sm font-medium">
						Quantity <span class="text-muted-foreground">(optional)</span>
					</label>
					<input
						id="edit-quantity"
						type="text"
						bind:value={quantity}
						placeholder="e.g., serves 10, 2 bottles"
						maxlength="20"
						aria-describedby={errors.quantity ? 'edit-quantity-error' : 'edit-quantity-help'}
						class={cn(
							'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
							errors.quantity && 'border-destructive'
						)}
					/>
					{#if errors.quantity}
						<p id="edit-quantity-error" class="mt-1 text-sm text-destructive">
							{errors.quantity}
						</p>
					{:else}
						<p id="edit-quantity-help" class="mt-1 text-xs text-muted-foreground">
							e.g., "serves 8" or "2 bottles"
						</p>
					{/if}
				</div>
			</div>

			<!-- Note -->
			<div>
				<label for="edit-note" class="mb-1.5 block text-sm font-medium">
					Note <span class="text-muted-foreground">(optional)</span>
				</label>
				<textarea
					id="edit-note"
					bind:value={note}
					placeholder="Any additional details (e.g., dietary info, preparation notes)"
					rows="3"
					class="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				></textarea>
				<p class="mt-1 text-xs text-muted-foreground">Basic markdown supported</p>
			</div>

			<!-- Action buttons -->
			<div class="flex items-center justify-end gap-2 pt-2">
				<button
					type="button"
					onclick={handleCancel}
					class="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={!isValid}
					class={cn(
						'rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						isValid
							? 'bg-primary text-primary-foreground hover:bg-primary/90'
							: 'cursor-not-allowed bg-muted text-muted-foreground opacity-60'
					)}
				>
					Save changes
				</button>
			</div>
		</form>
	</div>
{/if}
