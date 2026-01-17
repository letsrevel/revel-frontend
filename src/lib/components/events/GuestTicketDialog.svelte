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
	import {
		Ticket,
		CheckCircle2,
		AlertCircle,
		CreditCard,
		DollarSign,
		Loader2,
		MapPin,
		Info,
		Plus,
		Minus,
		User
	} from 'lucide-svelte';
	import { guestUserSchema, createGuestPwycSchema } from '$lib/schemas/guestAttendance';
	import {
		eventGuestTicketCheckout,
		eventGuestTicketPwycCheckout,
		eventGetTierSeatAvailability
	} from '$lib/api';
	import { handleGuestAttendanceError } from '$lib/utils/guestAttendance';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type {
		SeatAssignmentMode,
		VenueSeatSchema,
		SectorAvailabilitySchema
	} from '$lib/api/generated/types.gen';
	import SeatSelector from '$lib/components/tickets/SeatSelector.svelte';

	interface Props {
		open: boolean;
		eventId: string;
		eventName: string;
		tier: TierSchemaWithId;
		/** Maximum tickets the guest can purchase (null = unlimited up to tier availability) */
		maxQuantity?: number | null;
		/** Event-level max tickets per user (fallback when tier's max is null) */
		eventMaxTicketsPerUser?: number | null;
		onClose: () => void;
		onSuccess?: () => void;
	}

	let {
		open = $bindable(),
		eventId,
		eventName,
		tier,
		maxQuantity = null,
		eventMaxTicketsPerUser = null,
		onClose,
		onSuccess
	}: Props = $props();

	// Quantity state
	let quantity = $state(1);

	// Guest names array - one for each ticket
	let guestNames = $state<string[]>(['']);

	// Form state (for primary guest - the purchaser)
	let formData = $state<{
		email: string;
		first_name: string;
		last_name: string;
		pwyc?: string;
	}>({
		email: '',
		first_name: '',
		last_name: '',
		pwyc: ''
	});

	// UI state
	let isSubmitting = $state(false);
	let showSuccess = $state(false);
	let errorMessage = $state<string | null>(null);

	// Validation errors
	let fieldErrors = $state<Record<string, string>>({});
	let guestNameError = $state('');

	// Seat selection state
	let seatAvailability = $state<SectorAvailabilitySchema | null>(null);
	let isLoadingSeats = $state(false);
	let seatLoadError = $state<string | null>(null);
	let selectedSeatIds = $state<string[]>([]);
	let seatSelectionError = $state('');

	// Computed values
	let isPwyc = $derived(tier.price_type === 'pwyc');
	let isOnlinePayment = $derived(tier.payment_method === 'online');

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

	// Computed: available seats from the sector
	let availableSeats = $derived<VenueSeatSchema[]>(
		seatAvailability?.seats?.filter((s) => s.available && s.id) ?? []
	);

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

		// Limit by provided max quantity (from parent - considers global event capacity)
		if (maxQuantity !== null && maxQuantity > 0) {
			max = Math.min(max, maxQuantity);
		}

		return Math.max(1, max);
	});

	// Whether to show quantity selector (more than 1 ticket allowed)
	let showQuantitySelector = $derived(effectiveMaxQuantity > 1);

	// Show guest name inputs only when user can purchase more than one ticket
	let showGuestNames = $derived(effectiveMaxQuantity > 1);

	// Check if all guest names are filled
	let allGuestNamesFilled = $derived(guestNames.every((name) => name.trim().length > 0));

	// Computed: whether seat selection is valid (need as many seats as quantity)
	let seatSelectionValid = $derived(!isUserChoiceSeat || selectedSeatIds.length === quantity);

	// PWYC min/max
	let minAmount = $derived(() => {
		if (!isPwyc) return 0;
		if (tier.pwyc_min) {
			return typeof tier.pwyc_min === 'string' ? parseFloat(tier.pwyc_min) : tier.pwyc_min;
		}
		return 1;
	});

	let maxAmount = $derived(() => {
		if (!isPwyc || !tier.pwyc_max) return null;
		return typeof tier.pwyc_max === 'string' ? parseFloat(tier.pwyc_max) : tier.pwyc_max;
	});

	// Fetch seat availability when dialog opens with user_choice mode
	async function fetchSeatAvailability() {
		if (!isUserChoiceSeat || !eventId || !tier.id) return;

		isLoadingSeats = true;
		seatLoadError = null;

		try {
			const response = await eventGetTierSeatAvailability({
				path: { event_id: eventId, tier_id: tier.id }
				// No auth headers for guest users
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
			// Select (up to quantity)
			selectedSeatIds = [...selectedSeatIds, seatId];
		}
	}

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
		// Clear error when user types
		guestNameError = '';
	}

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

	// Reset state when dialog opens/closes
	$effect(() => {
		if (!open) {
			formData = {
				email: '',
				first_name: '',
				last_name: '',
				pwyc: ''
			};
			fieldErrors = {};
			errorMessage = null;
			showSuccess = false;
			guestNameError = '';
			quantity = 1;
			guestNames = [''];
			selectedSeatIds = [];
			seatAvailability = null;
			seatLoadError = null;
			seatSelectionError = '';
		} else {
			// Initialize guest names with primary guest name if available
			const primaryName =
				formData.first_name && formData.last_name
					? `${formData.first_name} ${formData.last_name}`.trim()
					: '';
			guestNames = [primaryName];

			if (isPwyc) {
				// Set default PWYC amount
				formData.pwyc = minAmount().toFixed(2);
			}
			// Fetch seat availability if user_choice mode
			if (isUserChoiceSeat) {
				fetchSeatAvailability();
			}
		}
	});

	// Validate field
	function validateField(field: string) {
		try {
			if (field === 'pwyc' && isPwyc) {
				const schema = createGuestPwycSchema({
					pwyc_min: minAmount(),
					pwyc_max: maxAmount()
				});
				const pwycNumber = parseFloat(formData.pwyc || '0');
				schema.shape.pwyc.parse(pwycNumber);
				fieldErrors.pwyc = '';
			} else {
				const fieldSchema = (guestUserSchema.shape as any)[field];
				if (fieldSchema) {
					fieldSchema.parse((formData as any)[field]);
					fieldErrors[field] = '';
				}
			}
		} catch (error: any) {
			if (error.errors && error.errors.length > 0) {
				fieldErrors[field] = error.errors[0].message;
			}
		}
	}

	function handleBlur(field: string) {
		validateField(field);
	}

	// Validate entire form
	function validateForm(): boolean {
		fieldErrors = {};
		errorMessage = null;

		try {
			if (isPwyc) {
				const schema = createGuestPwycSchema({
					pwyc_min: minAmount(),
					pwyc_max: maxAmount()
				});
				const pwycNumber = parseFloat(formData.pwyc || '0');
				schema.parse({
					email: formData.email,
					first_name: formData.first_name,
					last_name: formData.last_name,
					pwyc: pwycNumber
				});
			} else {
				guestUserSchema.parse({
					email: formData.email,
					first_name: formData.first_name,
					last_name: formData.last_name
				});
			}
			return true;
		} catch (error: any) {
			if (error.errors) {
				error.errors.forEach((err: any) => {
					const field = err.path[0];
					if (!fieldErrors[field]) {
						fieldErrors[field] = err.message;
					}
				});
			}
			return false;
		}
	}

	// Validate guest names
	function validateGuestNames(): boolean {
		guestNameError = '';

		// Only validate if showing guest name inputs (multi-ticket)
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

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!validateForm()) return;

		// Validate guest names
		if (!validateGuestNames()) return;

		// Validate seat selection for user_choice mode
		if (isUserChoiceSeat && selectedSeatIds.length !== quantity) {
			const remaining = quantity - selectedSeatIds.length;
			seatSelectionError = `Please select ${remaining} more seat${remaining > 1 ? 's' : ''}`;
			return;
		}
		seatSelectionError = '';

		isSubmitting = true;
		errorMessage = null;

		try {
			let response;

			// Build tickets array - one for each ticket
			const tickets = guestNames.map((name, index) => {
				// For single ticket (no guest names shown), use primary guest name
				const guestName = showGuestNames
					? name.trim()
					: `${formData.first_name} ${formData.last_name}`.trim();

				const ticket: any = {
					guest_name: guestName
				};

				// Add seat_id for user_choice mode
				if (isUserChoiceSeat && selectedSeatIds[index]) {
					ticket.seat_id = selectedSeatIds[index];
				} else {
					ticket.seat_id = null;
				}

				return ticket;
			});

			if (isPwyc) {
				// PWYC checkout
				const pwycNumber = parseFloat(formData.pwyc || '0');
				response = await eventGuestTicketPwycCheckout({
					path: { event_id: eventId, tier_id: tier.id },
					body: {
						email: formData.email,
						first_name: formData.first_name,
						last_name: formData.last_name,
						tickets,
						price_per_ticket: pwycNumber
					}
				});
			} else {
				// Fixed-price checkout
				response = await eventGuestTicketCheckout({
					path: { event_id: eventId, tier_id: tier.id },
					body: {
						email: formData.email,
						first_name: formData.first_name,
						last_name: formData.last_name,
						tickets
					}
				});
			}

			// Check response type
			if (response.data && 'checkout_url' in response.data && response.data.checkout_url) {
				// Online payment - redirect to Stripe
				window.location.href = response.data.checkout_url;
			} else if (response.data && 'message' in response.data && response.data.message) {
				// Email confirmation flow - show success
				showSuccess = true;
				onSuccess?.();
			} else if (response.data && 'tickets' in response.data) {
				// Free tickets confirmed immediately
				showSuccess = true;
				onSuccess?.();
			} else {
				// Fallback - show success
				showSuccess = true;
				onSuccess?.();
			}
		} catch (error: any) {
			errorMessage = handleGuestAttendanceError(error);
		} finally {
			isSubmitting = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !isSubmitting && !showSuccess) {
			e.preventDefault();
			// Create a synthetic submit event
			const form = (e.target as HTMLElement).closest('form');
			if (form) {
				form.requestSubmit();
			}
		}
	}

	// Quick PWYC suggestions
	function getSuggestions(min: number, max: number | null): number[] {
		if (max !== null) {
			return [min, Math.round((min + max) / 2), max];
		}
		return [min, min * 2, min * 3];
	}
</script>

<Dialog bind:open>
	<DialogContent class="flex max-h-[90vh] flex-col sm:max-w-lg">
		<DialogHeader class="shrink-0">
			<DialogTitle class="flex items-center gap-2 text-xl">
				<Ticket class="h-5 w-5 text-primary" aria-hidden="true" />
				{m['guest_attendance.ticket_title']()}
			</DialogTitle>
			<DialogDescription>
				{m['guest_attendance.ticket_description']()}
			</DialogDescription>
		</DialogHeader>

		{#if showSuccess}
			<!-- Success State (Email Confirmation) -->
			<div class="space-y-4 py-6">
				<div class="flex flex-col items-center justify-center space-y-3 text-center">
					<div class="rounded-full bg-primary/10 p-3">
						<CheckCircle2 class="h-8 w-8 text-primary" aria-hidden="true" />
					</div>
					<div class="space-y-1">
						<h3 class="text-lg font-semibold">{m['guest_attendance.ticket_email_sent_title']()}</h3>
						<p class="text-sm text-muted-foreground">
							{m['guest_attendance.ticket_email_sent_body']({ email: formData.email })}
						</p>
					</div>
				</div>
			</div>

			<DialogFooter>
				<Button onclick={onClose} class="w-full">
					{m['guest_attendance.common_close']()}
				</Button>
			</DialogFooter>
		{:else}
			<!-- Form State -->
			<form onsubmit={handleSubmit} class="flex min-h-0 flex-1 flex-col">
				<div class="min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1">
					<!-- Tier Info Card -->
					<div class="rounded-lg border border-border bg-muted/50 p-4">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1 space-y-1">
								<h3 class="font-semibold">{tier.name}</h3>
								{#if tier.description}
									<p class="text-sm text-muted-foreground">{tier.description}</p>
								{/if}
								{#if !isPwyc}
									<p class="text-lg font-bold text-primary">
										{tier.currency}
										{parseFloat(tier.price).toFixed(2)}
									</p>
								{/if}
							</div>
							<Ticket class="h-8 w-8 shrink-0 text-muted-foreground" aria-hidden="true" />
						</div>
					</div>

					<!-- Quantity Selector (if applicable) -->
					{#if showQuantitySelector}
						<div class="space-y-2">
							<Label for="quantity">Number of Tickets</Label>
							<div class="flex items-center gap-3">
								<Button
									type="button"
									variant="outline"
									size="icon"
									onclick={decrementQuantity}
									disabled={quantity <= 1 || isSubmitting}
									aria-label="Decrease quantity"
								>
									<Minus class="h-4 w-4" />
								</Button>
								<div
									class="flex h-10 w-16 items-center justify-center rounded-md border border-border bg-background"
								>
									<span class="text-lg font-semibold">{quantity}</span>
								</div>
								<Button
									type="button"
									variant="outline"
									size="icon"
									onclick={incrementQuantity}
									disabled={quantity >= effectiveMaxQuantity || isSubmitting}
									aria-label="Increase quantity"
								>
									<Plus class="h-4 w-4" />
								</Button>
								<span class="text-sm text-muted-foreground">
									{#if effectiveMaxQuantity < 100}
										(Max: {effectiveMaxQuantity})
									{/if}
								</span>
							</div>
							{#if !isPwyc}
								<p class="text-sm font-semibold text-primary">
									Total: {tier.currency}
									{(
										quantity *
										(typeof tier.price === 'string' ? parseFloat(tier.price) : tier.price || 0)
									).toFixed(2)}
								</p>
							{/if}
						</div>
					{/if}

					<!-- Email Field -->
					<div class="space-y-2">
						<Label for="guest-ticket-email">{m['guest_attendance.email_label']()}</Label>
						<Input
							id="guest-ticket-email"
							type="email"
							bind:value={formData.email}
							onkeydown={handleKeydown}
							onblur={() => handleBlur('email')}
							placeholder={m['guest_attendance.email_placeholder']()}
							disabled={isSubmitting}
							aria-invalid={fieldErrors.email ? 'true' : 'false'}
							aria-describedby={fieldErrors.email
								? 'ticket-email-error ticket-email-hint'
								: 'ticket-email-hint'}
							autocomplete="email"
							required
						/>
						<p id="ticket-email-hint" class="text-xs text-muted-foreground">
							{m['guest_attendance.email_hint']()}
						</p>
						{#if fieldErrors.email}
							<p id="ticket-email-error" class="text-sm text-destructive" role="alert">
								{fieldErrors.email}
							</p>
						{/if}
					</div>

					<!-- First Name and Last Name -->
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<Label for="guest-ticket-first-name">{m['guest_attendance.first_name_label']()}</Label
							>
							<Input
								id="guest-ticket-first-name"
								type="text"
								bind:value={formData.first_name}
								onkeydown={handleKeydown}
								onblur={() => handleBlur('first_name')}
								placeholder={m['guest_attendance.first_name_placeholder']()}
								disabled={isSubmitting}
								aria-invalid={fieldErrors.first_name ? 'true' : 'false'}
								aria-describedby={fieldErrors.first_name ? 'ticket-first-name-error' : undefined}
								autocomplete="given-name"
								required
							/>
							{#if fieldErrors.first_name}
								<p id="ticket-first-name-error" class="text-sm text-destructive" role="alert">
									{fieldErrors.first_name}
								</p>
							{/if}
						</div>

						<div class="space-y-2">
							<Label for="guest-ticket-last-name">{m['guest_attendance.last_name_label']()}</Label>
							<Input
								id="guest-ticket-last-name"
								type="text"
								bind:value={formData.last_name}
								onkeydown={handleKeydown}
								onblur={() => handleBlur('last_name')}
								placeholder={m['guest_attendance.last_name_placeholder']()}
								disabled={isSubmitting}
								aria-invalid={fieldErrors.last_name ? 'true' : 'false'}
								aria-describedby={fieldErrors.last_name ? 'ticket-last-name-error' : undefined}
								autocomplete="family-name"
								required
							/>
							{#if fieldErrors.last_name}
								<p id="ticket-last-name-error" class="text-sm text-destructive" role="alert">
									{fieldErrors.last_name}
								</p>
							{/if}
						</div>
					</div>

					<!-- Guest Names for Each Ticket (if applicable) -->
					{#if showGuestNames}
						<div class="space-y-3">
							<div class="flex items-center gap-2">
								<User class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
								<Label class="text-base font-semibold">Ticket Holder Names</Label>
							</div>
							<p class="text-sm text-muted-foreground">
								Enter the name for each ticket holder (will be printed on their ticket)
							</p>
							<div class="space-y-3">
								{#each guestNames as name, index (index)}
									<div class="space-y-2">
										<Label for="guest-name-{index}">
											{index === 0 ? 'Your Name' : `Guest ${index + 1} Name`}
										</Label>
										<Input
											id="guest-name-{index}"
											type="text"
											value={name}
											oninput={(e) => updateGuestName(index, e.currentTarget.value)}
											placeholder={index === 0
												? `${formData.first_name} ${formData.last_name}`.trim() || 'Your name'
												: `Guest ${index + 1} name`}
											disabled={isSubmitting}
											required
										/>
									</div>
								{/each}
								{#if guestNameError}
									<p class="text-sm text-destructive" role="alert">
										{guestNameError}
									</p>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Seat Selection (if applicable) -->
					{#if isUserChoiceSeat}
						<div class="space-y-3">
							<!-- Venue/Sector Info -->
							{#if tierVenue || tierSector}
								<div class="rounded-lg border border-border bg-muted/30 p-3">
									<div class="flex items-start gap-2 text-sm text-muted-foreground">
										<MapPin class="h-4 w-4 shrink-0" aria-hidden="true" />
										<div class="space-y-0.5">
											{#if tierVenue}
												<div class="font-medium text-foreground">{tierVenue.name}</div>
											{/if}
											{#if tierSector}
												<div>
													{tierSector.name}
													{#if tierSector.description}
														<span class="text-xs">({tierSector.description})</span>
													{/if}
												</div>
											{/if}
										</div>
									</div>
								</div>
							{/if}

							<!-- Seat selection UI -->
							<div class="space-y-2">
								<Label>Select Your Seat</Label>
								{#if isLoadingSeats}
									<div class="flex items-center justify-center py-12">
										<Loader2 class="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
									</div>
								{:else if seatLoadError}
									<Alert variant="destructive">
										<AlertCircle class="h-4 w-4" />
										<AlertDescription>{seatLoadError}</AlertDescription>
									</Alert>
								{:else if availableSeats.length === 0}
									<Alert>
										<AlertCircle class="h-4 w-4" />
										<AlertDescription>No seats available for this tier</AlertDescription>
									</Alert>
								{:else}
									<SeatSelector
										seats={availableSeats}
										{selectedSeatIds}
										maxSelectable={quantity}
										onToggle={toggleSeat}
									/>
									{#if quantity > 1}
										<p class="text-sm text-muted-foreground">
											Selected {selectedSeatIds.length} of {quantity} seat{quantity > 1 ? 's' : ''}
										</p>
									{/if}
									{#if seatSelectionError}
										<p class="text-sm text-destructive" role="alert">
											{seatSelectionError}
										</p>
									{/if}
								{/if}
							</div>
						</div>
					{:else if isRandomSeat}
						<!-- Random seat assignment info -->
						<Alert>
							<Info class="h-4 w-4" />
							<AlertDescription>
								A seat will be randomly assigned to you after checkout.
							</AlertDescription>
						</Alert>
					{/if}

					<!-- PWYC Amount (if applicable) -->
					{#if isPwyc}
						<div class="space-y-3">
							<div class="space-y-2">
								<Label for="pwyc-amount">{m['guest_attendance.pwyc_label']()}</Label>
								<div class="text-xs text-muted-foreground">
									{maxAmount() !== null
										? m['guest_attendance.pwyc_hint']({ min: minAmount(), max: maxAmount()! })
										: m['guest_attendance.pwyc_hint_no_max']({ min: minAmount() })}
								</div>
								<div class="relative">
									<span
										class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
									>
										{tier.currency}
									</span>
									<Input
										id="pwyc-amount"
										type="number"
										min={minAmount()}
										max={maxAmount() ?? undefined}
										step="0.01"
										bind:value={formData.pwyc}
										onkeydown={handleKeydown}
										onblur={() => handleBlur('pwyc')}
										class="pl-12 text-lg font-semibold"
										placeholder={minAmount().toFixed(2)}
										disabled={isSubmitting}
										aria-invalid={fieldErrors.pwyc ? 'true' : 'false'}
										aria-describedby={fieldErrors.pwyc ? 'pwyc-error' : undefined}
									/>
								</div>
								{#if fieldErrors.pwyc}
									<p id="pwyc-error" class="text-sm text-destructive" role="alert">
										{fieldErrors.pwyc}
									</p>
								{/if}
							</div>

							<!-- Quick Amount Suggestions -->
							<div class="space-y-2">
								<p class="text-sm font-medium">Quick Select</p>
								<div class="grid grid-cols-3 gap-2">
									{#each getSuggestions(minAmount(), maxAmount()) as suggested}
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => {
												formData.pwyc = suggested.toFixed(2);
												fieldErrors.pwyc = '';
											}}
											disabled={isSubmitting}
										>
											{tier.currency}{suggested.toFixed(2)}
										</Button>
									{/each}
								</div>
							</div>
						</div>
					{/if}

					<!-- Online Payment Notice -->
					{#if isOnlinePayment}
						<Alert>
							<CreditCard class="h-4 w-4" />
							<AlertDescription>
								<p class="text-sm">
									You'll be redirected to our secure payment provider to complete your purchase.
								</p>
							</AlertDescription>
						</Alert>
					{/if}

					<!-- Error Message -->
					{#if errorMessage}
						<Alert variant="destructive">
							<AlertCircle class="h-4 w-4" />
							<AlertDescription>
								{errorMessage}
							</AlertDescription>
						</Alert>
					{/if}
				</div>

				<div class="shrink-0">
					<DialogFooter class="gap-2 pt-4 sm:gap-0">
						<Button
							type="button"
							variant="outline"
							onclick={onClose}
							disabled={isSubmitting}
							class="flex-1 sm:flex-initial"
						>
							{m['guest_attendance.common_cancel']()}
						</Button>
						<Button type="submit" disabled={isSubmitting} class="flex-1 sm:flex-initial">
							{#if isSubmitting}
								{m['guest_attendance.submitting']()}
							{:else}
								{m['guest_attendance.submit_ticket']()}
							{/if}
						</Button>
					</DialogFooter>

					<!-- Subtle login link -->
					<div class="border-t pt-3 text-center text-xs text-muted-foreground">
						<p>
							{@html m['guest_attendance.or_login']()
								.replace('<a>', '<a href="/login" class="text-primary hover:underline">')
								.replace('</a>', '</a>')}
						</p>
					</div>
				</div>
			</form>
		{/if}
	</DialogContent>
</Dialog>
