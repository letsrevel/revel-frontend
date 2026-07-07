<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { createMutation } from '@tanstack/svelte-query';
	import { eventadmincoreDuplicateEvent } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Copy, Loader2 } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import DateTimePicker from '$lib/components/forms/DateTimePicker.svelte';

	interface Props {
		open: boolean;
		eventId: string;
		eventName: string;
		organizationSlug: string;
		/** Source event's start (ISO) used to prefill the new start. */
		eventStart?: string | null;
		onClose: () => void;
	}

	let {
		open = $bindable(),
		eventId,
		eventName,
		organizationSlug,
		eventStart = null,
		onClose
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	// Form state
	let newName = $state('');
	let newStart = $state('');
	let errorMessage = $state<string | null>(null);

	/**
	 * Suggest the duplicate's start, prefilled from the source event.
	 *
	 * The backend shifts `end`, `rsvp_before`, `apply_before`, `check_in_starts_at`,
	 * `check_in_ends_at`, and `waitlist_cutoff_date` by `newStart - sourceStart` (preserving
	 * the original durations), so only the start needs to be chosen here.
	 * A source start still in the future is reused verbatim. A past start keeps its
	 * (local) time-of-day and rolls forward to the next future occurrence of that time —
	 * today if that time is still ahead, otherwise tomorrow — so the field always satisfies
	 * the "must be in the future" rule while staying recognisable. With no source start we
	 * fall back to the previous default of now + 1 hour.
	 */
	/* eslint-disable svelte/prefer-svelte-reactivity -- local Date computations converted to an ISO string and discarded; not reactive state */
	function suggestNewStart(source: string | null | undefined): string {
		const now = new Date();

		if (source) {
			const sourceDate = new Date(source);
			if (!Number.isNaN(sourceDate.getTime())) {
				if (sourceDate.getTime() > now.getTime()) {
					return sourceDate.toISOString();
				}
				const candidate = new Date(now);
				candidate.setHours(sourceDate.getHours(), sourceDate.getMinutes(), 0, 0);
				if (candidate.getTime() <= now.getTime()) {
					candidate.setDate(candidate.getDate() + 1);
				}
				return candidate.toISOString();
			}
		}

		const fallback = new Date(now);
		fallback.setMinutes(fallback.getMinutes() + 60);
		return fallback.toISOString();
	}
	/* eslint-enable svelte/prefer-svelte-reactivity */

	// Initialize form when modal opens
	$effect(() => {
		if (open) {
			// Suggest name with "Copy of" prefix
			newName = m['duplicateEventModal.copyOf']({ name: eventName });
			newStart = suggestNewStart(eventStart);
			errorMessage = null;
		}
	});

	// Duplicate mutation
	const duplicateMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error(m['duplicateEventModal.error_notAuthenticated']());

			const response = await eventadmincoreDuplicateEvent({
				path: { event_id: eventId },
				body: {
					name: newName.trim(),
					start: newStart
				},
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				const errorDetail =
					typeof response.error === 'object' &&
					response.error !== null &&
					'detail' in response.error
						? (response.error.detail as string)
						: m['duplicateEventModal.error_failedToDuplicate']();
				throw new Error(errorDetail);
			}

			if (!response.data) {
				throw new Error(m['duplicateEventModal.error_failedToDuplicate']());
			}

			return response.data;
		},
		onSuccess: (data) => {
			// Navigate to the new event's edit page
			goto(
				resolve('/(auth)/org/[slug]/admin/events/[event_id]/edit', {
					slug: organizationSlug,
					event_id: data.id
				})
			);
			onClose();
		},
		onError: (error: Error) => {
			errorMessage = error.message;
		}
	}));

	function handleSubmit(e: Event) {
		e.preventDefault();
		errorMessage = null;

		// Validate
		if (!newName.trim()) {
			errorMessage = m['duplicateEventModal.error_nameRequired']();
			return;
		}

		if (!newStart) {
			errorMessage = m['duplicateEventModal.error_startRequired']();
			return;
		}

		const startDate = new Date(newStart);
		if (startDate <= new Date()) {
			errorMessage = m['duplicateEventModal.error_startFuture']();
			return;
		}

		duplicateMutation.mutate();
	}

	function handleClose() {
		if (!duplicateMutation.isPending) {
			onClose();
		}
	}
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
	<DialogContent class="max-w-md">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<Copy class="h-5 w-5" aria-hidden="true" />
				{m['duplicateEventModal.title']()}
			</DialogTitle>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="mt-4 space-y-4">
			<p class="text-sm text-muted-foreground">
				{m['duplicateEventModal.description']()}
			</p>

			<!-- New Event Name -->
			<div class="space-y-2">
				<label for="duplicate-name" class="block text-sm font-medium">
					{m['duplicateEventModal.newName']()} <span class="text-destructive">*</span>
				</label>
				<input
					id="duplicate-name"
					type="text"
					bind:value={newName}
					placeholder={m['duplicateEventModal.namePlaceholder']()}
					required
					disabled={duplicateMutation.isPending}
					class={cn(
						'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
					)}
				/>
			</div>

			<!-- New Start Date -->
			<div class="space-y-2">
				<DateTimePicker
					bind:value={newStart}
					label={m['duplicateEventModal.newStart']()}
					required
					disabled={duplicateMutation.isPending}
				/>
				<p class="text-xs text-muted-foreground">
					{m['duplicateEventModal.startHint']()}
				</p>
			</div>

			<!-- Error message -->
			{#if errorMessage}
				<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
					{errorMessage}
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex justify-end gap-3 pt-2">
				<Button
					type="button"
					variant="outline"
					onclick={handleClose}
					disabled={duplicateMutation.isPending}
				>
					{m['duplicateEventModal.cancel']()}
				</Button>
				<Button type="submit" disabled={duplicateMutation.isPending}>
					{#if duplicateMutation.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{m['duplicateEventModal.duplicating']()}
					{:else}
						<Copy class="mr-2 h-4 w-4" aria-hidden="true" />
						{m['duplicateEventModal.duplicate']()}
					{/if}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
