<script lang="ts">
	import type { PotluckItemCreateSchema } from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import { X } from 'lucide-svelte';

	interface Props {
		isOrganizer: boolean;
		onSubmit: (data: PotluckItemCreateSchema & { claimItem?: boolean }) => void;
		onCancel: () => void;
		isOpen?: boolean;
		class?: string;
	}

	let { isOrganizer, onSubmit, onCancel, isOpen = true, class: className }: Props = $props();

	// Form state
	let name = $state('');
	let itemType = $state<string>('food');
	let quantity = $state('');
	let note = $state('');
	let claimItem = $state(true); // Default to claiming the item

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
		const data: PotluckItemCreateSchema & { claimItem?: boolean } = {
			name: name.trim(),
			item_type: itemType,
			quantity: quantity.trim() || null,
			note: note.trim() || null
		};

		if (isOrganizer) {
			data.claimItem = claimItem;
		}

		onSubmit(data);

		// Reset form
		resetForm();
	}

	function handleCancel() {
		resetForm();
		onCancel();
	}

	function resetForm() {
		name = '';
		itemType = 'food';
		quantity = '';
		note = '';
		claimItem = true;
		errors = {};
	}

	// Auto-focus the name field when the form opens
	let nameInput = $state<HTMLInputElement | undefined>();
	$effect(() => {
		if (isOpen && nameInput) {
			nameInput.focus();
		}
	});
</script>

{#if isOpen}
	<div class={cn('rounded-lg border bg-card p-4', className)}>
		<div class="mb-4 flex items-center justify-between">
			<h3 class="text-lg font-semibold">
				{isOrganizer ? 'Add potluck item' : "Add item you'll bring"}
			</h3>
			<button
				type="button"
				onclick={handleCancel}
				aria-label="Close form"
				class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<X class="h-5 w-5" aria-hidden="true" />
			</button>
		</div>

		<form onsubmit={handleSubmit} class="space-y-4">
			<!-- Item Name -->
			<div>
				<label for="item-name" class="mb-1.5 block text-sm font-medium">
					Item name <span class="text-destructive">*</span>
				</label>
				<input
					id="item-name"
					type="text"
					bind:this={nameInput}
					bind:value={name}
					placeholder="e.g., Pasta Salad"
					maxlength="100"
					aria-required="true"
					aria-invalid={!!errors.name}
					aria-describedby={errors.name ? 'name-error' : undefined}
					class={cn(
						'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
						errors.name && 'border-destructive'
					)}
				/>
				{#if errors.name}
					<p id="name-error" class="mt-1 text-sm text-destructive">
						{errors.name}
					</p>
				{/if}
			</div>

			<!-- Item Type & Quantity (side by side on larger screens) -->
			<div class="grid gap-4 md:grid-cols-2">
				<!-- Item Type -->
				<div>
					<label for="item-type" class="mb-1.5 block text-sm font-medium">
						Category <span class="text-destructive">*</span>
					</label>
					<select
						id="item-type"
						bind:value={itemType}
						aria-required="true"
						aria-invalid={!!errors.itemType}
						aria-describedby={errors.itemType ? 'type-error' : undefined}
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
						<p id="type-error" class="mt-1 text-sm text-destructive">
							{errors.itemType}
						</p>
					{/if}
				</div>

				<!-- Quantity -->
				<div>
					<label for="quantity" class="mb-1.5 block text-sm font-medium">
						Quantity <span class="text-muted-foreground">(optional)</span>
					</label>
					<input
						id="quantity"
						type="text"
						bind:value={quantity}
						placeholder="e.g., serves 10, 2 bottles"
						maxlength="20"
						aria-describedby={errors.quantity ? 'quantity-error' : 'quantity-help'}
						class={cn(
							'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
							errors.quantity && 'border-destructive'
						)}
					/>
					{#if errors.quantity}
						<p id="quantity-error" class="mt-1 text-sm text-destructive">
							{errors.quantity}
						</p>
					{:else}
						<p id="quantity-help" class="mt-1 text-xs text-muted-foreground">
							e.g., "serves 8" or "2 bottles"
						</p>
					{/if}
				</div>
			</div>

			<!-- Note -->
			<div>
				<label for="note" class="mb-1.5 block text-sm font-medium">
					Note <span class="text-muted-foreground">(optional)</span>
				</label>
				<textarea
					id="note"
					bind:value={note}
					placeholder="Any additional details (e.g., dietary info, preparation notes)"
					rows="3"
					class="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				></textarea>
				<p class="mt-1 text-xs text-muted-foreground">Basic markdown supported</p>
			</div>

			<!-- Organizer option: Claim checkbox -->
			{#if isOrganizer}
				<div class="flex items-center gap-2">
					<input
						id="claim-item"
						type="checkbox"
						bind:checked={claimItem}
						class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
					/>
					<label
						for="claim-item"
						class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
					>
						I'll bring this item
					</label>
				</div>
			{/if}

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
					{isOrganizer && !claimItem ? 'Add as suggestion' : 'Add & claim'}
				</button>
			</div>
		</form>
	</div>
{/if}
