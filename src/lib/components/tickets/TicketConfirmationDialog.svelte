<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Ticket, DollarSign, AlertCircle, CreditCard, Wallet, Loader2 } from '@lucide/svelte';
	import CancellationPolicySummary from './CancellationPolicySummary.svelte';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type {
		TicketPurchaseItem,
		SeatAssignmentMode,
		DiscountCodeValidationResponse,
		BuyerBillingInfoSchema
	} from '$lib/api/generated/types.gen';
	import { untrack } from 'svelte';
	import type { SeatHoldController } from './seat-hold-controller.svelte';
	import { bestAvailableFailureMessage, extractPurchaseErrorMessage } from './purchase-error';
	import { authStore } from '$lib/stores/auth.svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import DiscountCodeInput from './DiscountCodeInput.svelte';
	import CheckoutBillingSection from './CheckoutBillingSection.svelte';
	import GuestNameInputs from './GuestNameInputs.svelte';
	import PwycInput from './PwycInput.svelte';
	import SeatAssignmentSection from './SeatAssignmentSection.svelte';
	import TicketQuantitySelector from './TicketQuantitySelector.svelte';
	import { checkoutTotal } from './checkout-total';
	import { formatMoney } from '$lib/utils/format';
	import { tierPriceDisplay } from './tier-price-display';
	import { isMappedBestAvailable } from './seat-zones';
	import { pwycErrorMessage, pwycSuggestions, validatePwycAmount } from './pwyc-validation';

	interface ConfirmPayload {
		amount?: number;
		tickets: TicketPurchaseItem[];
		discountCode?: string;
		billingInfo?: BuyerBillingInfoSchema;
		/** Buyer's zone on a MAPPED best-available tier (mandatory there, absent otherwise). */
		priceCategoryId?: string;
		/** Accessible-seating opt-in (best-available tiers). */
		accessibleRequired?: boolean;
	}

	interface Props {
		open: boolean;
		tier: TierSchemaWithId;
		/** Event ID for fetching seat availability */
		eventId: string;
		onClose: () => void;
		onConfirm: (payload: ConfirmPayload) => void | Promise<void>;
		/** Peek: would onConfirm resume a held reservation? (skips the re-hold) */
		hasResumableCheckout?: (payload: ConfirmPayload) => boolean;
		isProcessing?: boolean;
		/** Maximum tickets the user can purchase (null = unlimited up to tier availability) */
		maxQuantity?: number | null;
		/** Event-level max tickets per user (fallback when maxQuantity is null) */
		eventMaxTicketsPerUser?: number | null;
		/** User's display name for auto-fill when purchasing single ticket */
		userName?: string;
		/** Pre-filled discount code (e.g. from URL param) */
		initialDiscountCode?: string;
	}

	let {
		open = $bindable(),
		tier,
		eventId,
		onClose,
		onConfirm,
		hasResumableCheckout = () => false,
		isProcessing = false,
		maxQuantity = null,
		eventMaxTicketsPerUser = null,
		userName = '',
		initialDiscountCode = ''
	}: Props = $props();

	// Quantity state
	let quantity = $state(1);

	// Guest names array - one for each ticket
	let guestNames = $state<string[]>(['']);

	// PWYC state (only for pay-what-you-can tiers)
	let pwycAmount = $state('');
	let pwycError = $state('');

	// Seat selection error
	let seatSelectionError = $state('');

	// Guest name validation error
	let guestNameError = $state('');

	// API error from backend
	let apiError = $state('');

	// Billing section ref
	let billingSection: CheckoutBillingSection | undefined = $state();

	// Whether invoicing is available for this tier
	const invoicingAvailable = $derived(!!tier.invoicing_available);

	// Discount code state
	let discountResult = $state<DiscountCodeValidationResponse | null>(null);
	let appliedDiscountCode = $state('');

	// Whether discount codes are applicable (not for free/PWYC tiers)
	const discountApplicable = $derived(tier.payment_method !== 'free' && tier.price_type !== 'pwyc');

	// Computed values
	const isPwyc = $derived(tier.price_type === 'pwyc');
	const isFree = $derived(tier.payment_method === 'free');
	const isOnlinePayment = $derived(tier.payment_method === 'online');
	const isOfflinePayment = $derived(
		tier.payment_method === 'offline' || tier.payment_method === 'at_the_door'
	);

	// Seat assignment mode
	const seatAssignmentMode = $derived<SeatAssignmentMode>(tier.seat_assignment_mode ?? 'none');
	const isUserChoiceSeat = $derived(seatAssignmentMode === 'user_choice');
	const isBestAvailable = $derived(seatAssignmentMode === 'best_available');

	// Venue/sector info for display
	const tierVenue = $derived(tier.venue ?? null);
	const tierSector = $derived(tier.sector ?? null);

	// Seat-hold controller, instantiated by SeatAssignmentSection while the
	// dialog is open with a seated tier ("selection state IS the server hold").
	let seatController = $state<SeatHoldController | null>(null);
	// Selected seats = the caller's live server holds (selection order preserved)
	const heldSeatIds = $derived(seatController?.myHolds ?? []);
	// best_available options/errors
	let accessibleRequired = $state(false);
	let bestAvailableError = $state('');
	// Mapped best-available tier: the buyer must name a zone — no default, even
	// with a single zone (the request always carries an explicit id).
	const mappedBestAvailable = $derived(isBestAvailable && isMappedBestAvailable(tier));
	let selectedZoneId = $state<string | null>(null);
	let isHoldingSeats = $state(false);
	// Set when the purchase path took over the holds (they must NOT be released)
	let purchaseHandedOff = false;

	// PWYC min/max
	const minAmount = $derived.by(() => {
		if (!isPwyc) return 0;
		if (tier.pwyc_min) {
			return typeof tier.pwyc_min === 'string' ? parseFloat(tier.pwyc_min) : tier.pwyc_min;
		}
		return 1;
	});

	const maxAmount = $derived.by(() => {
		if (!isPwyc || !tier.pwyc_max) return null;
		return typeof tier.pwyc_max === 'string' ? parseFloat(tier.pwyc_max) : tier.pwyc_max;
	});

	// Headline price: flat/PWYC/free wording, or the honest server-resolved
	// range for category-priced tiers (either mode) — see tier-price-display.ts.
	const priceDisplay = $derived(tierPriceDisplay(tier, { isFree, isPwyc, minAmount, maxAmount }));

	// Running total pinned in the sticky footer: the in-flow estimates can
	// scroll away under the seat map, this line cannot (see checkout-total.ts).
	const footerTotal = $derived(
		checkoutTotal({
			tier,
			quantity,
			heldSeatIds,
			chart: seatController?.chartQuery.data ?? null,
			selectedZoneId,
			pwycAmount,
			discountedPrice:
				appliedDiscountCode && discountResult?.valid
					? (discountResult.discounted_price ?? null)
					: null
		})
	);

	// Dialog title
	const dialogTitle = $derived.by(() => {
		if (isFree) return m['ticketConfirmationDialog.titleClaimFree']();
		if (isOfflinePayment) return m['ticketConfirmationDialog.titleReserve']();
		if (isPwyc) return m['ticketConfirmationDialog.titleGetTicket']();
		return m['ticketConfirmationDialog.titleConfirmPurchase']();
	});

	// Dialog icon component
	const dialogIcon = $derived.by(() => {
		if (isFree) return Ticket;
		if (isOfflinePayment) return Wallet;
		if (isOnlinePayment) return CreditCard;
		return DollarSign;
	});

	// Tier-level max tickets per user (can override event-level setting)
	const tierMaxTicketsPerUser = $derived<number | null>(tier.max_tickets_per_user ?? null);

	// Effective max per user: use tier's value if set, otherwise fall back to event-level
	const effectiveMaxPerUser = $derived<number | null>(
		tierMaxTicketsPerUser !== null ? tierMaxTicketsPerUser : eventMaxTicketsPerUser
	);

	// Calculated max quantity based on tier availability, tier limit, and user limit
	const effectiveMaxQuantity = $derived.by(() => {
		let max = 100;
		if (tier.total_available !== null && tier.total_available > 0) {
			max = Math.min(max, tier.total_available);
		}
		if (effectiveMaxPerUser !== null && effectiveMaxPerUser > 0) {
			max = Math.min(max, effectiveMaxPerUser);
		}
		if (maxQuantity !== null && maxQuantity > 0) {
			max = Math.min(max, maxQuantity);
		}
		return Math.max(1, max);
	});

	// Whether to show quantity selector (more than 1 ticket allowed)
	const showQuantitySelector = $derived(effectiveMaxQuantity > 1);

	// Only ask for guest names when purchasing multiple tickets.
	// For a single ticket we default to the buyer's profile name (see handleConfirm).
	const showGuestNames = $derived(quantity > 1);

	// Check if all guest names are filled (at least the first character)
	const allGuestNamesFilled = $derived(guestNames.every((name) => name.trim().length > 0));

	// PWYC validation state for canSubmit and UI hints (see pwyc-validation.ts)
	const pwycValidation = $derived(
		isPwyc ? validatePwycAmount(pwycAmount, minAmount, maxAmount) : { valid: true, error: null }
	);

	// Check if form is valid for submission
	const canSubmit = $derived.by(() => {
		if (showGuestNames && !allGuestNamesFilled) return false;
		if (isPwyc && !pwycValidation.valid) return false;
		if (isUserChoiceSeat && heldSeatIds.length !== quantity) return false;
		if (mappedBestAvailable && !selectedZoneId) return false;
		return true;
	});

	// Reference to DiscountCodeInput for resetting its internal state
	let discountCodeInputRef: DiscountCodeInput | undefined = $state();

	// Reset state when dialog opens/closes
	$effect(() => {
		if (!open) {
			pwycAmount = '';
			pwycError = '';
			seatSelectionError = '';
			guestNameError = '';
			apiError = '';
			quantity = 1;
			guestNames = [userName || ''];
			accessibleRequired = false;
			bestAvailableError = '';
			selectedZoneId = null;
			discountResult = null;
			appliedDiscountCode = '';
			discountCodeInputRef?.resetInput(initialDiscountCode, !!initialDiscountCode);
			// Closed without claim/checkout handoff: release the server holds
			// (fire-and-forget — never block closing).
			const controller = untrack(() => seatController);
			seatController = null;
			if (controller && !purchaseHandedOff) void controller.releaseAll();
			purchaseHandedOff = false;
		} else {
			guestNames = [userName || ''];
			purchaseHandedOff = false;
		}
	});

	// Update guest names array when quantity changes
	$effect(() => {
		const newLength = quantity;
		const currentLength = guestNames.length;
		if (newLength > currentLength) {
			guestNames = [...guestNames, ...Array(newLength - currentLength).fill('')];
		} else if (newLength < currentLength) {
			guestNames = guestNames.slice(0, newLength);
		}
	});

	// Quantity decreased below held seats: release the newest excess holds;
	// clear the pick-more-seats error once enough seats are held.
	$effect(() => {
		if (seatController && seatController.myHolds.length > quantity) {
			void seatController.trimTo(quantity);
		}
		if (heldSeatIds.length === quantity) seatSelectionError = '';
	});

	// Safety net: Cancel unmounts this dialog in the same tick (the tier modal
	// clears selectedTier), so the !open branch above may never run — release
	// un-handed-off holds on teardown too (no-op after a normal close).
	$effect(() => () => {
		const controller = untrack(() => seatController);
		if (controller && !purchaseHandedOff) void controller.releaseAll();
	});

	function incrementQuantity() {
		if (quantity < effectiveMaxQuantity) quantity++;
	}

	function decrementQuantity() {
		if (quantity > 1) quantity--;
	}

	function updateGuestName(index: number, value: string) {
		guestNames[index] = value;
	}

	// Set PWYC error message based on validation state
	function setPwycErrorMessage(): boolean {
		if (!isPwyc || pwycValidation.valid) return true;
		pwycError = pwycErrorMessage(pwycValidation.error, tier.currency, minAmount, maxAmount);
		return false;
	}

	// Default guest name for a hidden single-ticket input.
	// Backend requires a non-empty guest_name (min_length 1); the buyer's profile
	// name is used, mirroring getDefaultGuestName() on the non-dialog purchase path.
	// Falls back to a localized placeholder so the payload is never empty when the
	// buyer has no display name.
	function getDefaultGuestName(): string {
		return userName.trim() || m['ticketConfirmationDialog.defaultGuestName']();
	}

	// Set guest name error message based on validation state
	function setGuestNameErrorMessage(): boolean {
		guestNameError = '';
		// When the name input is hidden (single ticket), we auto-fill in handleConfirm.
		if (!showGuestNames) return true;
		const emptyIndex = guestNames.findIndex((name) => !name.trim());
		if (emptyIndex >= 0) {
			guestNameError =
				emptyIndex === 0
					? m['ticketConfirmationDialog.errorEnterYourName']()
					: m['ticketConfirmationDialog.errorEnterHolderName']({ number: emptyIndex + 1 });
			return false;
		}
		return true;
	}

	async function handleConfirm() {
		if (isHoldingSeats) return;
		apiError = '';
		bestAvailableError = '';
		if (!setGuestNameErrorMessage()) return;
		if (!setPwycErrorMessage()) return;

		// Validate billing section if open
		if (billingSection && !billingSection.validate()) return;

		// For user_choice seats, validate the held selection
		if (isUserChoiceSeat && heldSeatIds.length !== quantity) {
			const remaining = quantity - heldSeatIds.length;
			seatSelectionError = m['ticketConfirmationDialog.selectMoreSeats']({ count: remaining });
			return;
		}
		seatSelectionError = '';

		// Build tickets array. For a hidden single-ticket name input, fall back to
		// the buyer's profile name so guest_name is always non-empty.
		const tickets: TicketPurchaseItem[] = guestNames.map((name, index) => {
			const trimmed = name.trim() || (!showGuestNames ? getDefaultGuestName() : '');
			const ticket: TicketPurchaseItem = { guest_name: trimmed };
			if (isUserChoiceSeat && heldSeatIds[index]) {
				ticket.seat_id = heldSeatIds[index];
			}
			return ticket;
		});

		const payload: ConfirmPayload = { tickets };
		if (isPwyc && pwycAmount.trim()) payload.amount = parseFloat(pwycAmount);
		if (appliedDiscountCode && discountResult?.valid) payload.discountCode = appliedDiscountCode;
		const billingInfo = billingSection?.getBillingInfo();
		if (billingInfo) payload.billingInfo = billingInfo;
		if (isBestAvailable) {
			// Mapped tier: the zone is mandatory and rides on hold AND checkout
			// (the backend 409s on a mismatch between the held block and checkout).
			if (mappedBestAvailable) {
				if (!selectedZoneId) return;
				payload.priceCategoryId = selectedZoneId;
			}
			payload.accessibleRequired = accessibleRequired;
		}

		// best_available: hold the server-picked adjacent block BEFORE checkout
		// (the purchase consumes these live holds; tickets carry no seat_id) —
		// skipped when an identical retry resumes a reservation whose holds it consumed.
		if (isBestAvailable && !hasResumableCheckout(payload)) {
			if (!seatController) return;
			isHoldingSeats = true;
			try {
				// Retry after a failed confirm: drop any stale block first so the
				// server picks a fresh one instead of stacking holds.
				if (seatController.myHolds.length > 0) await seatController.releaseAll();
				const result = await seatController.holdBestAvailable(
					tier.id,
					quantity,
					accessibleRequired,
					mappedBestAvailable ? selectedZoneId : null
				);
				if (!result.ok) {
					bestAvailableError = bestAvailableFailureMessage(result);
					return;
				}
			} finally {
				isHoldingSeats = false;
			}
		}

		try {
			await onConfirm(payload);
			// The purchase path now owns the holds — do not release them on close.
			purchaseHandedOff = true;
		} catch (err: unknown) {
			console.error('Ticket purchase error:', err);
			apiError = extractPurchaseErrorMessage(err, m['ticketConfirmationDialog.errorGeneric']());
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !isProcessing) {
			e.preventDefault();
			handleConfirm();
		}
	}

	// Quick amount suggestions for PWYC (shared helper, see pwyc-validation.ts)
	const suggestions = $derived(pwycSuggestions(minAmount, maxAmount));

	// Discount code callbacks
	function handleDiscountApply(code: string, result: DiscountCodeValidationResponse) {
		appliedDiscountCode = code;
		discountResult = result;
	}

	function handleDiscountRemove() {
		discountResult = null;
		appliedDiscountCode = '';
	}

	// Computed discounted price display
	const originalPrice = $derived.by(() => {
		if (isFree || isPwyc) return 0;
		return typeof tier.price === 'string' ? parseFloat(tier.price) : (tier.price ?? 0);
	});

	const discountedPrice = $derived.by(() => {
		if (!discountResult?.discounted_price) return null;
		return parseFloat(discountResult.discounted_price);
	});
</script>

<Dialog bind:open>
	<DialogContent
		class="flex max-h-[92vh] flex-col {isUserChoiceSeat ? 'sm:max-w-4xl' : 'sm:max-w-lg'}"
	>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2 text-xl">
				{@const Icon = dialogIcon}
				<Icon class="h-5 w-5 text-primary" aria-hidden="true" />
				{dialogTitle}
			</DialogTitle>
			<DialogDescription>
				{#if isFree}
					{m['ticketConfirmationDialog.descClaimFree']()}
				{:else if isOfflinePayment}
					{tier.payment_method === 'at_the_door'
						? m['ticketConfirmationDialog.descReserveAtDoor']()
						: m['ticketConfirmationDialog.descReserveOffline']()}
				{:else if isPwyc}
					{m['ticketConfirmationDialog.descPwyc']()}
				{:else}
					{m['ticketConfirmationDialog.descOnline']()}
				{/if}
			</DialogDescription>
		</DialogHeader>

		<div class="min-h-0 flex-1 space-y-4 overflow-y-auto py-2">
			<!-- Tier Information Card -->
			<div class="rounded-lg border border-border bg-muted/50 p-4">
				<div class="flex items-start justify-between gap-4">
					<div class="flex-1 space-y-1">
						<h3 class="font-semibold">{tier.name}</h3>
						{#if tier.description}
							<MarkdownContent content={tier.description} class="text-sm text-muted-foreground" />
						{/if}
						{#if !isPwyc}
							<p class="text-lg font-bold text-primary">
								{#if discountedPrice !== null}
									<span class="text-sm text-muted-foreground line-through">{priceDisplay}</span>
									{tier.currency}
									{discountedPrice.toFixed(2)}
								{:else}
									{priceDisplay}
								{/if}
								{#if quantity > 1}
									<span class="text-sm font-normal text-muted-foreground"> × {quantity}</span>
								{/if}
							</p>
						{/if}
					</div>
					<Ticket class="h-8 w-8 shrink-0 text-muted-foreground" aria-hidden="true" />
				</div>
			</div>

			<!-- Cancellation Policy (no-ops until backend exposes the fields on the public tier schema) -->
			<CancellationPolicySummary {tier} />

			<!-- Seat Assignment Info / Selection (owns the SeatHoldController) -->
			<SeatAssignmentSection
				{isUserChoiceSeat}
				{isBestAvailable}
				{tierVenue}
				{tierSector}
				{eventId}
				{quantity}
				maxQuantity={effectiveMaxQuantity}
				onQuantityAutoGrow={(next) => {
					if (next > quantity && next <= effectiveMaxQuantity) quantity = next;
				}}
				isProcessing={isProcessing || isHoldingSeats}
				{seatSelectionError}
				{bestAvailableError}
				{accessibleRequired}
				onAccessibleRequiredChange={(value) => (accessibleRequired = value)}
				{selectedZoneId}
				onZoneChange={(zoneId) => (selectedZoneId = zoneId)}
				onController={(controller) => (seatController = controller)}
				seatPricing={tier.seat_pricing ?? null}
				currency={tier.currency}
			/>

			<!-- Quantity Selector -->
			{#if showQuantitySelector}
				<TicketQuantitySelector
					{quantity}
					{effectiveMaxQuantity}
					{isProcessing}
					onIncrement={incrementQuantity}
					onDecrement={decrementQuantity}
				/>
			{/if}

			<!-- Guest Names -->
			{#if showGuestNames}
				<GuestNameInputs
					{guestNames}
					{quantity}
					{isProcessing}
					{guestNameError}
					onUpdateName={updateGuestName}
					onClearError={() => (guestNameError = '')}
				/>
			{/if}

			<!-- Discount Code Section (not for free/PWYC tiers) -->
			{#if discountApplicable}
				<DiscountCodeInput
					bind:this={discountCodeInputRef}
					{eventId}
					tierId={tier.id}
					currency={tier.currency}
					{originalPrice}
					{quantity}
					{isProcessing}
					initialOpen={!!initialDiscountCode}
					initialCode={initialDiscountCode}
					{appliedDiscountCode}
					{discountResult}
					onApply={handleDiscountApply}
					onRemove={handleDiscountRemove}
				/>
			{/if}

			<!-- PWYC Amount Selection -->
			{#if isPwyc}
				<PwycInput
					currency={tier.currency}
					{minAmount}
					{maxAmount}
					{pwycAmount}
					{pwycError}
					{isProcessing}
					{suggestions}
					onAmountChange={(value) => {
						pwycAmount = value;
						pwycError = '';
					}}
					onKeydown={handleKeydown}
				/>
			{/if}

			<!-- Billing Information (for invoicing) -->
			{#if invoicingAvailable}
				<CheckoutBillingSection
					bind:this={billingSection}
					{eventId}
					tierId={tier.id}
					tierName={tier.name}
					{quantity}
					currency={tier.currency}
					price={tier.price}
					{isPwyc}
					pwycAmount={isPwyc ? pwycAmount : undefined}
					discountCode={appliedDiscountCode && discountResult?.valid
						? appliedDiscountCode
						: undefined}
					priceCategoryId={mappedBestAvailable ? selectedZoneId : null}
					isAuthenticated={!!authStore.accessToken}
					authToken={authStore.accessToken}
					disabled={isProcessing}
				/>
			{/if}

			<!-- Online Payment Notice -->
			{#if isOnlinePayment && !isPwyc}
				<Alert>
					<CreditCard class="h-4 w-4" />
					<AlertDescription>
						<p class="text-sm">
							{m['ticketConfirmationDialog.securePaymentNotice']()}
						</p>
					</AlertDescription>
				</Alert>
			{/if}

			<!-- Availability Warning -->
			{#if tier.total_available !== null && tier.total_available <= 5 && tier.total_available > 0}
				<Alert variant="destructive">
					<AlertCircle class="h-4 w-4" />
					<AlertDescription>
						<p class="text-sm font-medium">
							{tier.total_available === 1
								? m['ticketConfirmationDialog.onlyOneRemaining']()
								: m['ticketConfirmationDialog.onlyNRemaining']({ count: tier.total_available })}
						</p>
					</AlertDescription>
				</Alert>
			{/if}

			<!-- API Error Display -->
			{#if apiError}
				<Alert variant="destructive">
					<AlertCircle class="h-4 w-4" />
					<AlertDescription>
						<p class="font-medium">{m['ticketConfirmationDialog.unableToComplete']()}</p>
						<p class="mt-1 text-sm">{apiError}</p>
					</AlertDescription>
				</Alert>
			{/if}
		</div>

		<DialogFooter class="flex-col gap-2">
			<!-- Validation hint when button would be disabled -->
			{#if !canSubmit && !isProcessing}
				<p class="text-center text-sm text-amber-600 dark:text-amber-500">
					{#if showGuestNames && !allGuestNamesFilled}
						<AlertCircle class="mr-1 inline-block h-4 w-4" />
						{quantity === 1
							? m['ticketConfirmationDialog.hintEnterYourName']()
							: m['ticketConfirmationDialog.hintEnterAllNames']()}
					{:else if isPwyc && !pwycValidation.valid}
						<AlertCircle class="mr-1 inline-block h-4 w-4" />
						{#if pwycValidation.error === 'empty'}
							{m['ticketConfirmationDialog.hintEnterAmount']()}
						{:else if pwycValidation.error === 'invalid'}
							{m['ticketConfirmationDialog.errorValidNumber']()}
						{:else if pwycValidation.error === 'below_min'}
							{m['ticketConfirmationDialog.hintMinAmount']({
								amount: `${tier.currency} ${minAmount.toFixed(2)}`
							})}
						{:else if pwycValidation.error === 'above_max'}
							{m['ticketConfirmationDialog.hintMaxAmount']({
								amount: `${tier.currency} ${maxAmount?.toFixed(2)}`
							})}
						{/if}
					{:else if isUserChoiceSeat && heldSeatIds.length !== quantity}
						<AlertCircle class="mr-1 inline-block h-4 w-4" />
						{quantity - heldSeatIds.length === 1
							? m['ticketConfirmationDialog.hintSelectOneMoreSeat']()
							: m['ticketConfirmationDialog.hintSelectMoreSeats']({
									count: quantity - heldSeatIds.length
								})}
					{:else if mappedBestAvailable && !selectedZoneId}
						<AlertCircle class="mr-1 inline-block h-4 w-4" />
						{m['seatZones.selectHint']()}
					{/if}
				</p>
			{/if}
			<!-- Always-visible total: the buyer must never reach the confirm button
			     without the money in view (the in-flow estimates scroll away). -->
			{#if footerTotal !== null}
				<p class="flex w-full items-center justify-between border-t border-border pt-2 text-sm">
					<span class="text-muted-foreground">{m['checkoutFooter.total']()}</span>
					<span class="text-base font-bold">
						{isFree
							? m['ticketConfirmationDialog.free']()
							: formatMoney(footerTotal, tier.currency)}
					</span>
				</p>
			{/if}
			<div class="flex w-full gap-2 sm:justify-end">
				<Button
					variant="outline"
					onclick={onClose}
					disabled={isProcessing}
					class="flex-1 sm:flex-initial"
				>
					{m['ticketConfirmationDialog.cancel']()}
				</Button>
				<Button
					onclick={handleConfirm}
					disabled={isProcessing || isHoldingSeats || !canSubmit}
					class="flex-1 sm:flex-initial"
				>
					{#if isProcessing || isHoldingSeats}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{#if isOnlinePayment}
							{m['ticketConfirmationDialog.redirectingToPayment']()}
						{:else}
							{m['ticketConfirmationDialog.processing']()}
						{/if}
					{:else if isFree}
						{m['ticketConfirmationDialog.claimTicket']()}
					{:else if isOfflinePayment}
						{m['ticketConfirmationDialog.reserveTicket']()}
					{:else if isPwyc}
						{m['ticketConfirmationDialog.continueToPayment']()}
					{:else}
						{m['ticketConfirmationDialog.proceedToPayment']()}
					{/if}
				</Button>
			</div>
		</DialogFooter>

		<div class="border-t pt-3 text-center text-xs text-muted-foreground">
			<p>{m['ticketConfirmationDialog.agreeToTerms']()}</p>
		</div>
	</DialogContent>
</Dialog>
