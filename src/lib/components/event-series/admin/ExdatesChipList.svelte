<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Plus } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { formatEventDate } from '$lib/utils/date';
	import { parseExdates } from '$lib/utils/recurrence';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		exdates: ReadonlyArray<string>;
		organizationSlug: string;
		seriesId: string;
		/** Whether the organiser can create events (hides the chip action when false). */
		canEdit?: boolean;
	}

	const { exdates, organizationSlug, seriesId, canEdit = false }: Props = $props();

	// Keep the original ISO alongside the parsed Date so the "Create one-off"
	// action can pass the exact server-side instant through query params — the
	// new-event form will prefill from it once wired (see Phase 4 follow-up).
	const parsed = $derived(
		exdates
			.map((iso) => ({ iso, date: firstValidDate(iso) }))
			.filter((entry): entry is { iso: string; date: Date } => entry.date !== null)
	);

	function firstValidDate(iso: string): Date | null {
		const [d] = parseExdates([iso]);
		return d ?? null;
	}

	function createOneOff(iso: string): void {
		const params = new URLSearchParams({
			start: iso,
			event_series_id: seriesId
		});
		goto(`/org/${organizationSlug}/admin/events/new?${params.toString()}`);
	}
</script>

<section aria-labelledby="exdates-heading" data-testid="exdates-list">
	<h2 id="exdates-heading" class="text-sm font-semibold text-foreground">
		{m['recurringEvents.dashboard.exdatesHeading']()}
	</h2>

	{#if parsed.length === 0}
		<p class="mt-2 text-sm text-muted-foreground">{m['recurringEvents.exdates.empty']()}</p>
	{:else}
		<ul class="mt-2 flex flex-wrap gap-2">
			{#each parsed as entry (entry.iso)}
				<li
					class="inline-flex items-center gap-2 rounded-full border border-border bg-muted py-1 pl-3 pr-1 text-xs text-muted-foreground"
				>
					<span>{formatEventDate(entry.iso)}</span>
					{#if canEdit}
						<Button
							type="button"
							variant="ghost"
							size="sm"
							class="h-6 rounded-full px-2 text-xs"
							onclick={() => createOneOff(entry.iso)}
							aria-label={m['recurringEvents.exdates.createOneOffAction']()}
						>
							<Plus class="h-3 w-3" aria-hidden="true" />
							<span class="sr-only">{m['recurringEvents.exdates.createOneOffAction']()}</span>
						</Button>
					{/if}
				</li>
			{/each}
		</ul>
		{#if canEdit}
			<p class="mt-2 text-xs text-muted-foreground">
				{m['recurringEvents.exdates.semanticHelper']()}
			</p>
		{/if}
	{/if}
</section>
