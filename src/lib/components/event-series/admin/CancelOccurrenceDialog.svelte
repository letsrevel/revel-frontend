<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { AlertTriangle, CalendarX, Loader2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { organizationadminrecurringeventsCancelOccurrence } from '$lib/api/generated/sdk.gen';
	import type {
		EventInListSchema,
		EventSeriesRecurrenceDetailSchema
	} from '$lib/api/generated/types.gen';
	import { invalidateSeries } from '$lib/queries/event-series';
	import { formatEventDate } from '$lib/utils/date';

	interface Props {
		open: boolean;
		series: EventSeriesRecurrenceDetailSchema;
		organizationSlug: string;
		accessToken: string | null;
		/** Upcoming occurrences (non-template). The dialog itself filters this down
		 *  to the cancellable subset (`open` / `draft`) — the backend rejects
		 *  cancels on already-cancelled rows, and closed/past rows don't belong
		 *  in the picker for this flow. */
		occurrences?: EventInListSchema[];
		/** When set, the dialog opens in "row" mode with the date pinned and the
		 *  picker hidden. When null/undefined, the dialog opens in "header" mode
		 *  and renders a `<select>` populated from `occurrences` — the backend
		 *  requires an exact match against a scheduled start, so a free-form
		 *  datetime input is a 422-trap. */
		initialDate?: string | null;
		onClose: () => void;
	}

	/* eslint-disable prefer-const -- `open` is bindable so the whole destructure must use `let`. */
	let {
		open = $bindable(),
		series,
		organizationSlug,
		accessToken,
		occurrences = [],
		initialDate = null,
		onClose
	}: Props = $props();
	/* eslint-enable prefer-const */

	const queryClient = useQueryClient();

	// Authoritative date to POST. Seeded from `initialDate` (row entry) on open,
	// or left empty in header mode until the user picks one from the select.
	// Neutral default + open-effect seed avoids the
	// `state_referenced_locally` static-analysis warning.
	let selectedDate = $state<string>('');
	let errorBanner = $state<string | null>(null);

	// Mode is stable for the lifetime of an open dialog — set at open time.
	// In row mode we render a read-only label; in header mode we render the
	// picker. Callers toggle the mode by swapping `initialDate` before setting
	// `open=true` (handled by the dashboard's `cancelOccurrenceInitialDate` rune).
	const isRowMode = $derived(typeof initialDate === 'string' && initialDate.length > 0);

	// Match the row-action filter in `OccurrenceRow`: only `draft` and `open`
	// events are cancellable from this surface. The backend still enforces the
	// contract, but filtering here prevents 4xxs on paths the UI shouldn't offer.
	const cancellableOccurrences = $derived(
		occurrences.filter((o) => o.status === 'draft' || o.status === 'open')
	);

	const canConfirm = $derived(selectedDate.length > 0);

	// Re-seed every time the dialog opens. Diffing against `initialDate` at open
	// time (rather than binding state directly to it) lets the dashboard reopen
	// the same dialog for a different source without stale state leaking across.
	$effect(() => {
		if (!open) return;
		selectedDate = initialDate ?? '';
		errorBanner = null;
	});

	const cancelMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error('Not authenticated');
			if (!selectedDate) throw new Error('No occurrence date selected');
			const response = await organizationadminrecurringeventsCancelOccurrence({
				path: { slug: organizationSlug, series_id: series.id },
				body: { occurrence_date: selectedDate },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				const payload = response.error as Record<string, unknown>;
				throw new Error(extractErrorMessage(payload));
			}
			return response.data;
		},
		onSuccess: async () => {
			// Invalidate the full series surface — `invalidateSeries` covers detail,
			// drift, and occurrences lists. Backend adds the date to `exdates` and
			// (if already materialised) flips status=CANCELLED, both of which the
			// dashboard reflects via its existing reactive queries.
			await invalidateSeries(queryClient, organizationSlug, series.id);
			toast.success(m['recurringEvents.cancelOccurrenceDialog.successToast']());
			onClose();
		},
		onError: (err: Error) => {
			errorBanner = err.message || m['recurringEvents.cancelOccurrenceDialog.errorToast']();
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
		return m['recurringEvents.cancelOccurrenceDialog.errorToast']();
	}

	function handleConfirm(): void {
		errorBanner = null;
		if (!canConfirm) return;
		cancelMutation.mutate();
	}

	function handleClose(): void {
		if (cancelMutation.isPending) return;
		onClose();
	}

	const selectedDisplay = $derived(selectedDate ? formatEventDate(selectedDate) : '');
	const pickerEmpty = $derived(!isRowMode && cancellableOccurrences.length === 0);
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
	<DialogContent class="max-w-md" data-testid="cancel-occurrence-dialog">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<CalendarX class="h-5 w-5" aria-hidden="true" />
				{m['recurringEvents.cancelOccurrenceDialog.title']()}
			</DialogTitle>
		</DialogHeader>

		<div class="mt-4 space-y-4">
			{#if isRowMode}
				<div class="space-y-1">
					<Label class="text-xs text-muted-foreground">
						{m['recurringEvents.cancelOccurrenceDialog.selectedDateLabel']()}
					</Label>
					<p
						class="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm font-medium"
						data-testid="cancel-occurrence-selected-date"
					>
						{selectedDisplay}
					</p>
				</div>
			{:else}
				<div class="space-y-2">
					<Label for="cancel-occurrence-picker">
						{m['recurringEvents.cancelOccurrenceDialog.picker.label']()}
					</Label>
					{#if pickerEmpty}
						<p
							class="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground"
							data-testid="cancel-occurrence-picker-empty"
						>
							{m['recurringEvents.cancelOccurrenceDialog.picker.empty']()}
						</p>
					{:else}
						<select
							id="cancel-occurrence-picker"
							bind:value={selectedDate}
							disabled={cancelMutation.isPending}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							data-testid="cancel-occurrence-picker"
						>
							<option value="" disabled>
								{m['recurringEvents.cancelOccurrenceDialog.picker.placeholder']()}
							</option>
							{#each cancellableOccurrences as occurrence (occurrence.id)}
								<option value={occurrence.start}>
									{formatEventDate(occurrence.start)}
								</option>
							{/each}
						</select>
					{/if}
				</div>
			{/if}

			<div
				class="border-warning/50 bg-warning/10 flex items-start gap-3 rounded-md border p-3 text-sm"
				data-testid="cancel-occurrence-body"
			>
				<AlertTriangle
					class="text-warning-foreground mt-0.5 h-4 w-4 flex-shrink-0"
					aria-hidden="true"
				/>
				<p class="flex-1">
					{m['recurringEvents.cancelOccurrenceDialog.body']()}
				</p>
			</div>

			{#if errorBanner}
				<div
					class="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
					role="alert"
					data-testid="cancel-occurrence-error"
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
				disabled={cancelMutation.isPending}
				data-testid="cancel-occurrence-keep"
			>
				{m['recurringEvents.cancelOccurrenceDialog.keep']()}
			</Button>
			<Button
				type="button"
				variant="destructive"
				onclick={handleConfirm}
				disabled={!canConfirm || cancelMutation.isPending}
				data-testid="cancel-occurrence-confirm"
			>
				{#if cancelMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{m['recurringEvents.cancelOccurrenceDialog.cancelling']()}
				{:else}
					{m['recurringEvents.cancelOccurrenceDialog.confirm']()}
				{/if}
			</Button>
		</div>
	</DialogContent>
</Dialog>
