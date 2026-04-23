<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { CalendarX } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import AdminEventCard from '$lib/components/events/admin/AdminEventCard.svelte';
	import type { EventInListSchema, EventStatus } from '$lib/api/generated/types.gen';

	type CardVariant = 'draft' | 'open' | 'closed' | 'cancelled';

	interface Props {
		event: EventInListSchema;
		organizationSlug: string;
		/** IDs of off-schedule occurrences (server-computed). */
		driftedIds?: ReadonlySet<string>;
		/** Whether mutating actions are allowed for the current user. */
		canEdit?: boolean;
		/** Fires with the occurrence's start datetime — the cancel-occurrence
		 *  endpoint takes `{ occurrence_date }` and also appends to exdates,
		 *  which is why this is distinct from AdminEventCard's `onCancel`
		 *  (which only flips status). */
		onCancelOccurrence?: (event: EventInListSchema) => void;
		// Pass-through handlers on the inner AdminEventCard. Delete is deliberately
		// omitted — deleting a scheduled occurrence orphans the series index;
		// organisers should cancel the date instead.
		onPublish?: (eventId: string) => void;
		onClose?: (eventId: string) => void;
		onReopen?: (eventId: string) => void;
		onDuplicate?: (event: EventInListSchema) => void;
	}

	const {
		event,
		organizationSlug,
		driftedIds,
		canEdit = false,
		onCancelOccurrence,
		onPublish,
		onClose,
		onReopen,
		onDuplicate
	}: Props = $props();

	const variant = $derived<CardVariant>(statusToVariant(event.status));
	const isModified = $derived(event.is_modified === true);
	const isDrifted = $derived(driftedIds?.has(event.id) ?? false);
	const isCancellable = $derived(variant === 'draft' || variant === 'open');

	// Server guarantees these two states are mutually exclusive (drift query
	// excludes is_modified rows). We re-assert it in the UI so a rare
	// inconsistency never paints an ambiguous card.
	const showModifiedBadge = $derived(isModified && !isDrifted);

	// occurrence_index is 0-based; display as 1-based.
	const displayIndex = $derived(
		typeof event.occurrence_index === 'number' ? event.occurrence_index + 1 : null
	);

	function statusToVariant(status: EventStatus): CardVariant {
		switch (status) {
			case 'draft':
				return 'draft';
			case 'open':
				return 'open';
			case 'closed':
				return 'closed';
			case 'cancelled':
				return 'cancelled';
		}
	}

	function handleCancelOccurrence(): void {
		onCancelOccurrence?.(event);
	}
</script>

<article
	class="rounded-lg border border-l-4 bg-card shadow-sm {isDrifted
		? 'border-l-destructive'
		: showModifiedBadge
			? 'border-l-amber-500'
			: 'border-l-transparent'}"
	data-testid="occurrence-row"
	data-drifted={isDrifted || undefined}
	data-modified={showModifiedBadge || undefined}
>
	<!-- Recurring-specific badges strip. Rendered even when empty for layout
	     stability, but its contents are driven entirely by server state. -->
	{#if isDrifted || showModifiedBadge || displayIndex !== null}
		<div class="flex flex-wrap items-center gap-2 px-4 pt-4">
			{#if isDrifted}
				<span
					class="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
				>
					{m['recurringEvents.row.driftedBadge']()}
				</span>
			{:else if showModifiedBadge}
				<span
					class="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
				>
					{m['recurringEvents.row.modifiedBadge']()}
				</span>
			{/if}
			{#if displayIndex !== null}
				<span
					class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
				>
					{m['recurringEvents.row.weekIndex']({ n: displayIndex })}
				</span>
			{/if}
		</div>
	{/if}

	<div class="p-4 pt-2">
		<AdminEventCard
			{event}
			{organizationSlug}
			{variant}
			{onPublish}
			{onClose}
			{onReopen}
			{onDuplicate}
		/>
	</div>

	{#if canEdit && isCancellable}
		<div class="flex justify-end border-t border-border px-4 py-2">
			<Button
				variant="ghost"
				size="sm"
				onclick={handleCancelOccurrence}
				data-testid="row-cancel-occurrence"
			>
				<CalendarX class="h-4 w-4" aria-hidden="true" />
				{m['recurringEvents.row.cancelAction']()}
			</Button>
		</div>
	{/if}
</article>
