<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventInListSchema, TicketTierDetailSchema } from '$lib/api/generated/types.gen';
	import { eventadminticketsListTicketTiers } from '$lib/api';
	import { createQuery } from '@tanstack/svelte-query';
	import { Label } from '$lib/components/ui/label';
	import { formatPrice } from '$lib/utils/format';
	import { formatEventDate } from '$lib/utils/date';
	import { Loader2 } from '@lucide/svelte';
	import { tierStricterThanPass } from './pass-purchase-rules';

	interface Props {
		/** Candidate events (upcoming, non-template occurrences of the series). */
		events: EventInListSchema[];
		accessToken: string | null;
		/** Pass currency — tiers in another currency can't back the pass. */
		currency: string;
		/**
		 * The pass's `purchasable_by`. A tier whose purchase rule is stricter than the
		 * pass's can't back it (the backend answers 400), so those tiers are offered
		 * disabled, never defaulted, and the reason is spelled out.
		 */
		passPurchasableBy: string;
		/** Server message about the tier link (the 400 for a stricter tier), shown beside the control. */
		error?: string;
		/**
		 * eventId -> selection. A tier id means "covered with this tier"; `null`
		 * means the organizer explicitly excluded the event; `undefined` (absent)
		 * means "no choice yet" and is eligible for defaulting.
		 */
		selections: Record<string, string | null | undefined>;
		onSelectionsChange: (selections: Record<string, string | null | undefined>) => void;
		disabled?: boolean;
	}

	const {
		events,
		accessToken,
		currency,
		passPurchasableBy,
		error = '',
		selections,
		onSelectionsChange,
		disabled
	}: Props = $props();

	const uid = $props.id();

	// Sorted so the cache key is stable across event-list reorderings.
	const eventIds = $derived(events.map((e) => e.id).toSorted());

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
	const eligibleByEvent = $derived.by(() => {
		const out: Record<string, TicketTierDetailSchema[]> = {};
		for (const event of events) {
			out[event.id] = (tiersByEvent[event.id] ?? []).filter(
				(tier) =>
					tier.currency?.toUpperCase() === currency.toUpperCase() &&
					(!tier.seat_assignment_mode || tier.seat_assignment_mode === 'none') &&
					tier.price_type !== 'pwyc'
			);
		}
		return out;
	});

	function eligibleTiers(eventId: string): TicketTierDetailSchema[] {
		return eligibleByEvent[eventId] ?? [];
	}

	function isStricter(tier: TicketTierDetailSchema): boolean {
		return tierStricterThanPass(tier, passPurchasableBy);
	}

	/** Tiers the pass can actually cover: eligible AND not stricter than the pass. */
	function selectableTiers(eventId: string): TicketTierDetailSchema[] {
		return eligibleTiers(eventId).filter((tier) => !isStricter(tier));
	}

	function selectableTier(eventId: string, tierId: string): boolean {
		return selectableTiers(eventId).some((tier) => tier.id === tierId);
	}

	// Default selection: once per (tier data, currency, pass rule), pre-select the
	// first COMPATIBLE tier for every event with no explicit choice yet — never one
	// that is stricter than the pass. A pick that became incompatible (the pass rule
	// changed) is dropped back to "no choice" so it re-defaults to a compatible tier,
	// or stays unset (not excluded) when there is none. `defaultedKey` makes this a
	// one-shot per input set — without it the effect re-runs on its own
	// onSelectionsChange echo and instantly reverts explicit unchecks.
	let defaultedKey = $state('');
	$effect(() => {
		if (!tiersQuery.data) return;
		const key = `${currency}|${passPurchasableBy}|${eventIds.join(',')}`;
		if (defaultedKey === key) return;
		defaultedKey = key;
		const next = { ...selections };
		let changed = false;
		for (const event of events) {
			const current = next[event.id];
			// string = user/default pick, null = explicit exclusion — both final,
			// unless the pick is no longer compatible with the pass.
			if (typeof current === 'string' && !selectableTier(event.id, current)) {
				// No compatible tier: drop the pick (undefined), NOT null — null means
				// "organizer excluded this event" and would never re-default when the
				// pass rule is switched back.
				next[event.id] = selectableTiers(event.id)[0]?.id;
				changed = true;
				continue;
			}
			if (current !== undefined) continue;
			const tiers = selectableTiers(event.id);
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
			next[eventId] = selectableTiers(eventId)[0]?.id ?? null;
		} else {
			// `null`, not delete/undefined: an explicit exclusion must survive the
			// defaulting pass above.
			next[eventId] = null;
		}
		onSelectionsChange(next);
	}

	function selectTier(eventId: string, tierId: string) {
		onSelectionsChange({ ...selections, [eventId]: tierId });
	}

	const coveredCount = $derived(
		Object.values(selections).filter((v) => typeof v === 'string').length
	);
</script>

<fieldset
	class="space-y-3"
	{disabled}
	aria-describedby={error ? `${uid}-error` : undefined}
	data-testid="pass-tier-mapping"
>
	<legend class="text-sm font-medium">
		{m['seriesPassAdmin.coverageLegend']()}
		<span class="ml-1 text-muted-foreground">({coveredCount})</span>
	</legend>
	<p class="text-xs text-muted-foreground">{m['seriesPassAdmin.coverageHint']()}</p>
	{#if error}
		<p id="{uid}-error" class="text-sm text-destructive" role="alert" data-testid="pass-tier-error">
			{error}
		</p>
	{/if}

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
				{@const selectable = selectableTiers(event.id)}
				{@const included = !!selections[event.id]}
				<li class="rounded-md border p-3">
					<div class="flex flex-wrap items-center gap-3">
						<label class="flex min-w-0 flex-1 items-center gap-2">
							<input
								type="checkbox"
								checked={included}
								disabled={selectable.length === 0 || disabled}
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
						{:else if selectable.length === 0}
							<p class="w-full text-xs text-muted-foreground" data-testid="pass-no-compatible-tier">
								{m['seriesPassAdmin.noCompatibleTiers']()}
							</p>
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
										{@const price = formatPrice(tier.price, tier.currency, m['seriesPass.free']())}
										<option value={tier.id} disabled={isStricter(tier)}>
											{isStricter(tier)
												? m['seriesPassAdmin.tierStricterOption']({ tier: tier.name ?? '', price })
												: `${tier.name} (${price})`}
										</option>
									{/each}
								</select>
								{#if selectable.length < tiers.length}
									<p class="mt-1 text-xs text-muted-foreground">
										{m['seriesPassAdmin.incompatibleTierHint']()}
									</p>
								{/if}
							</div>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</fieldset>
