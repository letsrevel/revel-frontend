<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { AlertTriangle, Check, Loader2, Trash2, X } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { organizationadminrecurringeventsCancelOccurrence } from '$lib/api/generated/sdk.gen';
	import type {
		EventInListSchema,
		EventSeriesRecurrenceDetailSchema
	} from '$lib/api/generated/types.gen';
	import { invalidateSeries } from '$lib/queries/event-series';
	import { formatEventDate } from '$lib/utils/date';

	type RowStatus = 'pending' | 'inFlight' | 'done' | 'error';

	interface Props {
		open: boolean;
		series: EventSeriesRecurrenceDetailSchema;
		organizationSlug: string;
		accessToken: string | null;
		/** Upcoming occurrences filtered to the drifted subset. The dashboard owns
		 *  the filtering (upcomingOccurrences ∩ staleIds) so the dialog stays
		 *  dumb about query state. */
		driftedOccurrences: EventInListSchema[];
		onClose: () => void;
	}

	/* eslint-disable prefer-const -- `open` is bindable so the whole destructure must use `let`. */
	let {
		open = $bindable(),
		series,
		organizationSlug,
		accessToken,
		driftedOccurrences,
		onClose
	}: Props = $props();
	/* eslint-enable prefer-const */

	const queryClient = useQueryClient();

	// Row-level status keyed by occurrence id. Deeply reactive via Svelte 5's
	// state proxy — individual row badges re-render on per-key updates without
	// us reassigning the whole record.
	let rowStatuses = $state<Record<string, RowStatus>>({});
	let armed = $state(false);
	let running = $state(false);
	let errorBanner = $state<string | null>(null);
	// Track whether we've already flushed the dashboard's queries after
	// in-flight progress, so a close-after-partial-success invalidation
	// doesn't duplicate the work from a full-success path.
	let hasInvalidated = $state(false);

	const total = $derived(driftedOccurrences.length);
	const doneCount = $derived(Object.values(rowStatuses).filter((s) => s === 'done').length);
	const failedCount = $derived(Object.values(rowStatuses).filter((s) => s === 'error').length);
	const remainingCount = $derived(Math.max(0, total - doneCount));
	const allDone = $derived(total > 0 && doneCount === total);
	const hasFailure = $derived(failedCount > 0 && !running);
	const canConfirm = $derived(armed && !running && !allDone && total > 0);
	// Plan §Phase 3 §6 safety threshold: above 25 stale dates, surface a
	// soft warning that the loop may take a while and partially fail. Not a
	// hard block — just extra friction for rare-but-risky cases.
	const safetyThreshold = 25;
	const exceedsSafetyThreshold = $derived(total > safetyThreshold);

	$effect(() => {
		if (!open) {
			hasInvalidated = false;
			return;
		}
		// Seed row statuses from the snapshot at open time. Concurrent changes
		// to the dashboard's drift list don't leak into an in-progress run —
		// the dialog operates on what was there when the user opened it.
		const seeded: Record<string, RowStatus> = {};
		for (const o of driftedOccurrences) seeded[o.id] = 'pending';
		rowStatuses = seeded;
		armed = false;
		running = false;
		errorBanner = null;
	});

	async function cancelOne(occurrence: EventInListSchema): Promise<void> {
		rowStatuses[occurrence.id] = 'inFlight';
		const response = await organizationadminrecurringeventsCancelOccurrence({
			path: { slug: organizationSlug, series_id: series.id },
			body: { occurrence_date: occurrence.start },
			headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
		});
		if (response.error) {
			const payload = response.error as Record<string, unknown>;
			throw new Error(extractErrorMessage(payload));
		}
		rowStatuses[occurrence.id] = 'done';
	}

	async function runLoop(): Promise<void> {
		if (!accessToken) {
			errorBanner = m['recurringEvents.drift.bulkDialog.errorToast']();
			return;
		}
		running = true;
		errorBanner = null;
		try {
			for (const occurrence of driftedOccurrences) {
				// Skip already-cancelled rows on a retry — the backend is
				// idempotent for exdates, but skipping avoids a wasted POST.
				if (rowStatuses[occurrence.id] === 'done') continue;
				try {
					await cancelOne(occurrence);
				} catch (err) {
					rowStatuses[occurrence.id] = 'error';
					errorBanner = err instanceof Error ? err.message : 'Unknown error';
					// Stop on first failure — deterministic partial-failure per
					// plan §Phase 3 §6. The user can retry; successful cancels
					// stay `done` so we don't double-refund.
					return;
				}
			}
			// Full success — fire the invalidation + success toast.
			await invalidateSeries(queryClient, organizationSlug, series.id);
			hasInvalidated = true;
			toast.success(m['recurringEvents.drift.bulkDialog.successToast']({ n: total }));
			onClose();
		} finally {
			running = false;
		}
	}

	function extractErrorMessage(payload: Record<string, unknown>): string {
		if (typeof payload.detail === 'string') return payload.detail;
		if (payload.errors && typeof payload.errors === 'object' && !Array.isArray(payload.errors)) {
			const first = Object.values(payload.errors as Record<string, unknown>)[0];
			if (typeof first === 'string') return first;
			if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
		}
		return 'Unknown error';
	}

	function handleConfirm(): void {
		runLoop();
	}

	async function handleClose(): Promise<void> {
		if (running) return;
		// If the user closes after a partial success, still refresh the
		// dashboard so it reflects the already-cancelled rows.
		if (doneCount > 0 && !hasInvalidated) {
			await invalidateSeries(queryClient, organizationSlug, series.id);
			hasInvalidated = true;
		}
		onClose();
	}

	function rowStatusLabel(status: RowStatus): string {
		switch (status) {
			case 'pending':
				return m['recurringEvents.drift.bulkDialog.rowStatus.pending']();
			case 'inFlight':
				return m['recurringEvents.drift.bulkDialog.rowStatus.inFlight']();
			case 'done':
				return m['recurringEvents.drift.bulkDialog.rowStatus.done']();
			case 'error':
				return m['recurringEvents.drift.bulkDialog.rowStatus.error']();
		}
	}
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
	<DialogContent class="max-h-[90vh] max-w-lg overflow-y-auto" data-testid="drift-bulk-dialog">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<Trash2 class="h-5 w-5 text-destructive" aria-hidden="true" />
				{m['recurringEvents.drift.bulkDialog.title']()}
			</DialogTitle>
		</DialogHeader>

		<div
			class="mt-4 flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm"
			data-testid="drift-bulk-explainer"
		>
			<AlertTriangle class="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" aria-hidden="true" />
			<p class="flex-1">
				{m['recurringEvents.drift.bulkDialog.explainer']()}
			</p>
		</div>

		{#if exceedsSafetyThreshold}
			<p
				class="border-warning/50 bg-warning/10 mt-3 rounded-md border p-3 text-xs text-muted-foreground"
				data-testid="drift-bulk-threshold"
			>
				{m['recurringEvents.drift.bulkDialog.thresholdWarning']({ n: total })}
			</p>
		{/if}

		<ul class="mt-4 divide-y divide-border rounded-md border border-border" role="list">
			{#each driftedOccurrences as occurrence (occurrence.id)}
				{@const status = rowStatuses[occurrence.id] ?? 'pending'}
				<li
					class="flex items-center justify-between gap-3 px-3 py-2 text-sm"
					data-testid="drift-bulk-row"
					data-row-status={status}
					data-occurrence-id={occurrence.id}
				>
					<div class="min-w-0 flex-1">
						<p class="truncate font-medium">{formatEventDate(occurrence.start)}</p>
						<p class="text-xs uppercase tracking-wide text-muted-foreground">
							{occurrence.status}
						</p>
					</div>
					<span
						class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {status ===
						'done'
							? 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200'
							: status === 'error'
								? 'bg-destructive/10 text-destructive'
								: status === 'inFlight'
									? 'bg-primary/10 text-primary'
									: 'bg-muted text-muted-foreground'}"
					>
						{#if status === 'inFlight'}
							<Loader2 class="h-3 w-3 animate-spin" aria-hidden="true" />
						{:else if status === 'done'}
							<Check class="h-3 w-3" aria-hidden="true" />
						{:else if status === 'error'}
							<X class="h-3 w-3" aria-hidden="true" />
						{/if}
						{rowStatusLabel(status)}
					</span>
				</li>
			{/each}
		</ul>

		<label
			class="mt-4 flex cursor-pointer items-start gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
		>
			<input
				type="checkbox"
				bind:checked={armed}
				disabled={running || allDone}
				class="mt-1 h-4 w-4 rounded border-gray-300 text-destructive focus:ring-2 focus:ring-destructive"
				data-testid="drift-bulk-arm"
			/>
			<div class="flex-1 text-sm">
				{m['recurringEvents.drift.bulkDialog.armCheckbox']()}
			</div>
		</label>

		{#if hasFailure}
			<div
				class="mt-4 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
				role="alert"
				data-testid="drift-bulk-partial"
			>
				{m['recurringEvents.drift.bulkDialog.partialFailure']({
					done: doneCount,
					total,
					remaining: failedCount
				})}
				{#if errorBanner}
					<p class="mt-1 text-xs opacity-80">{errorBanner}</p>
				{/if}
			</div>
		{/if}

		<div
			class="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"
		>
			<Button
				type="button"
				variant="outline"
				onclick={handleClose}
				disabled={running}
				data-testid="drift-bulk-cancel"
			>
				{m['recurringEvents.drift.bulkDialog.cancel']()}
			</Button>
			<Button
				type="button"
				variant="destructive"
				onclick={handleConfirm}
				disabled={!canConfirm}
				data-testid="drift-bulk-confirm"
			>
				{#if running}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{m['recurringEvents.drift.bulkDialog.rowStatus.inFlight']()}
				{:else}
					{m['recurringEvents.drift.bulkDialog.confirm']({ n: remainingCount })}
				{/if}
			</Button>
		</div>
	</DialogContent>
</Dialog>
