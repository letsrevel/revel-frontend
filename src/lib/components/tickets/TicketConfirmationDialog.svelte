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
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import {
		Ticket,
		DollarSign,
		AlertCircle,
		CreditCard,
		Wallet,
		Plus,
		Minus,
		User,
		Shuffle,
		DoorOpen,
		Armchair,
		Loader2
	} from 'lucide-svelte';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type {
		TicketPurchaseItem,
		SeatAssignmentMode,
		VenueSeatSchema,
		SectorAvailabilitySchema
	} from '$lib/api/generated/types.gen';
	import { eventpublicticketsGetTierSeatAvailability } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import SeatSelector from './SeatSelector.svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';

	interface ConfirmPayload {
		amount?: number;
		tickets: TicketPurchaseItem[];
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
		userName = ''
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

	// Computed: available seats from the sector
	let availableSeats = $derived<VenueSeatSchema[]>(
		seatAvailability?.seats?.filter((s) => s.available && s.id) ?? []
	);

	// Computed: whether seat selection is valid (enough seats selected for quantity)
	let seatSelectionValid = $derived(!isUserChoiceSeat || selectedSeatIds.length === quantity);

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
		// Clear error when user makes a selection
		seatSelectionError = '';

		const index = selectedSeatIds.indexOf(seatId);
		if (index >= 0) {
			// Deselect
			selectedSeatIds = selectedSeatIds.filter((id) => id !== seatId);
		} else if (selectedSeatIds.length < quantity) {
			// Select (if not at max)
			selectedSeatIds = [...selectedSeatIds, seatId];
		}
	}

	// Check if a seat is selected
	function isSeatSelected(seatId: string): boolean {
		return selectedSeatIds.includes(seatId);
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
		// Start with a large default
		let max = 100;

		// Limit by tier availability (how many tickets are left for this tier)
		if (tier.total_available !== null && tier.total_available > 0) {
			max = Math.min(max, tier.total_available);
		}

		// Limit by effective max per user (tier's or event's max_tickets_per_user)
		if (effectiveMaxPerUser !== null && effectiveMaxPerUser > 0) {
			max = Math.min(max, effectiveMaxPerUser);
		}

		// Limit by user's remaining quota (from backend, considers existing purchases)
		if (maxQuantity !== null && maxQuantity > 0) {
			max = Math.min(max, maxQuantity);
		}

		return Math.max(1, max);
	});

	// Whether to show quantity selector (more than 1 ticket allowed)
	let showQuantitySelector = $derived(effectiveMaxQuantity > 1);

	// Show guest name input only when user can purchase more than one ticket
	// If max is 1, we use the userName automatically
	let showGuestNames = $derived(effectiveMaxQuantity > 1);

	// Check if all guest names are filled (at least the first character)
	let allGuestNamesFilled = $derived(guestNames.every((name) => name.trim().length > 0));

	// PWYC validation state for canSubmit and UI hints
	let pwycValidation = $derived.by(() => {
		if (!isPwyc) return { valid: true, error: null as string | null };

		const trimmed = pwycAmount.trim();
		if (!trimmed) {
			return { valid: false, error: 'empty' as const };
		}

		const value = parseFloat(trimmed);
		if (isNaN(value)) {
			return { valid: false, error: 'invalid' as const };
		}

		if (value < minAmount) {
			return { valid: false, error: 'below_min' as const };
		}

		if (maxAmount !== null && value > maxAmount) {
			return { valid: false, error: 'above_max' as const };
		}

		return { valid: true, error: null };
	});

	// Check if form is valid for submission
	let canSubmit = $derived.by(() => {
		// Must have all guest names filled when showing guest name inputs
		if (showGuestNames && !allGuestNamesFilled) return false;
		// Must have valid PWYC amount when applicable (within range)
		if (isPwyc && !pwycValidation.valid) return false;
		// Must have all seats selected when user_choice mode
		if (isUserChoiceSeat && selectedSeatIds.length !== quantity) return false;
		return true;
	});

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
		} else {
			// Initialize with user's name when dialog opens
			guestNames = [userName || ''];
			// Fetch seat availability if user_choice mode
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
			// Add new entries
			guestNames = [...guestNames, ...Array(newLength - currentLength).fill('')];
		} else if (newLength < currentLength) {
			// Remove extra entries
			guestNames = guestNames.slice(0, newLength);
		}
	});

	// Adjust seat selection when quantity changes (remove excess selections)
	$effect(() => {
		if (selectedSeatIds.length > quantity) {
			selectedSeatIds = selectedSeatIds.slice(0, quantity);
		}
	});

	// Quantity control functions
	function incrementQuantity() {
		if (quantity < effectiveMaxQuantity) {
			quantity++;
		}
	}

	function decrementQuantity() {
		if (quantity > 1) {
			quantity--;
		}
	}

	function updateGuestName(index: number, value: string) {
		guestNames[index] = value;
	}

	// PWYC validation
	function validatePwycAmount(): boolean {
		if (!isPwyc) return true;

		pwycError = '';

		if (!pwycAmount.trim()) {
			pwycError = 'Please enter an amount';
			return false;
		}

		const value = parseFloat(pwycAmount);

		if (isNaN(value)) {
			pwycError = 'Please enter a valid number';
			return false;
		}

		if (value < minAmount) {
			pwycError = `Minimum amount is ${tier.currency} ${minAmount.toFixed(2)}`;
			return false;
		}

		if (maxAmount !== null && value > maxAmount) {
			pwycError = `Maximum amount is ${tier.currency} ${maxAmount.toFixed(2)}`;
			return false;
		}

		return true;
	}

	// Guest names validation
	function validateGuestNames(): boolean {
		guestNameError = '';

		// Only validate if showing guest name inputs
		if (!showGuestNames) return true;

		// Check if any guest name is empty
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

	async function handleConfirm() {
		// Clear any previous API error
		apiError = '';

		// Validate guest names first
		if (!validateGuestNames()) return;

		// For PWYC, validate amount
		if (isPwyc) {
			if (!validatePwycAmount()) return;
		}

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
			const ticket: TicketPurchaseItem = {
				// Use userName when not showing guest names (single ticket purchase with max=1)
				guest_name: showGuestNames ? name.trim() || '' : userName || ''
			};

			// Add seat_id for user_choice mode
			if (isUserChoiceSeat && selectedSeatIds[index]) {
				ticket.seat_id = selectedSeatIds[index];
			}

			return ticket;
		});

		const payload: ConfirmPayload = {
			tickets
		};

		// Add PWYC amount if applicable
		if (isPwyc && pwycAmount.trim()) {
			payload.amount = parseFloat(pwycAmount);
		}

		try {
			await onConfirm(payload);
		} catch (err: unknown) {
			// Handle API errors
			console.error('Ticket purchase error:', err);

			// Extract error message from various error formats
			let errorMessage = 'Something went wrong. Please try again.';

			if (err && typeof err === 'object') {
				const errorObj = err as Record<string, unknown>;

				// Check for response.data.detail (common API error format)
				if (errorObj.response && typeof errorObj.response === 'object') {
					const response = errorObj.response as Record<string, unknown>;
					if (response.data && typeof response.data === 'object') {
						const data = response.data as Record<string, unknown>;
						if (typeof data.detail === 'string') {
							errorMessage = data.detail;
						} else if (Array.isArray(data.detail)) {
							// Pydantic validation errors
							errorMessage = data.detail
								.map((d: { msg?: string }) => d.msg || String(d))
								.join(', ');
						}
					}
				}

				// Check for direct error.detail
				if (typeof errorObj.detail === 'string') {
					errorMessage = errorObj.detail;
				}

				// Check for error.message
				if (
					typeof errorObj.message === 'string' &&
					!errorMessage.includes('Something went wrong')
				) {
					errorMessage = errorObj.message;
				}
			}

			apiError = errorMessage;
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
								{priceDisplay}
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
			{#if isUserChoiceSeat}
				<!-- Seat Selection UI for user_choice mode -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<Label class="flex items-center gap-2">
							<Armchair class="h-4 w-4" />
							{m['ticketConfirmationDialog.selectSeats']?.() ?? 'Select Your Seats'}
						</Label>
						<span class="text-sm text-muted-foreground">
							{selectedSeatIds.length} / {quantity}
							{m['ticketConfirmationDialog.seatsSelected']?.() ?? 'selected'}
						</span>
					</div>

					{#if tierVenue || tierSector}
						<p class="text-sm text-muted-foreground">
							{#if tierVenue}
								<span class="font-medium">{tierVenue.name}</span>
							{/if}
							{#if tierSector}
								<span> - {tierSector.name}</span>
							{/if}
						</p>
					{/if}

					{#if isLoadingSeats}
						<div class="flex items-center justify-center py-8">
							<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
							<span class="ml-2 text-sm text-muted-foreground">
								{m['ticketConfirmationDialog.loadingSeats']?.() ?? 'Loading available seats...'}
							</span>
						</div>
					{:else if seatLoadError}
						<Alert variant="destructive">
							<AlertCircle class="h-4 w-4" />
							<AlertDescription>{seatLoadError}</AlertDescription>
						</Alert>
					{:else if availableSeats.length === 0}
						<Alert>
							<AlertCircle class="h-4 w-4" />
							<AlertDescription>
								{m['ticketConfirmationDialog.noSeatsAvailable']?.() ??
									'No seats available for selection.'}
							</AlertDescription>
						</Alert>
					{:else}
						<!-- Seat Selection Grid -->
						<div class="max-h-64 overflow-y-auto rounded-lg border border-border bg-background p-3">
							<SeatSelector
								seats={seatAvailability?.seats ?? []}
								{selectedSeatIds}
								maxSelectable={quantity}
								onToggle={toggleSeat}
							/>
						</div>
						<!-- Seat Selection Error -->
						{#if seatSelectionError}
							<Alert variant="destructive" class="mt-3">
								<AlertCircle class="h-4 w-4" />
								<AlertDescription>{seatSelectionError}</AlertDescription>
							</Alert>
						{/if}
					{/if}
				</div>
			{:else if hasSeatedTier}
				<div class="rounded-lg border border-border bg-muted/30 p-4">
					<div class="flex items-start gap-3">
						{#if isRandomSeat}
							<Shuffle
								class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500"
								aria-hidden="true"
							/>
							<div class="space-y-1">
								<p class="font-medium text-foreground">
									{m['ticketConfirmationDialog.randomSeatAssignment']?.() ??
										'Random Seat Assignment'}
								</p>
								<p class="text-sm text-muted-foreground">
									{m['ticketConfirmationDialog.randomSeatAssignmentDesc']?.() ??
										'Seats will be randomly assigned to you from the available seats in the designated sector.'}
								</p>
								{#if tierVenue || tierSector}
									<p class="mt-2 text-sm">
										{#if tierVenue}
											<span class="font-medium">{tierVenue.name}</span>
										{/if}
										{#if tierSector}
											<span class="text-muted-foreground">
												{tierVenue ? ' - ' : ''}{tierSector.name}
											</span>
										{/if}
									</p>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{:else if tierVenue}
				<!-- General Entrance with venue info -->
				<div class="rounded-lg border border-border bg-muted/30 p-4">
					<div class="flex items-start gap-3">
						<DoorOpen class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						<div class="space-y-1">
							<p class="font-medium text-foreground">
								{m['ticketConfirmationDialog.generalEntrance']?.() ?? 'General Entrance'}
							</p>
							<p class="text-sm text-muted-foreground">
								{m['ticketConfirmationDialog.generalEntranceDesc']?.() ??
									'This ticket grants general admission without assigned seating.'}
							</p>
							<p class="mt-2 text-sm font-medium">{tierVenue.name}</p>
						</div>
					</div>
				</div>
			{/if}

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
				<div class="space-y-3 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
					<div class="flex items-center gap-2">
						<User class="h-5 w-5 text-primary" aria-hidden="true" />
						<Label class="text-base font-semibold">
							{quantity === 1 ? 'Ticket Holder' : 'Ticket Holders'}
						</Label>
						<span class="text-sm text-destructive">*</span>
					</div>
					<p class="text-sm text-muted-foreground">
						{quantity === 1
							? 'Please enter your name for the ticket'
							: 'Please enter a name for each ticket holder'}
					</p>
					<div class="space-y-2">
						{#each guestNames as name, index (index)}
							<div class="flex items-center gap-2">
								<span
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary"
								>
									{index + 1}
								</span>
								<Input
									type="text"
									value={name}
									oninput={(e) => {
										updateGuestName(index, e.currentTarget.value);
										guestNameError = ''; // Clear error on input
									}}
									placeholder={index === 0 ? 'Your name' : `Guest ${index + 1} name`}
									disabled={isProcessing}
									class="flex-1"
									required
									aria-invalid={guestNameError && !name.trim() ? 'true' : 'false'}
								/>
							</div>
						{/each}
					</div>
					{#if guestNameError}
						<Alert variant="destructive">
							<AlertCircle class="h-4 w-4" />
							<AlertDescription>{guestNameError}</AlertDescription>
						</Alert>
					{/if}
				</div>
			{/if}

			<!-- PWYC Amount Selection -->
			{#if isPwyc}
				<div class="space-y-3">
					<div class="space-y-2">
						<Label for="pwyc-amount">{m['ticketConfirmationDialog.paymentAmount']()}</Label>
						<div class="text-xs text-muted-foreground">
							Range: {tier.currency}
							{minAmount.toFixed(2)} - {maxAmount !== null
								? `${tier.currency} ${maxAmount.toFixed(2)}`
								: 'any amount'}
						</div>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
								{tier.currency}
							</span>
							<Input
								id="pwyc-amount"
								type="number"
								min={minAmount}
								max={maxAmount ?? undefined}
								step="0.01"
								value={pwycAmount}
								oninput={(e) => {
									pwycAmount = e.currentTarget.value;
									pwycError = '';
								}}
								onkeydown={handleKeydown}
								class="pl-12 text-lg font-semibold"
								placeholder={minAmount.toFixed(2)}
								disabled={isProcessing}
								aria-invalid={pwycError || !pwycValidation.valid ? 'true' : 'false'}
								aria-describedby={pwycError ? 'amount-error' : undefined}
							/>
						</div>
						{#if pwycError}
							<p id="amount-error" class="text-sm text-destructive" role="alert">
								{pwycError}
							</p>
						{/if}
					</div>

					<!-- Quick Amount Suggestions -->
					<div class="space-y-2">
						<p class="text-sm font-medium">{m['ticketConfirmationDialog.quickSelect']()}</p>
						<div class="grid grid-cols-3 gap-2">
							{#each pwycSuggestions as suggested (suggested)}
								<Button
									variant="outline"
									size="sm"
									onclick={() => {
										pwycAmount = suggested.toFixed(2);
										pwycError = '';
									}}
									disabled={isProcessing}
								>
									{tier.currency}{suggested.toFixed(2)}
								</Button>
							{/each}
						</div>
					</div>
				</div>
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
