<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventInListSchema, TicketTierDetailSchema } from '$lib/api/generated/types.gen';
	import { eventadminticketsListTicketTiers } from '$lib/api';
	import { createQuery } from '@tanstack/svelte-query';
	import { Label } from '$lib/components/ui/label';
	import { formatPrice } from '$lib/utils/format';
	import { formatEventDate } from '$lib/utils/date';
	import { Loader2 } from '@lucide/svelte';

	interface Props {
		/** Candidate events (upcoming, non-template occurrences of the series). */
		events: EventInListSchema[];
		accessToken: string | null;
		/** Pass currency — tiers in another currency can't back the pass. */
		currency: string;
		/** eventId -> selected tierId; absent/undefined = event not covered. */
		selections: Record<string, string | undefined>;
		onSelectionsChange: (selections: Record<string, string | undefined>) => void;
		disabled?: boolean;
	}

	const { events, accessToken, currency, selections, onSelectionsChange, disabled }: Props =
		$props();

	const eventIds = $derived(events.map((e) => e.id));

	// One query fans out to per-event tier lists; the key pins the event set.
	const tiersQuery = createQuery(() => ({
		queryKey: ['series-passes', 'admin', 'event-tiers', eventIds] as const,
		queryFn: async () => {
			const entries = await Promise.all(
				events.map(async (event) => {
					const response = await eventadminticketsListTicketTiers({
						path: { event_id: event.id },
						query: { page_size: 100 },
						headers: { Authorization: `Bearer ${accessToken}` }
					});
					return [event.id, response.data?.results ?? []] as const;
				})
			);
			return Object.fromEntries(entries) as Record<string, TicketTierDetailSchema[]>;
		},
		enabled: !!accessToken && events.length > 0
	}));

	const tiersByEvent = $derived(tiersQuery.data ?? {});

	/** Tiers that can back a pass: right currency, no assigned seating, not PWYC. */
	function eligibleTiers(eventId: string): TicketTierDetailSchema[] {
		return (tiersByEvent[eventId] ?? []).filter(
			(tier) =>
				tier.currency?.toUpperCase() === currency.toUpperCase() &&
				(!tier.seat_assignment_mode || tier.seat_assignment_mode === 'none') &&
				tier.price_type !== 'pwyc'
		);
	}

	// Default selection: once tiers load, pre-select the first eligible tier for
	// every event that has one and no explicit choice yet.
	$effect(() => {
		if (!tiersQuery.data) return;
		const next = { ...selections };
		let changed = false;
		for (const event of events) {
			if (next[event.id] !== undefined) continue;
			const tiers = eligibleTiers(event.id);
			if (tiers.length > 0 && tiers[0].id) {
				next[event.id] = tiers[0].id;
				changed = true;
			}
		}
		if (changed) onSelectionsChange(next);
	});

	function toggleEvent(eventId: string, include: boolean) {
		const next = { ...selections };
		if (include) {
			const tiers = eligibleTiers(eventId);
			next[eventId] = tiers[0]?.id ?? undefined;
		} else {
			next[eventId] = undefined;
		}
		onSelectionsChange(next);
	}

	function selectTier(eventId: string, tierId: string) {
		onSelectionsChange({ ...selections, [eventId]: tierId });
	}

	const coveredCount = $derived(Object.values(selections).filter(Boolean).length);
</script>

<fieldset class="space-y-3" {disabled}>
	<legend class="text-sm font-medium">
		{m['seriesPassAdmin.coverageLegend']()}
		<span class="ml-1 text-muted-foreground">({coveredCount})</span>
	</legend>
	<p class="text-xs text-muted-foreground">{m['seriesPassAdmin.coverageHint']()}</p>

	{#if tiersQuery.isLoading}
		<div class="flex items-center gap-2 py-4 text-sm text-muted-foreground" role="status">
			<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
			{m['seriesPassAdmin.loadingTiers']()}
		</div>
	{:else if events.length === 0}
		<p class="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
			{m['seriesPassAdmin.noUpcomingEvents']()}
		</p>
	{:else}
		<ul class="space-y-2">
			{#each events as event (event.id)}
				{@const tiers = eligibleTiers(event.id)}
				{@const included = !!selections[event.id]}
				<li class="rounded-md border p-3">
					<div class="flex flex-wrap items-center gap-3">
						<label class="flex min-w-0 flex-1 items-center gap-2">
							<input
								type="checkbox"
								checked={included}
								disabled={tiers.length === 0 || disabled}
								onchange={(e) => toggleEvent(event.id, e.currentTarget.checked)}
								class="h-4 w-4 rounded border-input"
							/>
							<span class="min-w-0">
								<span class="block truncate text-sm font-medium">{event.name}</span>
								{#if event.start}
									<span class="block text-xs text-muted-foreground">
										{formatEventDate(event.start)}
									</span>
								{/if}
							</span>
						</label>

						{#if tiers.length === 0}
							<span class="text-xs text-muted-foreground">
								{m['seriesPassAdmin.noEligibleTiers']()}
							</span>
						{:else if included}
							<div class="w-full sm:w-56">
								<Label class="sr-only" for="tier-select-{event.id}">
									{m['seriesPassAdmin.tierSelectLabel']({ eventName: event.name })}
								</Label>
								<select
									id="tier-select-{event.id}"
									value={selections[event.id]}
									onchange={(e) => selectTier(event.id, e.currentTarget.value)}
									{disabled}
									class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
								>
									{#each tiers as tier (tier.id)}
										<option value={tier.id}>
											{tier.name}
											({formatPrice(tier.price, tier.currency, m['seriesPass.free']())})
										</option>
									{/each}
								</select>
							</div>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</fieldset>
