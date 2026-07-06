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
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import {
		Ticket,
		DollarSign,
		AlertCircle,
		CreditCard,
		Wallet,
		Plus,
		Minus,
		Loader2
	} from '@lucide/svelte';
	import CancellationPolicySummary from './CancellationPolicySummary.svelte';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type {
		TicketPurchaseItem,
		SeatAssignmentMode,
		SectorAvailabilitySchema,
		DiscountCodeValidationResponse,
		BuyerBillingInfoSchema
	} from '$lib/api/generated/types.gen';
	import { eventpublicticketsGetTierSeatAvailability } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import DiscountCodeInput from './DiscountCodeInput.svelte';
	import CheckoutBillingSection from './CheckoutBillingSection.svelte';
	import GuestNameInputs from './GuestNameInputs.svelte';
	import PwycInput from './PwycInput.svelte';
	import SeatAssignmentSection from './SeatAssignmentSection.svelte';

	interface ConfirmPayload {
		amount?: number;
		tickets: TicketPurchaseItem[];
		discountCode?: string;
		billingInfo?: BuyerBillingInfoSchema;
	}

	interface Props {
		open: boolean;
		tier: TierSchemaWithId;
		/** Event ID for fetching seat availability */
		eventId: string;
		onClose: () => void;
		onConfirm: (payload: ConfirmPayload) => void | Promise<void>;
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
	const seatAssignmentMode = $derived<SeatAssignmentMode>(
		(tier as any).seat_assignment_mode ?? 'none'
	);
	const hasSeatedTier = $derived(seatAssignmentMode !== 'none');
	const isUserChoiceSeat = $derived(seatAssignmentMode === 'user_choice');
	const isRandomSeat = $derived(seatAssignmentMode === 'random');

	// Venue/sector info for display
	const tierVenue = $derived((tier as any).venue ?? null);
	const tierSector = $derived((tier as any).sector ?? null);

	// Seat selection state (for user_choice mode)
	let seatAvailability = $state<SectorAvailabilitySchema | null>(null);
	let isLoadingSeats = $state(false);
	let seatLoadError = $state<string | null>(null);
	let selectedSeatIds = $state<string[]>([]);

	// Fetch seat availability when dialog opens with user_choice mode
	async function fetchSeatAvailability() {
		if (!isUserChoiceSeat || !eventId || !tier.id) return;
		isLoadingSeats = true;
		seatLoadError = null;
		try {
			const response = await eventpublicticketsGetTierSeatAvailability({
				path: { event_id: eventId, tier_id: tier.id },
				headers: authStore.getAuthHeaders()
			});
			if (response.error) {
				seatLoadError = m['ticketConfirmationDialog.errorLoadSeats']();
				console.error('Seat availability error:', response.error);
			} else if (response.data) {
				seatAvailability = response.data;
			}
		} catch (err) {
			seatLoadError = m['ticketConfirmationDialog.errorLoadSeats']();
			console.error('Seat availability fetch error:', err);
		} finally {
			isLoadingSeats = false;
		}
	}

	// Toggle seat selection
	function toggleSeat(seatId: string) {
		seatSelectionError = '';
		const index = selectedSeatIds.indexOf(seatId);
		if (index >= 0) {
			selectedSeatIds = selectedSeatIds.filter((id) => id !== seatId);
		} else if (selectedSeatIds.length < quantity) {
			selectedSeatIds = [...selectedSeatIds, seatId];
		}
	}

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

	// Format price display
	const priceDisplay = $derived.by(() => {
		if (isFree) return m['ticketConfirmationDialog.free']();
		if (isPwyc) {
			const maxDisplay = maxAmount
				? `${tier.currency} ${maxAmount.toFixed(2)}`
				: m['ticketConfirmationDialog.anyAmount']();
			return `${tier.currency} ${minAmount.toFixed(2)} - ${maxDisplay}`;
		}
		const price = typeof tier.price === 'string' ? parseFloat(tier.price) : tier.price;
		return `${tier.currency} ${price.toFixed(2)}`;
	});

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
	const tierMaxTicketsPerUser = $derived<number | null>((tier as any).max_tickets_per_user ?? null);

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

	// PWYC validation state for canSubmit and UI hints
	const pwycValidation = $derived.by(() => {
		if (!isPwyc) return { valid: true, error: null as string | null };
		const trimmed = pwycAmount.trim();
		if (!trimmed) return { valid: false, error: 'empty' as const };
		const value = parseFloat(trimmed);
		if (isNaN(value)) return { valid: false, error: 'invalid' as const };
		if (value < minAmount) return { valid: false, error: 'below_min' as const };
		if (maxAmount !== null && value > maxAmount)
			return { valid: false, error: 'above_max' as const };
		return { valid: true, error: null };
	});

	// Check if form is valid for submission
	const canSubmit = $derived.by(() => {
		if (showGuestNames && !allGuestNamesFilled) return false;
		if (isPwyc && !pwycValidation.valid) return false;
		if (isUserChoiceSeat && selectedSeatIds.length !== quantity) return false;
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
			selectedSeatIds = [];
			seatAvailability = null;
			seatLoadError = null;
			discountResult = null;
			appliedDiscountCode = '';
			discountCodeInputRef?.resetInput(initialDiscountCode, !!initialDiscountCode);
		} else {
			guestNames = [userName || ''];
			if (isUserChoiceSeat) {
				fetchSeatAvailability();
			}
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

	// Adjust seat selection when quantity changes (remove excess selections)
	$effect(() => {
		if (selectedSeatIds.length > quantity) {
			selectedSeatIds = selectedSeatIds.slice(0, quantity);
		}
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
		const errorMap: Record<string, string> = {
			empty: m['ticketConfirmationDialog.errorEnterAmount'](),
			invalid: m['ticketConfirmationDialog.errorValidNumber'](),
			below_min: m['ticketConfirmationDialog.errorMinAmount']({
				amount: `${tier.currency} ${minAmount.toFixed(2)}`
			}),
			above_max: m['ticketConfirmationDialog.errorMaxAmount']({
				amount: `${tier.currency} ${maxAmount?.toFixed(2)}`
			})
		};
		pwycError =
			errorMap[pwycValidation.error ?? ''] ?? m['ticketConfirmationDialog.errorInvalidAmount']();
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

	function extractErrorMessage(err: unknown): string {
		const fallback = m['ticketConfirmationDialog.errorGeneric']();
		if (!err || typeof err !== 'object') return fallback;
		const obj = err as Record<string, unknown>;
		const resp = obj.response as Record<string, unknown> | undefined;
		const data = resp?.data as Record<string, unknown> | undefined;
		if (typeof data?.detail === 'string') return data.detail;
		if (Array.isArray(data?.detail)) {
			return data.detail.map((d: { msg?: string }) => d.msg || String(d)).join(', ');
		}
		if (typeof obj.detail === 'string') return obj.detail;
		if (typeof obj.message === 'string') return obj.message;
		return fallback;
	}

	async function handleConfirm() {
		apiError = '';
		if (!setGuestNameErrorMessage()) return;
		if (!setPwycErrorMessage()) return;

		// Validate billing section if open
		if (billingSection && !billingSection.validate()) return;

		// For user_choice seats, validate seat selection
		if (isUserChoiceSeat && selectedSeatIds.length !== quantity) {
			const remaining = quantity - selectedSeatIds.length;
			seatSelectionError =
				m['ticketConfirmationDialog.selectMoreSeats']?.({ count: remaining }) ??
				`Please select ${remaining} more seat${remaining > 1 ? 's' : ''}`;
			return;
		}
		seatSelectionError = '';

		// Build tickets array. For a hidden single-ticket name input, fall back to
		// the buyer's profile name so guest_name is always non-empty.
		const tickets: TicketPurchaseItem[] = guestNames.map((name, index) => {
			const trimmed = name.trim() || (!showGuestNames ? getDefaultGuestName() : '');
			const ticket: TicketPurchaseItem = { guest_name: trimmed };
			if (isUserChoiceSeat && selectedSeatIds[index]) {
				ticket.seat_id = selectedSeatIds[index];
			}
			return ticket;
		});

		const payload: ConfirmPayload = { tickets };
		if (isPwyc && pwycAmount.trim()) payload.amount = parseFloat(pwycAmount);
		if (appliedDiscountCode && discountResult?.valid) payload.discountCode = appliedDiscountCode;

		// Attach billing info if provided
		const billingInfo = billingSection?.getBillingInfo();
		if (billingInfo) payload.billingInfo = billingInfo;

		try {
			await onConfirm(payload);
		} catch (err: unknown) {
			console.error('Ticket purchase error:', err);
			apiError = extractErrorMessage(err);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !isProcessing) {
			e.preventDefault();
			handleConfirm();
		}
	}

	// Quick amount suggestions for PWYC
	const pwycSuggestions = $derived.by(() => {
		if (maxAmount !== null) {
			return [minAmount, Math.round((minAmount + maxAmount) / 2), maxAmount];
		}
		return [minAmount, minAmount * 2, minAmount * 3];
	});

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
	<DialogContent class="max-h-[90vh] overflow-hidden sm:max-w-lg">
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

		<div class="max-h-[60vh] space-y-4 overflow-y-auto py-2">
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
									{' '}{tier.currency}
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

			<!-- Seat Assignment Info / Selection -->
			<SeatAssignmentSection
				{isUserChoiceSeat}
				{isRandomSeat}
				{hasSeatedTier}
				{tierVenue}
				{tierSector}
				{quantity}
				{selectedSeatIds}
				{seatSelectionError}
				{isLoadingSeats}
				{seatLoadError}
				{seatAvailability}
				onToggleSeat={toggleSeat}
			/>

			<!-- Quantity Selector -->
			{#if showQuantitySelector}
				<div class="space-y-2">
					<Label>{m['ticketConfirmationDialog.numberOfTickets']()}</Label>
					<div class="flex items-center gap-3">
						<Button
							variant="outline"
							size="icon"
							onclick={decrementQuantity}
							disabled={quantity <= 1 || isProcessing}
							aria-label={m['ticketConfirmationDialog.decreaseQuantity']()}
						>
							<Minus class="h-4 w-4" />
						</Button>
						<span class="w-12 text-center text-xl font-bold">{quantity}</span>
						<Button
							variant="outline"
							size="icon"
							onclick={incrementQuantity}
							disabled={quantity >= effectiveMaxQuantity || isProcessing}
							aria-label={m['ticketConfirmationDialog.increaseQuantity']()}
						>
							<Plus class="h-4 w-4" />
						</Button>
						{#if effectiveMaxQuantity < 100}
							<span class="text-sm text-muted-foreground">
								{m['ticketConfirmationDialog.maxHint']({ max: effectiveMaxQuantity })}
							</span>
						{/if}
					</div>
				</div>
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
					suggestions={pwycSuggestions}
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
					{:else if isUserChoiceSeat && selectedSeatIds.length !== quantity}
						<AlertCircle class="mr-1 inline-block h-4 w-4" />
						{quantity - selectedSeatIds.length === 1
							? m['ticketConfirmationDialog.hintSelectOneMoreSeat']()
							: m['ticketConfirmationDialog.hintSelectMoreSeats']({
									count: quantity - selectedSeatIds.length
								})}
					{/if}
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
					disabled={isProcessing || !canSubmit}
					class="flex-1 sm:flex-initial"
				>
					{#if isProcessing}
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
