<script lang="ts">
	/**
	 * Interactive seat layer of the whole-venue overview (seat-level selection
	 * on top of #679's sector targets). A sector sold by EXACTLY ONE purchasable
	 * user_choice tier renders its real seats here — live statuses, that tier's
	 * prices in aria/title, tap = REAL server hold via SeatHoldController.
	 * Best-available and multi-tier sectors stay whole-sector targets; unsold
	 * sectors stay ghosts.
	 *
	 * Mounted INSIDE DialogContent so it only exists while the overview is open:
	 * the controller's chart/availability queries share the TanStack cache with
	 * the purchase dialogs (['seating-chart'/'seating-availability', eventId]),
	 * and the teardown effect releases any un-handed-off holds on close. The
	 * "Continue" CTA hands the holds to the purchase path instead (the purchase
	 * dialog adopts them via seedFromAvailability — the reload-restore path).
	 */
	import * as m from '$lib/paraglide/messages.js';
	import type { TierRemainingTicketsSchema } from '$lib/api/generated/types.gen';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { AlertCircle, Loader2 } from '@lucide/svelte';
	import SeatMap from '$lib/components/tickets/SeatMap.svelte';
	import { SeatHoldController } from '$lib/components/tickets/seat-hold-controller.svelte';
	import { checkoutTotal } from '$lib/components/tickets/checkout-total';
	import { holdConflictMessage } from '$lib/components/tickets/purchase-error';
	import { sellableCategoryIds } from '$lib/components/tickets/seat-pricing';
	import { buildSeatViews } from '$lib/components/tickets/seating-view';
	import { authStore } from '$lib/stores/auth.svelte';
	import { formatMoney } from '$lib/utils/format';
	import {
		buildSectorOverview,
		parseStageMetadata,
		seatSellingTier,
		sectorTargetFrom,
		tierMaxSelectable,
		type SectorSeatConfig
	} from './venue-overview';

	interface Props {
		eventId: string;
		tiers: TierSchemaWithId[];
		/** Sign-in-first buyers get no seat selection: targets + chooser only. */
		needsLogin: boolean;
		/** Per-tier remaining tickets info (my-status endpoint), when known. */
		tierRemainingTickets?: TierRemainingTicketsSchema[];
		/** Event-level max tickets per user (tier-level value wins when set). */
		eventMaxTicketsPerUser?: number | null;
		/** A whole-sector target was activated (1:1 route or 1:N chooser). */
		onSectorTarget: (sectorId: string) => void;
		/** Continue with the held seats: hand the holds to the purchase path. */
		onContinue: (tier: TierSchemaWithId) => void;
	}

	const {
		eventId,
		tiers,
		needsLogin,
		tierRemainingTickets,
		eventMaxTicketsPerUser = null,
		onSectorTarget,
		onContinue
	}: Props = $props();

	// Overview-local counter the seat taps drive (no visible stepper here):
	// grows tap by tap up to the active sector's tier cap, resets on a sector
	// switch. The purchase dialog re-grows its own counter on adoption.
	let quantity = $state(1);
	/** The single sector the current selection lives in (one at a time). */
	let activeSectorId = $state<string | null>(null);
	/** Polite announcement when switching sectors releases the old selection. */
	let announcement = $state('');
	/** Inline 409-conflict message (seat grabbed between render and tap). */
	let conflictMessage = $state('');
	/** Set when Continue handed the holds to the purchase path (don't release). */
	let handedOff = false;

	// Must be constructed during component init (createQuery/useQueryClient).
	const controller = new SeatHoldController({
		eventId,
		getQuantity: () => quantity,
		getMaxQuantity: () => active?.max ?? 1,
		onAutoGrowQuantity: (next) => {
			quantity = next;
		},
		isAuthenticated: () => !!authStore.accessToken,
		onConflict: (_seatIds, reason) => {
			conflictMessage = holdConflictMessage(reason);
		}
	});

	const chart = $derived(controller.chartQuery.data ?? null);
	const availability = $derived(controller.availabilityQuery.data ?? null);
	const isLoading = $derived(
		controller.chartQuery.isPending || controller.availabilityQuery.isPending
	);
	const loadFailed = $derived(
		controller.chartQuery.isError || controller.availabilityQuery.isError
	);

	const stage = $derived(chart ? parseStageMetadata(chart.metadata) : null);

	const remainingById = $derived(
		new Map((tierRemainingTickets ?? []).map((info) => [info.tier_id, info]))
	);

	const entries = $derived(
		chart ? buildSectorOverview(chart, tiers, { remaining: tierRemainingTickets }) : []
	);

	/** seat id → sector id, for sector-switch detection and hold seeding. */
	const seatSector = $derived(
		new Map(
			(chart?.sectors ?? []).flatMap((sector) =>
				(sector.seats ?? []).map((seat) => [seat.id, sector.id] as const)
			)
		)
	);

	interface SelectableSector {
		tier: TierSchemaWithId;
		sectorName: string;
		max: number;
	}

	// Seat-selectable sectors: exactly one purchasable user_choice tier (see
	// seatSellingTier). Buyers who must sign in first keep the target flow —
	// the chooser doubles as their sign-in sheet.
	const selectableSectors = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- derived lookup map, rebuilt whole on change, never mutated afterwards
		const map = new Map<string, SelectableSector>();
		if (needsLogin) return map;
		for (const entry of entries) {
			const tier = seatSellingTier(entry);
			if (!tier) continue;
			map.set(entry.sectorId, {
				tier,
				sectorName: entry.sectorName,
				max: tierMaxSelectable(tier, remainingById.get(tier.id), eventMaxTicketsPerUser)
			});
		}
		return map;
	});

	// Whole-sector click targets for everything that is sold but not
	// seat-selectable; accessible name and visible overlay both carry the tier
	// name(s) + price(s).
	const sectorTargets = $derived(
		entries
			.filter((entry) => entry.options.length > 0 && !selectableSectors.has(entry.sectorId))
			.map(sectorTargetFrom)
	);

	const heldCount = $derived(controller.myHolds.length);
	const active = $derived(activeSectorId ? (selectableSectors.get(activeSectorId) ?? null) : null);

	// Per-sector seat rendering config: each sector uses ITS selling tier's
	// server-resolved pricing; only the active sector can be at its cap.
	const interactiveSectors = $derived(
		[...selectableSectors.entries()].map(([sectorId, info]): SectorSeatConfig => ({
			sectorId,
			seatPricing: info.tier.seat_pricing ?? null,
			currency: info.tier.currency ?? null,
			maxReached: sectorId === activeSectorId && heldCount >= info.max
		}))
	);

	// Seat views per selectable sector, each blocked by ITS tier's sellable
	// category allow-list (unsellable painted seats grey out here too).
	const seatViews = $derived.by(() => {
		if (!chart || !availability) return [];
		return [...selectableSectors.entries()].flatMap(([sectorId, info]) =>
			buildSeatViews(chart, availability, {
				sectorId,
				myHolds: controller.myHolds,
				pending: controller.pendingSeatIds,
				sellableCategoryIds: sellableCategoryIds(info.tier.seat_pricing ?? null)
			})
		);
	});

	// Adopt the caller's surviving server holds once (reload-restore parity
	// with the purchase dialogs): valid ids span ALL selectable sectors, and
	// the active sector derives from the first adopted hold.
	let seeded = false;
	$effect(() => {
		if (seeded || !chart || !availability || selectableSectors.size === 0) return;
		seeded = true;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup set built and consumed synchronously within this effect
		const validIds = new Set<string>();
		for (const sector of chart.sectors ?? []) {
			if (!selectableSectors.has(sector.id)) continue;
			for (const seat of sector.seats ?? []) {
				if (seat.is_active !== false) validIds.add(seat.id);
			}
		}
		const firstHeld = (availability.my_holds ?? []).find((id) => validIds.has(id));
		if (firstHeld) activeSectorId = seatSector.get(firstHeld) ?? null;
		controller.seedFromAvailability(validIds);
	});

	// Selection is confined to ONE sector: a tap in a different selectable
	// sector releases the previous selection first (announced politely).
	async function handleToggle(seatId: string): Promise<void> {
		conflictMessage = '';
		const sectorId = seatSector.get(seatId);
		if (!sectorId || !selectableSectors.has(sectorId)) return;
		if (activeSectorId && activeSectorId !== sectorId && controller.myHolds.length > 0) {
			const previousName = selectableSectors.get(activeSectorId)?.sectorName ?? activeSectorId;
			await controller.releaseAll();
			quantity = 1;
			announcement = m['venueOverview.selectionReleased']({ sector: previousName });
		}
		activeSectorId = sectorId;
		await controller.toggleSeat(seatId);
	}

	function handleContinue(): void {
		if (!active || heldCount === 0) return;
		handedOff = true;
		onContinue(active.tier);
	}

	// Estimated total for the held seats (server-resolved prices only; the
	// authoritative amount is computed at checkout under the tier lock).
	const footerTotal = $derived(
		active && heldCount > 0
			? checkoutTotal({
					tier: active.tier,
					quantity: heldCount,
					heldSeatIds: controller.myHolds,
					chart,
					selectedZoneId: null,
					pwycAmount: '',
					discountedPrice: null
				})
			: null
	);

	// Closed without Continue: release ALL holds (exactly like the purchase
	// dialogs); after a hand-off the purchase path owns them. Pending taps are
	// released too — an in-flight hold could land after the unmount. A plain
	// browse-and-close with no taps skips the request entirely.
	$effect(() => () => {
		if (!handedOff && (controller.myHolds.length > 0 || controller.pendingSeatIds.length > 0)) {
			void controller.releaseAll();
		}
	});
</script>

{#if isLoading}
	<div
		class="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-lg border bg-muted/20 text-muted-foreground"
		role="status"
	>
		<Loader2 class="h-6 w-6 animate-spin" aria-hidden="true" />
		<p class="text-sm">{m['venueOverview.loading']()}</p>
	</div>
{:else if loadFailed || !chart}
	<div class="flex min-h-0 flex-1 items-center justify-center rounded-lg border bg-muted/20 p-6">
		<p class="text-sm text-destructive" role="alert">{m['venueOverview.loadError']()}</p>
	</div>
{:else}
	<div class="min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/20">
		<SeatMap
			{chart}
			seats={seatViews}
			interactive={false}
			{sectorTargets}
			onSectorSelect={onSectorTarget}
			{interactiveSectors}
			onToggle={handleToggle}
			{stage}
		/>
	</div>

	<!-- Polite live region: sector-switch releases and hold conflicts. -->
	<div aria-live="polite">
		{#if conflictMessage}
			<Alert variant="destructive" class="mt-2">
				<AlertCircle class="h-4 w-4" />
				<AlertDescription>{conflictMessage}</AlertDescription>
			</Alert>
		{:else if announcement}
			<p class="mt-2 text-sm text-muted-foreground">{announcement}</p>
		{/if}
	</div>

	<!-- Selection footer: count + estimated total + Continue (hand-off CTA). -->
	{#if active && heldCount > 0}
		<div class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
			<div class="min-w-0">
				<p class="text-sm font-medium" aria-live="polite">
					{heldCount === 1
						? m['venueOverview.oneSeatSelected']()
						: m['venueOverview.seatsSelected']({ count: heldCount })}
					<span class="font-normal text-muted-foreground">· {active.tier.name}</span>
				</p>
				{#if footerTotal !== null}
					<p class="text-sm">
						<span class="text-muted-foreground">{m['checkoutFooter.total']()}</span>
						<span class="font-bold">
							{active.tier.payment_method === 'free'
								? m['ticketConfirmationDialog.free']()
								: formatMoney(footerTotal, active.tier.currency)}
						</span>
					</p>
				{/if}
				<p class="text-xs text-muted-foreground">{m['seatSelector.heldForTenMinutes']()}</p>
			</div>
			<Button onclick={handleContinue}>{m['venueOverview.continue']()}</Button>
		</div>
	{/if}
{/if}
