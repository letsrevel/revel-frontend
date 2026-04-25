<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { CalendarX, Edit, Eye, MoreVertical, Copy, CheckCircle, XCircle } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { formatEventDate } from '$lib/utils/date';
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
		// Pass-through handlers — same shape AdminEventCard offered, kept so
		// the more-actions dropdown can route publish/close/reopen/duplicate
		// without forcing the dashboard to mount a separate card. Delete is
		// deliberately omitted: deleting a scheduled occurrence orphans the
		// series index; organisers should cancel the date instead.
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

	const statusLabel = $derived.by(() => {
		switch (variant) {
			case 'draft':
				return m['orgAdmin.events.status.draft']();
			case 'open':
				return m['orgAdmin.events.status.published']();
			case 'closed':
				return m['orgAdmin.events.status.closed']();
			case 'cancelled':
				return m['orgAdmin.events.status.cancelled']();
		}
	});

	const statusChipClass = $derived.by(() => {
		switch (variant) {
			case 'draft':
				return 'bg-muted text-muted-foreground';
			case 'open':
				return 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200';
			case 'closed':
				return 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200';
			case 'cancelled':
				return 'bg-destructive/10 text-destructive';
		}
	});

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

	function viewEvent(): void {
		goto(`/events/${organizationSlug}/${event.slug}`);
	}

	function editEvent(): void {
		goto(`/org/${organizationSlug}/admin/events/${event.id}/edit`);
	}

	function handleCancelOccurrence(): void {
		onCancelOccurrence?.(event);
	}
</script>

<div
	class="flex flex-col gap-3 rounded-lg border border-l-4 border-border bg-card p-3 shadow-sm transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:gap-4 {isDrifted
		? 'border-l-destructive'
		: showModifiedBadge
			? 'border-l-amber-500'
			: 'border-l-transparent'} {variant === 'cancelled' || variant === 'closed'
		? 'opacity-70'
		: ''}"
	data-testid="occurrence-row"
	data-drifted={isDrifted || undefined}
	data-modified={showModifiedBadge || undefined}
	data-occurrence-id={event.id}
>
	<!-- Date column. Bold time-aware label; on mobile this owns the first row. -->
	<div class="flex min-w-0 flex-col gap-0.5 sm:w-56 sm:flex-shrink-0">
		<span class="text-sm font-medium tabular-nums">{formatEventDate(event.start)}</span>
		{#if displayIndex !== null}
			<span class="text-xs text-muted-foreground">
				{m['recurringEvents.row.weekIndex']({ n: displayIndex })}
			</span>
		{/if}
	</div>

	<!-- Name + badges column. Truncates so a long event name doesn't push the
	     action cluster off-screen on intermediate viewports. -->
	<div class="flex min-w-0 flex-1 flex-col gap-1.5">
		<div class="flex flex-wrap items-center gap-2">
			<h3 class="truncate text-sm font-semibold">{event.name}</h3>
			<span
				class="inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide {statusChipClass}"
			>
				{statusLabel}
			</span>
		</div>
		{#if isDrifted || showModifiedBadge || event.attendee_count > 0}
			<div class="flex flex-wrap items-center gap-2 text-xs">
				{#if isDrifted}
					<span
						class="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive"
					>
						{m['recurringEvents.row.driftedBadge']()}
					</span>
				{:else if showModifiedBadge}
					<span
						class="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
					>
						{m['recurringEvents.row.modifiedBadge']()}
					</span>
				{/if}
				{#if event.attendee_count > 0}
					<span class="text-muted-foreground">
						{event.attendee_count}
						{event.requires_ticket
							? m['orgAdmin.events.attendeeCount.attendees']()
							: m['orgAdmin.events.attendeeCount.rsvps']()}
					</span>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Action cluster. Sticks to the right on desktop, wraps to a left-aligned
	     row on mobile. Icon buttons keep the row slim while preserving every
	     management entry point AdminEventCard offered. -->
	<div class="flex flex-shrink-0 flex-wrap items-center gap-1 sm:gap-1.5">
		<Button
			variant="ghost"
			size="sm"
			onclick={viewEvent}
			class="h-8 px-2"
			aria-label={m['orgAdmin.events.actions.view']()}
		>
			<Eye class="h-4 w-4" aria-hidden="true" />
		</Button>
		{#if canEdit && (variant === 'draft' || variant === 'open')}
			<Button
				variant="ghost"
				size="sm"
				onclick={editEvent}
				class="h-8 px-2"
				aria-label={m['orgAdmin.events.actions.edit']()}
			>
				<Edit class="h-4 w-4" aria-hidden="true" />
			</Button>
		{/if}
		{#if canEdit && isCancellable && onCancelOccurrence}
			<Button
				variant="ghost"
				size="sm"
				onclick={handleCancelOccurrence}
				class="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
				aria-label={m['recurringEvents.row.cancelAction']()}
				data-testid="row-cancel-occurrence"
			>
				<CalendarX class="h-4 w-4" aria-hidden="true" />
			</Button>
		{/if}
		{#if canEdit && (onPublish || onClose || onReopen || onDuplicate)}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							type="button"
							class="inline-flex h-8 items-center justify-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-label={m['orgAdmin.events.actions.moreActions']()}
						>
							<MoreVertical class="h-4 w-4" aria-hidden="true" />
						</button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-44">
					{#if variant === 'draft' && onPublish}
						<DropdownMenu.Item onclick={() => onPublish(event.id)}>
							<CheckCircle class="mr-2 h-4 w-4" aria-hidden="true" />
							{m['orgAdmin.events.actions.publish']()}
						</DropdownMenu.Item>
					{/if}
					{#if variant === 'open' && onClose}
						<DropdownMenu.Item
							onclick={() => onClose(event.id)}
							class="text-amber-700 focus:text-amber-700 dark:text-amber-400 dark:focus:text-amber-400"
						>
							<XCircle class="mr-2 h-4 w-4" aria-hidden="true" />
							{m['orgAdmin.events.actions.close']()}
						</DropdownMenu.Item>
					{/if}
					{#if (variant === 'closed' || variant === 'cancelled') && onReopen}
						<DropdownMenu.Item onclick={() => onReopen(event.id)}>
							<CheckCircle class="mr-2 h-4 w-4" aria-hidden="true" />
							{m['orgAdmin.events.actions.reopen']()}
						</DropdownMenu.Item>
					{/if}
					{#if onDuplicate}
						<DropdownMenu.Item onclick={() => onDuplicate(event)}>
							<Copy class="mr-2 h-4 w-4" aria-hidden="true" />
							{m['orgAdmin.events.actions.duplicate']()}
						</DropdownMenu.Item>
					{/if}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}
	</div>
</div>
