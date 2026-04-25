<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { CheckCircle, Loader2, Megaphone } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { eventadmincoreUpdateEventStatus } from '$lib/api/generated/sdk.gen';
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import { invalidateSeries } from '$lib/queries/event-series';
	import { formatEventDate } from '$lib/utils/date';

	interface Props {
		open: boolean;
		/** The draft occurrence being published. The dialog reads `id` (for the
		 *  status PATCH) and `start` (for the read-only date display). When
		 *  null the dialog is in transit between rows — content is empty until
		 *  the parent flips `open=true`. */
		event: EventInListSchema | null;
		organizationSlug: string;
		seriesId: string;
		accessToken: string | null;
		onClose: () => void;
	}

	/* eslint-disable prefer-const -- `open` is bindable so the whole destructure must use `let`. */
	let {
		open = $bindable(),
		event,
		organizationSlug,
		seriesId,
		accessToken,
		onClose
	}: Props = $props();
	/* eslint-enable prefer-const */

	const queryClient = useQueryClient();

	let errorBanner = $state<string | null>(null);

	$effect(() => {
		if (!open) {
			errorBanner = null;
		}
	});

	const publishMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error('Not authenticated');
			if (!event) throw new Error('No event selected');
			const response = await eventadmincoreUpdateEventStatus({
				path: { event_id: event.id, status: 'open' },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				const payload = response.error as Record<string, unknown>;
				throw new Error(extractErrorMessage(payload));
			}
			return response.data;
		},
		onSuccess: async () => {
			// Full series invalidation refreshes the upcoming list (status flip
			// from draft→open) plus the public detail cache. Cheaper than
			// hand-rolling a status patch in the cache and keeps the dashboard
			// honest if the backend recomputes anything else along the way.
			await invalidateSeries(queryClient, organizationSlug, seriesId);
			toast.success(m['recurringEvents.publishOccurrenceDialog.successToast']());
			onClose();
		},
		onError: (err: Error) => {
			errorBanner = err.message || m['recurringEvents.publishOccurrenceDialog.errorToast']();
			toast.error(errorBanner);
		}
	}));

	function extractErrorMessage(payload: Record<string, unknown>): string {
		if (typeof payload.detail === 'string') return payload.detail;
		if (payload.errors && typeof payload.errors === 'object' && !Array.isArray(payload.errors)) {
			const first = Object.values(payload.errors as Record<string, unknown>)[0];
			if (typeof first === 'string') return first;
			if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
		}
		return m['recurringEvents.publishOccurrenceDialog.errorToast']();
	}

	function handleConfirm(): void {
		errorBanner = null;
		publishMutation.mutate();
	}

	function handleClose(): void {
		if (publishMutation.isPending) return;
		onClose();
	}

	const selectedDisplay = $derived(event ? formatEventDate(event.start) : '');
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
	<DialogContent class="max-w-md" data-testid="publish-occurrence-dialog">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<Megaphone class="h-5 w-5" aria-hidden="true" />
				{m['recurringEvents.publishOccurrenceDialog.title']()}
			</DialogTitle>
		</DialogHeader>

		<div class="mt-4 space-y-4">
			<div class="space-y-1">
				<Label class="text-xs text-muted-foreground">
					{m['recurringEvents.publishOccurrenceDialog.selectedDateLabel']()}
				</Label>
				<p
					class="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm font-medium"
					data-testid="publish-occurrence-selected-date"
				>
					{selectedDisplay}
				</p>
			</div>

			<div
				class="flex items-start gap-3 rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm dark:border-green-700/50"
				data-testid="publish-occurrence-body"
			>
				<CheckCircle
					class="mt-0.5 h-4 w-4 flex-shrink-0 text-green-700 dark:text-green-400"
					aria-hidden="true"
				/>
				<p class="flex-1">
					{m['recurringEvents.publishOccurrenceDialog.body']()}
				</p>
			</div>

			{#if errorBanner}
				<div
					class="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
					role="alert"
					data-testid="publish-occurrence-error"
				>
					{errorBanner}
				</div>
			{/if}
		</div>

		<div
			class="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"
		>
			<Button
				type="button"
				variant="outline"
				onclick={handleClose}
				disabled={publishMutation.isPending}
				data-testid="publish-occurrence-keep"
			>
				{m['recurringEvents.publishOccurrenceDialog.keep']()}
			</Button>
			<Button
				type="button"
				onclick={handleConfirm}
				disabled={publishMutation.isPending || !event}
				data-testid="publish-occurrence-confirm"
			>
				{#if publishMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{m['recurringEvents.publishOccurrenceDialog.publishing']()}
				{:else}
					{m['recurringEvents.publishOccurrenceDialog.confirm']()}
				{/if}
			</Button>
		</div>
	</DialogContent>
</Dialog>
