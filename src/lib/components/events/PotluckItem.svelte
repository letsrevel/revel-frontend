<script lang="ts">
	import type { PotluckItemRetrieveSchema } from '$lib/api/generated/types.gen';
	import { Edit2, Trash2 } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import { canEditPotluckItem, canDeletePotluckItem } from '$lib/utils/permissions';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		item: PotluckItemRetrieveSchema;
		hasManagePermission: boolean; // User has manage_event permission
		canClaim: boolean; // User is authenticated and RSVP'd "yes"
		onClaim: (id: string) => void;
		onUnclaim: (id: string) => void;
		onEdit?: (id: string) => void;
		onDelete?: (id: string) => void;
		class?: string;
	}

	let {
		item,
		hasManagePermission,
		canClaim,
		onClaim,
		onUnclaim,
		onEdit,
		onDelete,
		class: className
	}: Props = $props();

	// Compute permissions for this specific item
	// is_owned is optional and should only be true if explicitly true
	let canEdit = $derived(canEditPotluckItem(item.is_owned === true, hasManagePermission));
	let canDelete = $derived(canDeletePotluckItem(item.is_owned === true, hasManagePermission));

	// Debug logging for permissions
	$effect(() => {
		console.log('[PotluckItem] Permission check:', {
			item_id: item.id,
			item_name: item.name,
			is_owned: item.is_owned,
			is_assigned: item.is_assigned,
			hasManagePermission,
			canEdit,
			canDelete,
			canClaim
		});
	});

	// Item type display names mapping
	const ITEM_TYPE_LABELS: Record<string, () => string> = {
		food: () => m['potluck.itemType_food'](),
		main_course: () => m['potluck.itemType_mainCourse'](),
		side_dish: () => m['potluck.itemType_sideDish'](),
		dessert: () => m['potluck.itemType_dessert'](),
		drink: () => m['potluck.itemType_drink'](),
		alcohol: () => m['potluck.itemType_alcohol'](),
		non_alcoholic: () => m['potluck.itemType_nonAlcoholic'](),
		supplies: () => m['potluck.itemType_supplies'](),
		labor: () => m['potluck.itemType_labor'](),
		entertainment: () => m['potluck.itemType_entertainment'](),
		sexual_health: () => m['potluck.itemType_sexualHealth'](),
		toys: () => m['potluck.itemType_toys'](),
		care: () => m['potluck.itemType_care'](),
		transport: () => m['potluck.itemType_transport'](),
		misc: () => m['potluck.itemType_misc']()
	};

	// Computed values
	let itemTypeLabel = $derived(
		ITEM_TYPE_LABELS[item.item_type]?.() || m['potluck.itemType_misc']()
	);

	let statusBadgeText = $derived.by(() => {
		if (item.is_owned) return m['potluck.status_youreBringing']();
		if (item.is_assigned) return m['potluck.status_claimed']();
		return m['potluck.status_unclaimed']();
	});

	let statusBadgeVariant = $derived.by(() => {
		if (item.is_owned) return 'success';
		if (item.is_assigned) return 'info';
		return 'default';
	});

	let buttonText = $derived.by(() => {
		if (item.is_owned) return m['potluck.button_unclaim']();
		if (item.is_assigned) return m['potluck.button_alreadyClaimed']();
		if (!canClaim) return m['potluck.button_rsvpToClaim']();
		return m['potluck.button_illBringThis']();
	});

	let isButtonDisabled = $derived((item.is_assigned && !item.is_owned) || !canClaim);

	let buttonVariant = $derived.by(() => {
		if (item.is_owned) return 'secondary';
		if (item.is_assigned || !canClaim) return 'disabled';
		return 'primary';
	});

	// Descriptive label for screen readers
	let descriptiveLabel = $derived.by(() => {
		const parts = [item.name, itemTypeLabel];
		if (item.quantity) parts.push(item.quantity);
		parts.push(statusBadgeText);
		return parts.join(', ');
	});

	// Metadata text (type + quantity)
	let metadataText = $derived.by(() => {
		if (item.quantity) {
			return `${itemTypeLabel} • ${item.quantity}`;
		}
		return itemTypeLabel;
	});

	// Action handlers
	function handleClaimClick(): void {
		if (!item.id) return;

		if (item.is_owned) {
			onUnclaim(item.id);
		} else if (!item.is_assigned && canClaim) {
			onClaim(item.id);
		}
	}

	function handleEditClick(): void {
		if (item.id && onEdit) {
			onEdit(item.id);
		}
	}

	function handleDeleteClick(): void {
		if (item.id && onDelete) {
			onDelete(item.id);
		}
	}
</script>

<article
	aria-label={descriptiveLabel}
	class={cn(
		'flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md',
		className
	)}
>
	<!-- Header: Item name + Status badge -->
	<div class="flex items-start justify-between gap-3">
		<h3 class="flex-1 text-base font-semibold text-foreground">
			{item.name}
		</h3>
		<span
			class={cn(
				'shrink-0 rounded-full border px-2 py-1 text-xs font-medium',
				statusBadgeVariant === 'success' &&
					'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300',
				statusBadgeVariant === 'info' &&
					'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
				statusBadgeVariant === 'default' &&
					'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
			)}
			aria-label={`Status: ${statusBadgeText}`}
		>
			{statusBadgeText}
		</span>
	</div>

	<!-- Metadata: Type + Quantity -->
	<p class="text-sm text-muted-foreground">
		{metadataText}
	</p>

	<!-- Optional Note -->
	{#if item.note_html}
		<div class="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground">
			<!-- svelte-ignore a11y_no_unsafe_html -->
			<!-- note_html is sanitized by the backend -->
			{@html item.note_html}
		</div>
	{/if}

	<!-- Divider -->
	<div class="border-t border-border"></div>

	<!-- Action row: Claim button + Edit/Delete actions -->
	<div class="flex flex-wrap items-center gap-2">
		<!-- Claim/Unclaim button -->
		<button
			type="button"
			onclick={handleClaimClick}
			disabled={isButtonDisabled}
			aria-label={item.is_owned ? `Unclaim ${item.name}` : `Claim ${item.name}`}
			class={cn(
				'min-w-[160px] flex-1 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:min-w-[140px] md:flex-initial md:px-4',
				buttonVariant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
				buttonVariant === 'secondary' &&
					'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
				buttonVariant === 'disabled' &&
					'cursor-not-allowed border border-input bg-muted text-muted-foreground opacity-60'
			)}
		>
			{buttonText}
		</button>

		<!-- Edit/Delete actions - Shown if user can edit or delete -->
		{#if (canEdit && onEdit) || (canDelete && onDelete)}
			<div class="flex items-center gap-1">
				{#if canEdit && onEdit}
					<button
						type="button"
						onclick={handleEditClick}
						aria-label={`Edit ${item.name}`}
						class="flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Edit2 class="h-4 w-4" aria-hidden="true" />
					</button>
				{/if}
				{#if canDelete && onDelete}
					<button
						type="button"
						onclick={handleDeleteClick}
						aria-label={`Delete ${item.name}`}
						class="flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Trash2 class="h-4 w-4" aria-hidden="true" />
					</button>
				{/if}
			</div>
		{/if}
	</div>
</article>
