<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		PriceCategorySchema,
		PriceCategoryCreateSchema
	} from '$lib/api/generated/types.gen';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminvenuesCreatePriceCategory,
		organizationadminvenuesUpdatePriceCategory
	} from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { extractApiErrorDetail } from '$lib/utils/api-error-detail';
	import { X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		category: PriceCategorySchema | null;
		organizationSlug: string;
		venueId: string;
		onClose: () => void;
		onSuccess: () => void;
	}

	const { category, organizationSlug, venueId, onClose, onSuccess }: Props = $props();

	const isEditing = $derived(!!category);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Form state
	let name = $state(category?.name ?? '');
	// <input type="color"> emits exactly #rrggbb, matching the backend HexColor pattern.
	let color = $state(category?.color ?? '#8c3cdd');
	// Svelte's number-input binding yields null when the field is cleared, so the
	// type must admit it; handleSubmit coalesces back to the backend default (0).
	let displayOrder = $state<number | null>(category?.display_order ?? 0);
	// Backend 400 detail (e.g. duplicate name within the venue) shown inline.
	let errorMessage = $state<string | null>(null);

	const listQueryKey = $derived([
		'org-admin',
		organizationSlug,
		'venue',
		venueId,
		'price-categories'
	]);

	// Create mutation
	const createMutationFn = createMutation(() => ({
		mutationFn: async (data: PriceCategoryCreateSchema) => {
			const response = await organizationadminvenuesCreatePriceCategory({
				path: { slug: organizationSlug, venue_id: venueId },
				body: data,
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error(
					extractApiErrorDetail(response.error) ?? m['orgAdmin.priceCategories.toast.createError']()
				);
			}

			return response.data;
		},
		onSuccess: () => {
			toast.success(m['orgAdmin.priceCategories.toast.created']());
			queryClient.invalidateQueries({ queryKey: listQueryKey });
			onSuccess();
		},
		onError: (error: Error) => {
			errorMessage = error.message;
		}
	}));

	// Update mutation
	const updateMutationFn = createMutation(() => ({
		mutationFn: async (data: PriceCategoryCreateSchema) => {
			if (!category?.id) throw new Error('No price category ID');

			const response = await organizationadminvenuesUpdatePriceCategory({
				path: { slug: organizationSlug, venue_id: venueId, category_id: category.id },
				body: data,
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error(
					extractApiErrorDetail(response.error) ?? m['orgAdmin.priceCategories.toast.updateError']()
				);
			}

			return response.data;
		},
		onSuccess: () => {
			toast.success(m['orgAdmin.priceCategories.toast.updated']());
			queryClient.invalidateQueries({ queryKey: listQueryKey });
			onSuccess();
		},
		onError: (error: Error) => {
			errorMessage = error.message;
		}
	}));

	const isPending = $derived(createMutationFn.isPending || updateMutationFn.isPending);

	function handleSubmit(e: Event) {
		e.preventDefault();
		errorMessage = null;

		const data: PriceCategoryCreateSchema = {
			name: name.trim(),
			color,
			// A cleared or negative field falls back to the backend default instead
			// of round-tripping a raw pydantic validation error.
			display_order: typeof displayOrder === 'number' && displayOrder >= 0 ? displayOrder : 0
		};

		if (isEditing) {
			updateMutationFn.mutate(data);
		} else {
			createMutationFn.mutate(data);
		}
	}

	// Focus management (WCAG 2.4.3): bound after mount, before the $effect runs.
	let dialogEl: HTMLDivElement | undefined;
	let nameInput: HTMLInputElement | undefined;

	// Move focus into the dialog on open; restore it to the invoking control on
	// close. No reactive reads, so this runs exactly once per mount.
	$effect(() => {
		const previouslyFocused =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		nameInput?.focus();
		return () => previouslyFocused?.focus();
	});

	function handleKeydown(e: KeyboardEvent) {
		// Gate Escape like the Cancel button: dismissing mid-flight would lose the
		// inline error surface (create/update failures are not toasted).
		if (e.key === 'Escape' && !isPending) {
			onClose();
			return;
		}

		// Trap Tab within the dialog: aria-modal hides the background from AT but
		// does not restrict keyboard focus.
		if (e.key === 'Tab' && dialogEl) {
			const focusables = Array.from(
				dialogEl.querySelectorAll<HTMLElement>(
					'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
				)
			);
			if (focusables.length === 0) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const active = document.activeElement;

			if (active instanceof HTMLElement && dialogEl.contains(active)) {
				if (e.shiftKey && active === first) {
					e.preventDefault();
					last.focus();
				} else if (!e.shiftKey && active === last) {
					e.preventDefault();
					first.focus();
				}
			} else {
				// Focus escaped (or never entered) the dialog — pull it back in.
				e.preventDefault();
				first.focus();
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Modal backdrop -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
	role="dialog"
	aria-modal="true"
	aria-labelledby="price-category-modal-title"
>
	<!-- Modal content -->
	<div
		bind:this={dialogEl}
		class="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-background shadow-xl"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b px-6 py-4">
			<h2 id="price-category-modal-title" class="text-xl font-semibold">
				{isEditing
					? m['orgAdmin.priceCategories.form.editTitle']()
					: m['orgAdmin.priceCategories.form.createTitle']()}
			</h2>
			<button
				type="button"
				onclick={onClose}
				disabled={isPending}
				class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
				aria-label={m['common.cancel']()}
			>
				<X class="h-5 w-5" />
			</button>
		</div>

		<!-- Form -->
		<form onsubmit={handleSubmit} class="min-h-0 flex-1 overflow-y-auto p-6">
			<div class="space-y-4">
				{#if errorMessage}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
						{errorMessage}
					</div>
				{/if}

				<!-- Name -->
				<div>
					<label for="price-category-name" class="mb-1.5 block text-sm font-medium">
						{m['orgAdmin.priceCategories.form.nameLabel']()}
					</label>
					<input
						id="price-category-name"
						type="text"
						bind:this={nameInput}
						bind:value={name}
						placeholder={m['orgAdmin.priceCategories.form.namePlaceholder']()}
						required
						maxlength="100"
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					/>
				</div>

				<!-- Color -->
				<div>
					<label for="price-category-color" class="mb-1.5 block text-sm font-medium">
						{m['orgAdmin.priceCategories.form.colorLabel']()}
					</label>
					<div class="flex items-center gap-3">
						<input
							id="price-category-color"
							type="color"
							bind:value={color}
							aria-describedby="price-category-color-hex"
							class="h-10 w-14 cursor-pointer rounded-md border border-input bg-background p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						/>
						<!-- Hex readback so the chosen value is never conveyed by color alone -->
						<span id="price-category-color-hex" class="font-mono text-sm text-muted-foreground"
							>{color}</span
						>
					</div>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['orgAdmin.priceCategories.form.colorHelp']()}
					</p>
				</div>

				<!-- Display Order -->
				<div>
					<label for="price-category-display-order" class="mb-1.5 block text-sm font-medium">
						{m['orgAdmin.priceCategories.form.displayOrderLabel']()}
					</label>
					<input
						id="price-category-display-order"
						type="number"
						min="0"
						bind:value={displayOrder}
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					/>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['orgAdmin.priceCategories.form.displayOrderHelp']()}
					</p>
				</div>
			</div>

			<!-- Actions -->
			<div class="mt-6 flex justify-end gap-3">
				<button
					type="button"
					onclick={onClose}
					disabled={isPending}
					class="rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
				>
					{m['common.cancel']()}
				</button>
				<button
					type="submit"
					disabled={isPending || !name.trim()}
					class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
				>
					{#if isPending}
						{isEditing
							? m['orgAdmin.priceCategories.form.saving']()
							: m['orgAdmin.priceCategories.form.creating']()}
					{:else}
						{isEditing
							? m['orgAdmin.priceCategories.form.save']()
							: m['orgAdmin.priceCategories.form.create']()}
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>
