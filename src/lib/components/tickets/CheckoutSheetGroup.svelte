<script lang="ts">
	/** One cart group's card inside `CheckoutSheet` (#853 PR 2/3): title/total
	 * row, ticket-holder names, PWYC amount, and — for seated best-available
	 * tiers — the zone picker and accessible-seating checkbox. Extracted from
	 * `CheckoutSheet.svelte` to keep that file under the line budget; all
	 * writes go through `cart.setGuestName`/`setPwycAmount`/`setZone`/
	 * `setAccessible` — this component never mutates `group` directly. */
	import * as m from '$lib/paraglide/messages.js';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Info } from '@lucide/svelte';
	import GuestNameInputs from './GuestNameInputs.svelte';
	import PwycInput from './PwycInput.svelte';
	import type { EventCart, CartGroup } from './cart.svelte';
	import type { CartSeatHoldRegistry } from './cart-seat-registry.svelte';
	import { cartTotalArgs, checkoutTotal } from './checkout-total';
	import {
		pwycBounds,
		pwycErrorMessage,
		pwycSuggestions,
		validatePwycAmount
	} from './pwyc-validation';
	import { isMappedBestAvailable, zoneOptions } from './seat-zones';
	import { formatMoney } from '$lib/utils/format';
	import type { VenueChartSchema } from '$lib/api/generated/types.gen';

	interface Props {
		group: CartGroup;
		cart: EventCart;
		requireTicketNames: boolean;
		isProcessing: boolean;
		isFree: boolean;
		/** Venue chart for seated groups' totals — see `CheckoutSheet`'s `chart` prop. */
		chart: VenueChartSchema | null;
		/** This group's per-ticket discounted price, when a discount is applied. */
		discountedPrice: string | null;
		/** Cart-lifetime seat-hold controller registry (#853 PR 3, Task 5): the
		 * source of this group's zone availability, when it's a seated tier. */
		registry: CartSeatHoldRegistry;
		/** #853 PR 4: true for an unauthenticated buyer — gates the
		 * best-available email-assignment notice below (ported from the legacy
		 * `GuestTicketSeatSection`'s `guestTicketDialog.bestAvailableEmailNotice`). */
		isGuest: boolean;
		onPwycKeydown: (e: KeyboardEvent) => void;
	}

	const {
		group,
		cart,
		requireTicketNames,
		isProcessing,
		isFree,
		chart,
		discountedPrice,
		registry,
		isGuest,
		onPwycKeydown
	}: Props = $props();

	function guestNamesFor(): string[] {
		return Array.from({ length: group.quantity }, (_, index) => group.guestNames[index] ?? '');
	}

	// Live inline feedback for the amount field only — below-min/above-max/
	// non-numeric entries show as the buyer types. The "empty" case is
	// suppressed here: an untouched field isn't an error to nag about inline,
	// the disabled button + footer hint already cover it.
	function groupPwycError(): string {
		const { minAmount, maxAmount } = pwycBounds(group.tier);
		const validation = validatePwycAmount(group.pwycAmount ?? '', minAmount, maxAmount);
		if (validation.valid || validation.error === 'empty') return '';
		return pwycErrorMessage(validation.error, group.tier.currency, minAmount, maxAmount);
	}

	function groupTotal(): string | null {
		return checkoutTotal(
			cartTotalArgs({
				tier: group.tier,
				quantity: group.quantity,
				seatIds: group.seatIds,
				chart,
				pwycAmount: group.pwycAmount,
				priceCategoryId: group.priceCategoryId,
				discountedPrice
			})
		);
	}

	// GuestNameInputs' onClearError exists for callers with real per-field,
	// submit-triggered error state (e.g. TicketConfirmationDialog). This sheet
	// has none — the disabled button + footer hint is the whole submit gate —
	// so there's nothing to clear, and importantly nothing shared across groups.
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	function noop(): void {}

	// --- zone picker (mapped best-available tiers) ---------------------------
	// Availability comes from this tier's registered seat-hold controller (Task
	// 5's `CartSeatGroupHolds`, keyed into `registry` by tier id) — the same
	// controller the countdown/hold-release logic uses. Options are the tier's
	// sellable zones (seat_pricing.categories); selectability compares the
	// per-zone availability snapshot against the requested quantity (exact
	// predicate — see seat-zones.ts). Until the snapshot loads every zone stays
	// selectable; the server is the authority.
	const isMapped = $derived(isMappedBestAvailable(group.tier));
	const isBestAvailable = $derived(group.tier.seat_assignment_mode === 'best_available');
	const availability = $derived(registry.get(group.tier.id)?.availabilityQuery.data ?? null);
	const zoneOpts = $derived(
		isMapped
			? zoneOptions(
					group.tier.seat_pricing,
					availability ? (availability.zones ?? null) : null,
					group.tier.sector?.id ?? null,
					group.quantity,
					group.accessibleRequired
				)
			: []
	);

	// Single-zone convenience: preselect the only zone (the REQUEST still names
	// it explicitly — the backend has no default). A selection whose zone
	// disappeared (tier refetch) is cleared rather than silently submitted.
	// Ported from the legacy `SeatAssignmentSection`'s zone-picker effect.
	$effect(() => {
		if (zoneOpts.length === 0) return;
		if (group.priceCategoryId && !zoneOpts.some((zone) => zone.id === group.priceCategoryId)) {
			cart.setZone(group.tier.id, null);
			return;
		}
		if (!group.priceCategoryId && zoneOpts.length === 1 && zoneOpts[0].selectable) {
			cart.setZone(group.tier.id, zoneOpts[0].id);
		}
	});
</script>

<div class="space-y-3 rounded-[1.25rem] border-2 border-border bg-card p-4 shadow-poster">
	<div class="flex items-center justify-between gap-3">
		<p class="font-bold">
			{m['cartSheet.groupTickets']({ tierName: group.tier.name, count: group.quantity })}
		</p>
		{#if !isFree}
			<p class="text-sm font-semibold text-primary">
				{formatMoney(groupTotal(), group.tier.currency)}
			</p>
		{/if}
	</div>

	{#if requireTicketNames}
		<!-- No per-field inline alert here: the disabled confirm button +
		     footer hint (below) is the shipped submit gate. -->
		<GuestNameInputs
			guestNames={guestNamesFor()}
			idPrefix={group.tier.id}
			{isProcessing}
			guestNameError=""
			onUpdateName={(index, value) => cart.setGuestName(group.tier.id, index, value)}
			onClearError={noop}
		/>
	{/if}

	{#if group.tier.price_type === 'pwyc'}
		{@const bounds = pwycBounds(group.tier)}
		<!-- No separate "Choose your amount" heading here: PwycInput's own
		     "Payment Amount" <Label> already names this control — stacking
		     cartSheet.pwycHeading directly above it would say the same thing
		     twice (flagged in Task 5's report as a call this task must make). -->
		<PwycInput
			currency={group.tier.currency}
			idPrefix={group.tier.id}
			minAmount={bounds.minAmount}
			maxAmount={bounds.maxAmount}
			pwycAmount={group.pwycAmount ?? ''}
			pwycError={groupPwycError()}
			{isProcessing}
			suggestions={pwycSuggestions(bounds.minAmount, bounds.maxAmount)}
			onAmountChange={(value) => cart.setPwycAmount(group.tier.id, value)}
			onKeydown={onPwycKeydown}
		/>
	{/if}

	{#if isMapped}
		<!-- Mapped tier: the buyer names a zone; seats are auto-assigned within
		     it. Mandatory — the backend deliberately has no default, so the
		     picker renders even for a single-zone tier. -->
		<fieldset>
			<legend class="text-sm font-medium">{m['seatZones.legend']()}</legend>
			<p class="mt-0.5 text-xs text-muted-foreground">{m['seatZones.help']()}</p>
			<div class="mt-2 space-y-1.5">
				{#each zoneOpts as zone (zone.id)}
					<label
						for="{group.tier.id}-zone-{zone.id}"
						class="flex cursor-pointer items-center gap-2.5 rounded-md border p-2.5 text-sm transition-colors {group.priceCategoryId ===
						zone.id
							? 'border-primary bg-primary/5'
							: 'border-border'} {!zone.selectable ? 'cursor-not-allowed opacity-60' : ''}"
					>
						<input
							type="radio"
							id="{group.tier.id}-zone-{zone.id}"
							name="{group.tier.id}-zone"
							value={zone.id}
							checked={group.priceCategoryId === zone.id}
							onchange={() => cart.setZone(group.tier.id, zone.id)}
							disabled={isProcessing || !zone.selectable}
							class="h-4 w-4 accent-primary"
						/>
						<span
							class="inline-block h-3 w-3 shrink-0 rounded-full border-2 bg-background"
							style={zone.color ? `border-color: ${zone.color}` : undefined}
							aria-hidden="true"
						></span>
						<span class="min-w-0 flex-1 truncate">{zone.name}</span>
						{#if !zone.selectable}
							<span class="shrink-0 text-xs text-muted-foreground">
								{zone.freeSeats === 0
									? m['seatZones.soldOut']()
									: m['seatZones.notEnough']({ count: group.quantity })}
							</span>
						{/if}
						{#if zone.price != null}
							<span class="shrink-0 font-medium"
								>{formatMoney(zone.price, group.tier.currency)}</span
							>
						{/if}
					</label>
				{/each}
			</div>
		</fieldset>
	{/if}

	{#if isBestAvailable}
		<div class="flex items-center gap-2">
			<Checkbox
				id="{group.tier.id}-accessible-required"
				checked={group.accessibleRequired}
				onCheckedChange={(checked) => cart.setAccessible(group.tier.id, checked === true)}
				disabled={isProcessing}
			/>
			<Label for="{group.tier.id}-accessible-required" class="cursor-pointer text-sm font-normal">
				{m['ticketConfirmationDialog.accessibleSeatsLabel']()}
			</Label>
		</div>
		{#if isGuest}
			<Alert>
				<Info class="h-4 w-4" />
				<AlertDescription>
					{m['guestTicketDialog.bestAvailableEmailNotice']()}
				</AlertDescription>
			</Alert>
		{/if}
	{/if}
</div>
