<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { createMutation } from '@tanstack/svelte-query';
	import { eventadminDuplicateEvent } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';
	import { Copy, Loader2 } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		open: boolean;
		eventId: string;
		eventName: string;
		eventStart: string;
		organizationSlug: string;
		onClose: () => void;
	}

	let {
		open = $bindable(),
		eventId,
		eventName,
		eventStart,
		organizationSlug,
		onClose
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	// Form state
	let newName = $state('');
	let newStart = $state('');
	let errorMessage = $state<string | null>(null);

	// Initialize form when modal opens
	$effect(() => {
		if (open) {
			// Suggest name with "Copy of" prefix
			newName = m['duplicateEventModal.copyOf']({ name: eventName });
			// Default to current date/time in local format
			const now = new Date();
			now.setMinutes(now.getMinutes() + 60); // Add 1 hour
			newStart = now.toISOString().slice(0, 16);
			errorMessage = null;
		}
	});

	// Duplicate mutation
	const duplicateMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error(m['duplicateEventModal.error_notAuthenticated']());

			const response = await eventadminDuplicateEvent({
				path: { event_id: eventId },
				body: {
					name: newName.trim(),
					start: new Date(newStart).toISOString()
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
			goto(`/org/${organizationSlug}/admin/events/${data.id}/edit`);
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
				<label for="duplicate-start" class="block text-sm font-medium">
					{m['duplicateEventModal.newStart']()} <span class="text-destructive">*</span>
				</label>
				<input
					id="duplicate-start"
					type="datetime-local"
					bind:value={newStart}
					required
					disabled={duplicateMutation.isPending}
					class={cn(
						'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
					)}
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
