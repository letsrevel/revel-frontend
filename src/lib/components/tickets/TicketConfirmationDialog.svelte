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
	} from 'lucide-svelte';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type {
		TicketPurchaseItem,
		SeatAssignmentMode,
		SectorAvailabilitySchema,
		DiscountCodeValidationResponse
	} from '$lib/api/generated/types.gen';
	import { eventpublicticketsGetTierSeatAvailability } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import DiscountCodeInput from './DiscountCodeInput.svelte';
	import GuestNameInputs from './GuestNameInputs.svelte';
	import PwycInput from './PwycInput.svelte';
	import SeatAssignmentSection from './SeatAssignmentSection.svelte';

	interface ConfirmPayload {
		amount?: number;
		tickets: TicketPurchaseItem[];
		discountCode?: string;
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

	// Discount code state
	let discountResult = $state<DiscountCodeValidationResponse | null>(null);
	let appliedDiscountCode = $state('');

	// Whether discount codes are applicable (not for free/PWYC tiers)
	let discountApplicable = $derived(tier.payment_method !== 'free' && tier.price_type !== 'pwyc');

	// Computed values
	let isPwyc = $derived(tier.price_type === 'pwyc');
	let isFree = $derived(tier.payment_method === 'free');
	let isOnlinePayment = $derived(tier.payment_method === 'online');
	let isOfflinePayment = $derived(
		tier.payment_method === 'offline' || tier.payment_method === 'at_the_door'
	);

	// Seat assignment mode
	let seatAssignmentMode = $derived<SeatAssignmentMode>(
		(tier as any).seat_assignment_mode ?? 'none'
	);
	let hasSeatedTier = $derived(seatAssignmentMode !== 'none');
	let isUserChoiceSeat = $derived(seatAssignmentMode === 'user_choice');
	let isRandomSeat = $derived(seatAssignmentMode === 'random');

	// Venue/sector info for display
	let tierVenue = $derived((tier as any).venue ?? null);
	let tierSector = $derived((tier as any).sector ?? null);

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
				seatLoadError = 'Failed to load available seats';
				console.error('Seat availability error:', response.error);
			} else if (response.data) {
				seatAvailability = response.data;
			}
		} catch (err) {
			seatLoadError = 'Failed to load available seats';
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
	let minAmount = $derived.by(() => {
		if (!isPwyc) return 0;
		if (tier.pwyc_min) {
			return typeof tier.pwyc_min === 'string' ? parseFloat(tier.pwyc_min) : tier.pwyc_min;
		}
		return 1;
	});

	let maxAmount = $derived.by(() => {
		if (!isPwyc || !tier.pwyc_max) return null;
		return typeof tier.pwyc_max === 'string' ? parseFloat(tier.pwyc_max) : tier.pwyc_max;
	});

	// Format price display
	let priceDisplay = $derived.by(() => {
		if (isFree) return 'Free';
		if (isPwyc) {
			const maxDisplay = maxAmount ? `${tier.currency} ${maxAmount.toFixed(2)}` : 'any amount';
			return `${tier.currency} ${minAmount.toFixed(2)} - ${maxDisplay}`;
		}
		const price = typeof tier.price === 'string' ? parseFloat(tier.price) : tier.price;
		return `${tier.currency} ${price.toFixed(2)}`;
	});

	// Dialog title
	let dialogTitle = $derived.by(() => {
		if (isFree) return 'Claim Free Ticket';
		if (isOfflinePayment) return 'Reserve Ticket';
		if (isPwyc) return 'Get Your Ticket';
		return 'Confirm Purchase';
	});

	// Dialog icon component
	let dialogIcon = $derived.by(() => {
		if (isFree) return Ticket;
		if (isOfflinePayment) return Wallet;
		if (isOnlinePayment) return CreditCard;
		return DollarSign;
	});

	// Tier-level max tickets per user (can override event-level setting)
	let tierMaxTicketsPerUser = $derived<number | null>((tier as any).max_tickets_per_user ?? null);

	// Effective max per user: use tier's value if set, otherwise fall back to event-level
	let effectiveMaxPerUser = $derived<number | null>(
		tierMaxTicketsPerUser !== null ? tierMaxTicketsPerUser : eventMaxTicketsPerUser
	);

	// Calculated max quantity based on tier availability, tier limit, and user limit
	let effectiveMaxQuantity = $derived.by(() => {
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
	let showQuantitySelector = $derived(effectiveMaxQuantity > 1);

	// Always show guest name inputs so users can verify/edit their name
	let showGuestNames = true;

	// Check if all guest names are filled (at least the first character)
	let allGuestNamesFilled = $derived(guestNames.every((name) => name.trim().length > 0));

	// PWYC validation state for canSubmit and UI hints
	let pwycValidation = $derived.by(() => {
		if (!isPwyc) return { valid: true, error: null as string | null };
		const trimmed = pwycAmount.trim();
		if (!trimmed) return { valid: false, error: 'empty' as const };
		const value = parseFloat(trimmed);
		if (isNaN(value)) return { valid: false, error: 'invalid' as const };
		if (value < minAmount) return { valid: false, error: 'below_min' as const };
		if (maxAmount !== null && value > maxAmount) return { valid: false, error: 'above_max' as const };
		return { valid: true, error: null };
	});

	// Check if form is valid for submission
	let canSubmit = $derived.by(() => {
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
			empty: 'Please enter an amount',
			invalid: 'Please enter a valid number',
			below_min: `Minimum amount is ${tier.currency} ${minAmount.toFixed(2)}`,
			above_max: `Maximum amount is ${tier.currency} ${maxAmount?.toFixed(2)}`
		};
		pwycError = errorMap[pwycValidation.error ?? ''] ?? 'Invalid amount';
		return false;
	}

	// Set guest name error message based on validation state
	function setGuestNameErrorMessage(): boolean {
		guestNameError = '';
		const emptyIndex = guestNames.findIndex((name) => !name.trim());
		if (emptyIndex >= 0) {
			guestNameError =
				emptyIndex === 0
					? 'Please enter your name'
					: `Please enter a name for ticket holder ${emptyIndex + 1}`;
			return false;
		}
		return true;
	}

	function extractErrorMessage(err: unknown): string {
		const fallback = 'Something went wrong. Please try again.';
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

		// For user_choice seats, validate seat selection
		if (isUserChoiceSeat && selectedSeatIds.length !== quantity) {
			const remaining = quantity - selectedSeatIds.length;
			seatSelectionError =
				m['ticketConfirmationDialog.selectMoreSeats']?.({ count: remaining }) ??
				`Please select ${remaining} more seat${remaining > 1 ? 's' : ''}`;
			return;
		}
		seatSelectionError = '';

		// Build tickets array
		const tickets: TicketPurchaseItem[] = guestNames.map((name, index) => {
			const ticket: TicketPurchaseItem = { guest_name: name.trim() };
			if (isUserChoiceSeat && selectedSeatIds[index]) {
				ticket.seat_id = selectedSeatIds[index];
			}
			return ticket;
		});

		const payload: ConfirmPayload = { tickets };
		if (isPwyc && pwycAmount.trim()) payload.amount = parseFloat(pwycAmount);
		if (appliedDiscountCode && discountResult?.valid) payload.discountCode = appliedDiscountCode;

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
	let pwycSuggestions = $derived.by(() => {
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
	let originalPrice = $derived.by(() => {
		if (isFree || isPwyc) return 0;
		return typeof tier.price === 'string' ? parseFloat(tier.price) : (tier.price ?? 0);
	});

	let discountedPrice = $derived.by(() => {
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
					Confirm that you'd like to claim this free ticket for the event.
				{:else if isOfflinePayment}
					Reserve your spot and complete payment {tier.payment_method === 'at_the_door'
						? 'at the door'
						: 'offline'}.
				{:else if isPwyc}
					Choose how much you'd like to pay for your ticket.
				{:else}
					Confirm your purchase. You'll be redirected to complete payment.
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
					<Label>Number of Tickets</Label>
					<div class="flex items-center gap-3">
						<Button
							variant="outline"
							size="icon"
							onclick={decrementQuantity}
							disabled={quantity <= 1 || isProcessing}
							aria-label="Decrease quantity"
						>
							<Minus class="h-4 w-4" />
						</Button>
						<span class="w-12 text-center text-xl font-bold">{quantity}</span>
						<Button
							variant="outline"
							size="icon"
							onclick={incrementQuantity}
							disabled={quantity >= effectiveMaxQuantity || isProcessing}
							aria-label="Increase quantity"
						>
							<Plus class="h-4 w-4" />
						</Button>
						{#if effectiveMaxQuantity < 100}
							<span class="text-sm text-muted-foreground">
								(max {effectiveMaxQuantity})
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

			<!-- Online Payment Notice -->
			{#if isOnlinePayment && !isPwyc}
				<Alert>
					<CreditCard class="h-4 w-4" />
					<AlertDescription>
						<p class="text-sm">
							You'll be redirected to our secure payment provider to complete your purchase.
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
							Only {tier.total_available} ticket{tier.total_available === 1 ? '' : 's'} remaining!
						</p>
					</AlertDescription>
				</Alert>
			{/if}

			<!-- API Error Display -->
			{#if apiError}
				<Alert variant="destructive">
					<AlertCircle class="h-4 w-4" />
					<AlertDescription>
						<p class="font-medium">Unable to complete request</p>
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
							? 'Please enter your name above'
							: 'Please enter names for all ticket holders above'}
					{:else if isPwyc && !pwycValidation.valid}
						<AlertCircle class="mr-1 inline-block h-4 w-4" />
						{#if pwycValidation.error === 'empty'}
							Please enter a payment amount
						{:else if pwycValidation.error === 'invalid'}
							Please enter a valid number
						{:else if pwycValidation.error === 'below_min'}
							Amount must be at least {tier.currency} {minAmount.toFixed(2)}
						{:else if pwycValidation.error === 'above_max'}
							Amount cannot exceed {tier.currency} {maxAmount?.toFixed(2)}
						{/if}
					{:else if isUserChoiceSeat && selectedSeatIds.length !== quantity}
						<AlertCircle class="mr-1 inline-block h-4 w-4" />
						Please select {quantity - selectedSeatIds.length} more seat{quantity -
							selectedSeatIds.length >
						1
							? 's'
							: ''}
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
					Cancel
				</Button>
				<Button
					onclick={handleConfirm}
					disabled={isProcessing || !canSubmit}
					class="flex-1 sm:flex-initial"
				>
					{#if isProcessing}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{#if isOnlinePayment}
							Redirecting to payment...
						{:else}
							Processing...
						{/if}
					{:else if isFree}
						Claim Ticket
					{:else if isOfflinePayment}
						Reserve Ticket
					{:else if isPwyc}
						Continue to Payment
					{:else}
						Proceed to Payment
					{/if}
				</Button>
			</div>
		</DialogFooter>

		<div class="border-t pt-3 text-center text-xs text-muted-foreground">
			<p>{m['ticketConfirmationDialog.agreeToTerms']()}</p>
		</div>
	</DialogContent>
</Dialog>
