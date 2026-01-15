<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		VenueDetailSchema,
		VenueCreateSchema,
		CitySchema
	} from '$lib/api/generated/types.gen';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminvenuesCreateVenue,
		organizationadminvenuesUpdateVenue
	} from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { X } from 'lucide-svelte';
	import CityAutocomplete from '$lib/components/forms/CityAutocomplete.svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		venue: VenueDetailSchema | null;
		organizationSlug: string;
		onClose: () => void;
		onSuccess: () => void;
	}

	let { venue, organizationSlug, onClose, onSuccess }: Props = $props();

	const isEditing = $derived(!!venue);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Form state
	let name = $state(venue?.name ?? '');
	let description = $state(venue?.description ?? '');
	let capacity = $state<number | undefined>(venue?.capacity ?? undefined);
	let cityId = $state<number | undefined>(venue?.city?.id ?? undefined);
	let selectedCity = $state<CitySchema | null>(venue?.city ?? null);
	let address = $state(venue?.address ?? '');

	// Helper to extract error message from API response
	function getErrorMessage(error: any): string {
		if (error?.detail) {
			if (typeof error.detail === 'string') return error.detail;
			if (Array.isArray(error.detail)) {
				return error.detail.map((d: any) => d.msg || d.message || String(d)).join(', ');
			}
		}
		if (error?.message) return error.message;
		return m['orgAdmin.venues.toast.genericError']?.() ?? 'An unexpected error occurred';
	}

	// Create mutation
	const createMutationFn = createMutation(() => ({
		mutationFn: async (data: VenueCreateSchema) => {
			const response = await organizationadminvenuesCreateVenue({
				path: { slug: organizationSlug },
				body: data,
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw response.error;
			}

			return response.data;
		},
		onSuccess: () => {
			toast.success(m['orgAdmin.venues.toast.created']());
			queryClient.invalidateQueries({ queryKey: ['organization-venues'] });
			onSuccess();
		},
		onError: (error: any) => {
			const message = getErrorMessage(error);
			toast.error(m['orgAdmin.venues.toast.createError']() + ': ' + message);
		}
	}));

	// Update mutation
	const updateMutationFn = createMutation(() => ({
		mutationFn: async (data: VenueCreateSchema) => {
			if (!venue?.id) throw new Error('No venue ID');

			const response = await organizationadminvenuesUpdateVenue({
				path: { slug: organizationSlug, venue_id: venue.id },
				body: data,
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw response.error;
			}

			return response.data;
		},
		onSuccess: () => {
			toast.success(m['orgAdmin.venues.toast.updated']());
			queryClient.invalidateQueries({ queryKey: ['organization-venues'] });
			onSuccess();
		},
		onError: (error: any) => {
			const message = getErrorMessage(error);
			toast.error(m['orgAdmin.venues.toast.updateError']() + ': ' + message);
		}
	}));

	const isPending = $derived(createMutationFn.isPending || updateMutationFn.isPending);

	function handleSubmit(e: Event) {
		e.preventDefault();

		const data: VenueCreateSchema = {
			name: name.trim(),
			description: description.trim() || undefined,
			capacity: capacity || undefined,
			city_id: cityId || undefined,
			address: address.trim() || undefined
		};

		if (isEditing) {
			updateMutationFn.mutate(data);
		} else {
			createMutationFn.mutate(data);
		}
	}

	function handleCitySelect(city: CitySchema | null) {
		cityId = city?.id ?? undefined;
		selectedCity = city;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Modal backdrop -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
	role="dialog"
	aria-modal="true"
	aria-labelledby="venue-modal-title"
>
	<!-- Modal content -->
	<div class="w-full max-w-lg rounded-lg bg-background shadow-xl">
		<!-- Header -->
		<div class="flex items-center justify-between border-b px-6 py-4">
			<h2 id="venue-modal-title" class="text-xl font-semibold">
				{isEditing
					? m['orgAdmin.venues.form.editTitle']()
					: m['orgAdmin.venues.form.createTitle']()}
			</h2>
			<button
				type="button"
				onclick={onClose}
				class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={m['orgAdmin.venues.form.cancel']()}
			>
				<X class="h-5 w-5" />
			</button>
		</div>

		<!-- Form -->
		<form onsubmit={handleSubmit} class="p-6">
			<div class="space-y-4">
				<!-- Name -->
				<div>
					<label for="venue-name" class="mb-1.5 block text-sm font-medium">
						{m['orgAdmin.venues.form.nameLabel']()}
					</label>
					<input
						id="venue-name"
						type="text"
						bind:value={name}
						placeholder={m['orgAdmin.venues.form.namePlaceholder']()}
						required
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					/>
				</div>

				<!-- Description -->
				<div>
					<label for="venue-description" class="mb-1.5 block text-sm font-medium">
						{m['orgAdmin.venues.form.descriptionLabel']()}
					</label>
					<textarea
						id="venue-description"
						bind:value={description}
						placeholder={m['orgAdmin.venues.form.descriptionPlaceholder']()}
						rows="3"
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					></textarea>
				</div>

				<!-- Capacity -->
				<div>
					<label for="venue-capacity" class="mb-1.5 block text-sm font-medium">
						{m['orgAdmin.venues.form.capacityLabel']()}
					</label>
					<input
						id="venue-capacity"
						type="number"
						min="0"
						bind:value={capacity}
						placeholder={m['orgAdmin.venues.form.capacityPlaceholder']()}
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					/>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['orgAdmin.venues.form.capacityHelp']()}
					</p>
				</div>

				<!-- City -->
				<div>
					<CityAutocomplete
						value={selectedCity}
						onSelect={handleCitySelect}
						label={m['orgAdmin.venues.form.cityLabel']()}
						description=""
					/>
				</div>

				<!-- Address -->
				<div>
					<label for="venue-address" class="mb-1.5 block text-sm font-medium">
						{m['orgAdmin.venues.form.addressLabel']()}
					</label>
					<input
						id="venue-address"
						type="text"
						bind:value={address}
						placeholder={m['orgAdmin.venues.form.addressPlaceholder']()}
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					/>
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
					{m['orgAdmin.venues.form.cancel']()}
				</button>
				<button
					type="submit"
					disabled={isPending || !name.trim()}
					class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
				>
					{#if isPending}
						{isEditing ? m['orgAdmin.venues.form.saving']() : m['orgAdmin.venues.form.creating']()}
					{:else}
						{isEditing ? m['orgAdmin.venues.form.save']() : m['orgAdmin.venues.form.create']()}
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>
