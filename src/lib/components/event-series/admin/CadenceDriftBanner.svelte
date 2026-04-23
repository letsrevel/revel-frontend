<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { AlertTriangle, Trash2 } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		/** Count of off-schedule occurrences (`stale_occurrences.length`). When 0,
		 *  the banner renders nothing — the caller does not need to gate it. */
		count: number;
		/** Anchor selector for the "Review stale dates" link. Defaults to the
		 *  upcoming-occurrences section id used by `+page.svelte`. */
		reviewAnchor?: string;
		/** Whether the organiser can mutate this series. Hides the bulk-cancel
		 *  trigger when false. */
		canEdit?: boolean;
		/** Phase 3 hook: opens `CancelDriftedOccurrencesDialog`. No-op stub while
		 *  that dialog isn't built yet. */
		onBulkCancel?: () => void;
	}

	const {
		count,
		reviewAnchor = '#upcoming-occurrences',
		canEdit = false,
		onBulkCancel
	}: Props = $props();

	const title = $derived(
		count === 1
			? m['recurringEvents.drift.banner.title.one']()
			: m['recurringEvents.drift.banner.title.other']({ n: count })
	);
</script>

{#if count > 0}
	<div
		class="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm"
		role="alert"
		data-testid="drift-banner"
	>
		<AlertTriangle class="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" aria-hidden="true" />
		<div class="flex-1 space-y-2">
			<p class="font-medium">{title}</p>
			<p class="text-muted-foreground">{m['recurringEvents.drift.banner.body']()}</p>
			<div class="flex flex-wrap gap-2 pt-1">
				<a
					href={reviewAnchor}
					class="inline-flex items-center rounded-md px-2 py-1 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{m['recurringEvents.drift.banner.reviewAnchor']()}
				</a>
				{#if canEdit && onBulkCancel}
					<Button
						variant="destructive"
						size="sm"
						onclick={onBulkCancel}
						data-testid="drift-bulk-cancel"
					>
						<Trash2 class="h-4 w-4" aria-hidden="true" />
						{m['recurringEvents.drift.banner.bulkCancelCta']({ n: count })}
					</Button>
				{/if}
			</div>
		</div>
	</div>
{/if}
