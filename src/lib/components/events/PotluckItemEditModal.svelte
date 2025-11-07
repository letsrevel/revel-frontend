<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PotluckItemRetrieveSchema, ItemTypes } from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import { X } from 'lucide-svelte';

	interface Props {
		item?: PotluckItemRetrieveSchema | null; // null/undefined for create mode
		isOpen: boolean;
		hasManagePermission: boolean; // For showing claim checkbox in create mode
		errorMessage?: string | null; // Error message to display inside modal
		onSubmit: (data: {
			name: string;
			item_type: string;
			quantity: string | null;
			note: string | null;
			claimItem?: boolean; // Only used in create mode
		}) => void;
		onCancel: () => void;
		class?: string;
	}

	let {
		item = null,
		isOpen,
		hasManagePermission,
		errorMessage = null,
		onSubmit,
		onCancel,
		class: className
	}: Props = $props();

	// Determine if we're in create or edit mode
	let isCreateMode = $derived(!item);

	// Form state - initialize with item data (edit) or empty (create)
	let name = $state(item?.name || '');
	let itemType = $state<ItemTypes>((item?.item_type as ItemTypes) || 'food');
	let quantity = $state(item?.quantity || '');
	let note = $state(''); // Note is not in retrieve schema, only note_html
	let claimItem = $state(true); // For create mode with manage permission

	// Item type options
	const ITEM_TYPE_OPTIONS = [
		{ value: 'food', label: m['potluckItemEditModal.itemTypes.food']() },
		{ value: 'main_course', label: m['potluckItemEditModal.itemTypes.main_course']() },
		{ value: 'side_dish', label: m['potluckItemEditModal.itemTypes.side_dish']() },
		{ value: 'dessert', label: m['potluckItemEditModal.itemTypes.dessert']() },
		{ value: 'drink', label: m['potluckItemEditModal.itemTypes.drink']() },
		{ value: 'alcohol', label: m['potluckItemEditModal.itemTypes.alcohol']() },
		{ value: 'non_alcoholic', label: m['potluckItemEditModal.itemTypes.non_alcoholic']() },
		{ value: 'supplies', label: m['potluckItemEditModal.itemTypes.supplies']() },
		{ value: 'labor', label: m['potluckItemEditModal.itemTypes.labor']() },
		{ value: 'entertainment', label: m['potluckItemEditModal.itemTypes.entertainment']() },
		{ value: 'sexual_health', label: m['potluckItemEditModal.itemTypes.sexual_health']() },
		{ value: 'toys', label: m['potluckItemEditModal.itemTypes.toys']() },
		{ value: 'care', label: m['potluckItemEditModal.itemTypes.care']() },
		{ value: 'transport', label: m['potluckItemEditModal.itemTypes.transport']() },
		{ value: 'misc', label: m['potluckItemEditModal.itemTypes.misc']() }
	];

	// Validation
	let errors = $state<Record<string, string>>({});

	let isValid = $derived.by(() => {
		return name.trim().length > 0 && name.trim().length <= 100 && itemType.trim().length > 0;
	});

	// Reset form when modal opens/closes or item changes
	$effect(() => {
		if (isOpen) {
			if (item) {
				// Edit mode - populate with item data
				name = item.name;
				itemType = item.item_type as ItemTypes;
				quantity = item.quantity || '';
				note = '';
			} else {
				// Create mode - reset to defaults
				name = '';
				itemType = 'food';
				quantity = '';
				note = '';
				claimItem = true;
			}
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
			errors.name = m['potluckItemEditModal.itemNameRequired']();
			return;
		}

		if (name.trim().length > 100) {
			errors.name = m['potluckItemEditModal.itemNameTooLong']();
			return;
		}

		if (!itemType) {
			errors.itemType = m['potluckItemEditModal.itemTypeRequired']();
			return;
		}

		if (quantity.length > 20) {
			errors.quantity = m['potluckItemEditModal.quantityTooLong']();
			return;
		}

		// Submit the form
		const data = {
			name: name.trim(),
			item_type: itemType,
			quantity: quantity.trim() || null,
			note: note.trim() || null,
			...(isCreateMode && hasManagePermission && { claimItem })
		};
		onSubmit(data);
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
			<h2 id="edit-modal-title" class="text-lg font-semibold">
				{isCreateMode
					? hasManagePermission
						? m['potluckItemEditModal.addPotluckItem']()
						: m['potluckItemEditModal.addItemYoullBring']()
					: m['potluckItemEditModal.editPotluckItem']()}
			</h2>
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
			<!-- Error banner (inside modal) -->
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
				</div>
			{/if}

			<!-- Item Name -->
			<div>
				<label for="edit-item-name" class="mb-1.5 block text-sm font-medium">
					{m['potluckItemEditModal.itemName']()} <span class="text-destructive">*</span>
				</label>
				<input
					id="edit-item-name"
					type="text"
					bind:this={nameInput}
					bind:value={name}
					placeholder={m['potluckItemEditModal.itemNamePlaceholder']()}
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
						{m['potluckItemEditModal.category']()} <span class="text-destructive">*</span>
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
						{m['potluckItemEditModal.quantity']()}
						<span class="text-muted-foreground">{m['potluckItemEditModal.optional']()}</span>
					</label>
					<input
						id="edit-quantity"
						type="text"
						bind:value={quantity}
						placeholder={m['potluckItemEditModal.quantityPlaceholder']()}
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
					{m['potluckItemEditModal.note']()}
					<span class="text-muted-foreground">{m['potluckItemEditModal.optional']()}</span>
				</label>
				<textarea
					id="edit-note"
					bind:value={note}
					placeholder={m['potluckItemEditModal.notePlaceholder']()}
					rows="3"
					class="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				></textarea>
				<p class="mt-1 text-xs text-muted-foreground">{m['potluckItemForm.markdownSupported']()}</p>
			</div>

			<!-- Claim checkbox (create mode for staff/owners only) -->
			{#if isCreateMode && hasManagePermission}
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
						{m['potluckItemEditModal.illBringThisItem']()}
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
					{m['potluckItemEditModal.cancel']()}
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
					{isCreateMode
						? hasManagePermission && !claimItem
							? m['potluckItemEditModal.addAsSuggestion']()
							: m['potluckItemEditModal.addAndClaim']()
						: m['potluckItemEditModal.saveChanges']()}
				</button>
			</div>
		</form>
	</div>
{/if}
