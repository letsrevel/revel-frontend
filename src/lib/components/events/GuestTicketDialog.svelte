<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';
	import { Ticket } from '@lucide/svelte';
	import { z } from 'zod';
	import {
		guestUserSchema,
		createGuestPwycSchema,
		type GuestTicketFormData
	} from '$lib/schemas/guestAttendance';
	import {
		eventpublicguestGuestTicketCheckout,
		eventpublicguestGuestTicketPwycCheckout
	} from '$lib/api';
	import { handleGuestAttendanceError } from '$lib/utils/guestAttendance';
	import { releaseAnonymousHolds } from '$lib/utils/seat-holds';
	import type { SeatHoldController } from '$lib/components/tickets/seat-hold-controller.svelte';
	import {
		createCheckoutSession,
		createReservationRetry,
		CheckoutSessionError
	} from '$lib/utils/checkout-session';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type { SeatAssignmentMode, TicketPurchaseItem } from '$lib/api/generated/types.gen';
	import CheckoutBillingSection from '$lib/components/tickets/CheckoutBillingSection.svelte';
	import { bestAvailableFailureMessage } from '$lib/components/tickets/purchase-error';
	import { isMappedBestAvailable } from '$lib/components/tickets/seat-zones';
	import { checkoutTotal } from '$lib/components/tickets/checkout-total';
	import { pwycSuggestions } from '$lib/components/tickets/pwyc-validation';
	import {
		GUEST_COMPATIBLE_STEPS,
		guestCheckoutBody,
		guestNamesError,
		guestCheckoutFingerprint,
		guestPwycCheckoutBody,
		type GuestCheckoutArgs
	} from './guest-checkout-payload';
	import { authStore } from '$lib/stores/auth.svelte';
	import GuestTicketSuccess from './GuestTicketSuccess.svelte';
	import GuestTicketTierInfo from './GuestTicketTierInfo.svelte';
	import GuestTicketOnlinePaymentNotice from './GuestTicketOnlinePaymentNotice.svelte';
	import GuestTicketQuantitySelector from './GuestTicketQuantitySelector.svelte';
	import GuestTicketIdentityFields from './GuestTicketIdentityFields.svelte';
	import GuestTicketNameInputs from './GuestTicketNameInputs.svelte';
	import GuestTicketSeatSection from './GuestTicketSeatSection.svelte';
	import GuestTicketPwycSection from './GuestTicketPwycSection.svelte';
	import GuestTicketErrorAlert from './GuestTicketErrorAlert.svelte';
	import GuestTicketFooter from './GuestTicketFooter.svelte';

	interface Props {
		open: boolean;
		eventId: string;
		tier: TierSchemaWithId;
		/** All event tiers: enables whole-venue switch targets on the seat map. */
		allTiers?: TierSchemaWithId[] | null;
		/** Buyer confirmed a section switch: reopen this dialog on the other tier. */
		onSwitchTier?: (tier: TierSchemaWithId) => void;
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
		tier,
		allTiers = null,
		onSwitchTier = undefined,
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
	let formData = $state<GuestTicketFormData>({
		email: '',
		first_name: '',
		last_name: '',
		pwyc: ''
	});

	// UI state
	let isSubmitting = $state(false);
	let showSuccess = $state(false);
	let errorMessage = $state<string | null>(null);
	let requiresAccount = $state(false);

	// Two-step online checkout (#464): the reserve call holds capacity and the
	// session call fetches the Stripe URL. When the session step fails, the
	// reservation handle is kept (keyed by the purchase parameters) so an
	// IDENTICAL resubmit replays only the idempotent session call — while an
	// edited submit (different amount/names/billing) reserves afresh instead
	// of resuming a reservation priced with the old parameters.
	const reservationRetry = createReservationRetry('guest');

	// Billing section
	let billingSection: CheckoutBillingSection | undefined = $state();
	const invoicingAvailable = $derived(!!tier.invoicing_available);

	// Validation errors
	let fieldErrors = $state<Record<string, string>>({});
	let guestNameError = $state('');

	// Seat selection IS the caller's server-side hold (#657): the controller is
	// instantiated by GuestTicketSeatSection and handed up for submit/close.
	let seatController = $state<SeatHoldController | null>(null);
	const heldSeatIds = $derived(seatController?.myHolds ?? []);
	let seatSelectionError = $state('');
	let accessibleRequired = $state(false);
	let bestAvailableError = $state('');
	// Mapped best-available tier: the buyer must name a zone — no default, even
	// with a single zone; it rides on every hold/checkout request.
	let selectedZoneId = $state<string | null>(null);
	// Set when checkout took over the holds (they must NOT be released on close):
	// online reserve consumes them; the email flow keeps them for confirmation.
	let purchaseHandedOff = false;

	// Computed values
	const isPwyc = $derived(tier.price_type === 'pwyc');
	const isOnlinePayment = $derived(tier.payment_method === 'online');

	// Seat assignment mode ('random' was removed in seating phase 1; legacy tiers
	// were migrated server-side to best_available or user_choice)
	const seatAssignmentMode = $derived<SeatAssignmentMode>(tier.seat_assignment_mode ?? 'none');
	const isUserChoiceSeat = $derived(seatAssignmentMode === 'user_choice');
	const isBestAvailableSeat = $derived(seatAssignmentMode === 'best_available');
	const mappedBestAvailable = $derived(isBestAvailableSeat && isMappedBestAvailable(tier));
	const hasSeatSection = $derived(isUserChoiceSeat || isBestAvailableSeat);

	// Running total pinned in the sticky footer (see checkout-total.ts).
	const footerTotal = $derived(
		checkoutTotal({
			tier,
			quantity,
			heldSeatIds,
			chart: seatController?.chartQuery.data ?? null,
			selectedZoneId,
			pwycAmount: formData.pwyc ?? '',
			discountedPrice: null
		})
	);

	// Venue/sector info for display
	const tierVenue = $derived(tier.venue ?? null);
	const tierSector = $derived(tier.sector ?? null);

	// Tier-level max tickets per user (can override event-level setting)
	const tierMaxTicketsPerUser = $derived<number | null>(tier.max_tickets_per_user ?? null);

	// Effective max per user: use tier's value if set, otherwise fall back to event-level
	const effectiveMaxPerUser = $derived<number | null>(
		tierMaxTicketsPerUser !== null ? tierMaxTicketsPerUser : eventMaxTicketsPerUser
	);

	// Calculated max quantity based on tier availability, tier limit, and user limit
	const effectiveMaxQuantity = $derived.by(() => {
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
	const showQuantitySelector = $derived(effectiveMaxQuantity > 1);

	// Show guest name inputs only when user can purchase more than one ticket
	const showGuestNames = $derived(effectiveMaxQuantity > 1);

	// Check if all guest names are filled

	// Computed: whether seat selection is valid (need as many seats as quantity)

	// PWYC min/max
	const minAmount = $derived(() => {
		if (!isPwyc) return 0;
		if (tier.pwyc_min) {
			return typeof tier.pwyc_min === 'string' ? parseFloat(tier.pwyc_min) : tier.pwyc_min;
		}
		return 1;
	});

	const maxAmount = $derived(() => {
		if (!isPwyc || !tier.pwyc_max) return null;
		return typeof tier.pwyc_max === 'string' ? parseFloat(tier.pwyc_max) : tier.pwyc_max;
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

	// Release the newest excess holds when quantity shrinks
	$effect(() => {
		if (seatController && heldSeatIds.length > quantity) {
			void seatController.trimTo(quantity);
		}
	});

	// Safety net: a section switch remounts this dialog via {#key} WITHOUT
	// flipping `open`, so the close-reset effect never runs — release
	// un-handed-off holds on teardown too (no-op after a normal close).
	$effect(() => () => {
		const controller = untrack(() => seatController);
		if (controller && !purchaseHandedOff) void controller.releaseAll();
	});

	// Close dialog if user becomes authenticated (token refresh or in-tab login).
	// IDENTITY CRITICAL: guest holds belong to the guest-cookie identity — with a
	// Bearer token present an SDK release would target the authed user instead,
	// so release via the raw no-auth registry path BEFORE the force-close.
	$effect(() => {
		if (open && authStore.isAuthenticated) {
			if (untrack(() => seatController)) {
				purchaseHandedOff = true; // skip the SDK release in the reset effect
				void releaseAnonymousHolds();
			}
			open = false;
			onClose();
		}
	});

	// Reset state when dialog opens/closes. Only `open` may be tracked here: the
	// init branch reads other reactive state (formData, tier-derived values), and
	// tracking those re-runs the effect on unrelated updates (typing a name, a
	// tier refetch on window focus) which stomps user-entered PWYC amounts and
	// guest names. `untrack` limits the effect to open/close transitions.
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
			requiresAccount = false;
			guestNameError = '';
			reservationRetry.clear();
			quantity = 1;
			guestNames = [''];
			seatSelectionError = '';
			accessibleRequired = false;
			bestAvailableError = '';
			selectedZoneId = null;
			// Closed without handing off to checkout: release the server holds
			// (fire-and-forget — never block closing; they expire anyway).
			const controller = untrack(() => seatController);
			seatController = null;
			if (controller && !purchaseHandedOff) void controller.releaseAll();
			purchaseHandedOff = false;
		} else {
			untrack(() => {
				purchaseHandedOff = false;
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
			});
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
				const shape = guestUserSchema.shape;
				if (field in shape) {
					const key = field as keyof typeof shape;
					shape[key].parse(formData[key]);
					fieldErrors[field] = '';
				}
			}
		} catch (error) {
			if (error instanceof z.ZodError && error.issues.length > 0) {
				fieldErrors[field] = error.issues[0].message;
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
		} catch (error) {
			if (error instanceof z.ZodError) {
				error.issues.forEach((err) => {
					const field = String(err.path[0]);
					if (!fieldErrors[field]) {
						fieldErrors[field] = err.message;
					}
				});
			}
			return false;
		}
	}

	// Validate guest names (pure logic in guest-checkout-payload.ts)
	function validateGuestNames(): boolean {
		guestNameError = guestNamesError(guestNames, showGuestNames);
		return guestNameError === '';
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!validateForm()) return;

		// Validate guest names
		if (!validateGuestNames()) return;

		// Validate billing section if open
		if (billingSection && !billingSection.validate()) return;

		// Validate seat selection for user_choice mode (selection = live holds)
		if (isUserChoiceSeat && heldSeatIds.length !== quantity) {
			const remaining = quantity - heldSeatIds.length;
			seatSelectionError =
				remaining === 1
					? m['guestTicketDialog.pleaseSelectMoreSeatOne']()
					: m['guestTicketDialog.pleaseSelectMoreSeats']({ count: remaining });
			return;
		}
		seatSelectionError = '';
		bestAvailableError = '';

		// Mapped best-available tier: the zone is mandatory (single-zone included).
		if (mappedBestAvailable && !selectedZoneId) {
			bestAvailableError = m['seatZones.selectHint']();
			return;
		}

		isSubmitting = true;
		errorMessage = null;

		try {
			// Build tickets array - one for each ticket
			const tickets = guestNames.map((name, index) => {
				// For single ticket (no guest names shown), use primary guest name
				const guestName = showGuestNames
					? name.trim()
					: `${formData.first_name} ${formData.last_name}`.trim();

				const ticket: TicketPurchaseItem = {
					guest_name: guestName
				};

				// Add seat_id for user_choice mode (the buyer's held seats). Other
				// modes send an explicit null — best_available seats are assigned
				// server-side from the buyer's live holds, never via seat_id.
				if (isUserChoiceSeat && heldSeatIds[index]) {
					ticket.seat_id = heldSeatIds[index];
				} else {
					ticket.seat_id = null;
				}

				return ticket;
			});

			const billingInfo = billingSection?.getBillingInfo() || undefined;
			const pwycNumber = parseFloat(formData.pwyc || '0');

			// Fingerprint + bodies come from guest-checkout-payload.ts; the zone is
			// set only on a mapped best-available tier (uninvited zones are 400s).
			const checkoutArgs: GuestCheckoutArgs = {
				email: formData.email,
				firstName: formData.first_name,
				lastName: formData.last_name,
				tickets,
				billingInfo,
				accessibleRequired,
				priceCategoryId: mappedBestAvailable ? (selectedZoneId ?? undefined) : undefined,
				pricePerTicket: isPwyc ? pwycNumber : undefined
			};
			const fingerprint = guestCheckoutFingerprint(checkoutArgs);

			// Retry after a partial failure (#464): an identical resubmit replays
			// only the idempotent Stripe-session step; an expired reservation or
			// changed parameters fall through and reserve afresh.
			const resumedUrl = await reservationRetry.resume(fingerprint);
			if (resumedUrl) {
				// The resumed reservation consumed the holds when it was created.
				purchaseHandedOff = true;
				window.location.href = resumedUrl;
				return;
			}

			// best_available + online payment: hold the best adjacent block now —
			// the reserve call below consumes it. Free/offline tiers skip this
			// (purchase happens at email-confirm time, after any hold expired).
			if (isBestAvailableSeat && isOnlinePayment && seatController) {
				// Retry after a failed checkout: drop any stale block first so the
				// server picks a fresh one instead of stacking holds (mirrors
				// TicketConfirmationDialog.handleConfirm). Unconditional because in
				// best_available mode myHolds is never seeded from the server, so a
				// prior session's holds on this guest cookie are invisible locally.
				await seatController.releaseAll();
				const holdResult = await seatController.holdBestAvailable(
					tier.id,
					quantity,
					accessibleRequired,
					checkoutArgs.priceCategoryId ?? null
				);
				if (!holdResult.ok) {
					bestAvailableError = bestAvailableFailureMessage(holdResult);
					return;
				}
			}

			const response = isPwyc
				? await eventpublicguestGuestTicketPwycCheckout({
						path: { event_id: eventId, tier_id: tier.id },
						body: guestPwycCheckoutBody(checkoutArgs)
					})
				: await eventpublicguestGuestTicketCheckout({
						path: { event_id: eventId, tier_id: tier.id },
						body: guestCheckoutBody(checkoutArgs)
					});

			// Check for API error (400, 422, etc.) - client doesn't throw on HTTP errors
			if (response.error) {
				// The runtime error payload can carry eligibility fields (next_step, reason)
				// that are not part of the declared ResponseMessage type, so narrow from unknown.
				const err: unknown = response.error;
				const nextStep =
					typeof err === 'object' && err !== null && 'next_step' in err ? err.next_step : undefined;
				const detail =
					typeof err === 'object' && err !== null && 'detail' in err ? err.detail : undefined;
				const reason =
					typeof err === 'object' && err !== null && 'reason' in err ? err.reason : undefined;

				// Check for eligibility response with next_step
				if (typeof nextStep === 'string' && !GUEST_COMPATIBLE_STEPS.has(nextStep)) {
					requiresAccount = true;
				}

				const errorDetail =
					(typeof detail === 'string' && detail) ||
					(typeof reason === 'string' && reason) ||
					m['guestTicketDialog.failedToCheckout']();
				throw new Error(
					typeof errorDetail === 'string' ? errorDetail : m['guestTicketDialog.failedToCheckout']()
				);
			}

			// Checkout succeeded: holds are checkout's responsibility now (online:
			// consumed by the reserve; email flow: kept live for confirmation).
			purchaseHandedOff = true;

			// Check response type
			if (response.data && response.data.requires_payment && response.data.reservation_id) {
				// Online payment - reserve succeeded, now create the Stripe session
				// and redirect. Keep the handle for an idempotent retry on failure.
				reservationRetry.remember(response.data.reservation_id, fingerprint);
				window.location.href = await createCheckoutSession('guest', response.data.reservation_id);
			} else if (response.data && 'checkout_url' in response.data && response.data.checkout_url) {
				// Online payment - redirect to Stripe (legacy single-call shape)
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
		} catch (error) {
			// An expired reservation was released server-side — retrying starts over,
			// so it gets its own message instead of "your tickets are reserved".
			errorMessage =
				error instanceof CheckoutSessionError
					? error.expired
						? m['guestTicketDialog.paymentStartFailedExpired']()
						: m['guestTicketDialog.paymentStartFailed']()
					: handleGuestAttendanceError(error);
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
</script>

<Dialog bind:open>
	<DialogContent
		class="flex max-h-[92vh] flex-col {isUserChoiceSeat ? 'sm:max-w-4xl' : 'sm:max-w-lg'}"
	>
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
			<GuestTicketSuccess email={formData.email} {onClose} />
		{:else}
			<!-- Form State -->
			<form onsubmit={handleSubmit} class="flex min-h-0 flex-1 flex-col">
				<div class="min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1">
					<!-- Tier Info Card -->
					<GuestTicketTierInfo {tier} {isPwyc} />

					<!-- Quantity Selector (if applicable) -->
					{#if showQuantitySelector}
						<GuestTicketQuantitySelector
							{quantity}
							{effectiveMaxQuantity}
							{isPwyc}
							isCategoryPriced={!!tier.seat_pricing}
							currency={tier.currency}
							price={tier.price}
							{isSubmitting}
							onIncrement={incrementQuantity}
							onDecrement={decrementQuantity}
						/>
					{/if}

					<!-- Purchaser identity: email + first/last name -->
					<GuestTicketIdentityFields
						bind:formData
						{fieldErrors}
						{isSubmitting}
						onKeydown={handleKeydown}
						onBlur={handleBlur}
					/>

					<!-- Guest Names for Each Ticket (if applicable) -->
					{#if showGuestNames}
						<GuestTicketNameInputs
							{guestNames}
							firstName={formData.first_name}
							lastName={formData.last_name}
							{isSubmitting}
							{guestNameError}
							onUpdateName={updateGuestName}
						/>
					{/if}

					<!-- Seat Selection: only mounted for seated tiers (the section
					     instantiates the seat-hold controller + queries on mount) -->
					{#if hasSeatSection}
						<GuestTicketSeatSection
							{isUserChoiceSeat}
							{isBestAvailableSeat}
							{isOnlinePayment}
							{tierVenue}
							{tierSector}
							{eventId}
							{quantity}
							maxQuantity={effectiveMaxQuantity}
							onQuantityAutoGrow={(next) => {
								if (next > quantity && next <= effectiveMaxQuantity) quantity = next;
							}}
							{isSubmitting}
							{seatSelectionError}
							{bestAvailableError}
							{accessibleRequired}
							onAccessibleRequiredChange={(value) => (accessibleRequired = value)}
							{selectedZoneId}
							onZoneChange={(zoneId) => (selectedZoneId = zoneId)}
							{allTiers}
							onSwitchTier={onSwitchTier
								? (nextTier) => {
										// The switch remounts this dialog on the new tier; the old
										// instance's close-reset releases the held seats.
										onSwitchTier(nextTier);
									}
								: undefined}
							onController={(controller) => (seatController = controller)}
							seatPricing={tier.seat_pricing ?? null}
							currency={tier.currency}
						/>
					{/if}

					<!-- PWYC Amount (if applicable) -->
					{#if isPwyc}
						<GuestTicketPwycSection
							bind:formData
							bind:fieldErrors
							currency={tier.currency}
							minAmount={minAmount()}
							maxAmount={maxAmount()}
							suggestions={pwycSuggestions(minAmount(), maxAmount())}
							{isSubmitting}
							onKeydown={handleKeydown}
							onBlur={handleBlur}
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
							pwycAmount={isPwyc ? formData.pwyc : undefined}
							priceCategoryId={mappedBestAvailable ? selectedZoneId : null}
							isAuthenticated={false}
							disabled={isSubmitting}
						/>
					{/if}

					<!-- Online Payment Notice -->
					{#if isOnlinePayment}
						<GuestTicketOnlinePaymentNotice />
					{/if}

					<!-- Error Message -->
					{#if errorMessage}
						<GuestTicketErrorAlert {errorMessage} {requiresAccount} />
					{/if}
				</div>

				<GuestTicketFooter
					{isSubmitting}
					{onClose}
					total={footerTotal}
					currency={tier.currency}
					isFree={tier.payment_method === 'free'}
				/>
			</form>
		{/if}
	</DialogContent>
</Dialog>
