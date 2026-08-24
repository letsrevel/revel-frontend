/**
 * Cart purchase orchestration for the event page (#853 Task 5): owns the
 * authed + guest checkout controllers, the guest buyer identity, the
 * checkout sheet's open/error state, and the confirm-time submit handlers.
 * Extracted from `+page.svelte` to keep it under the file-length budget
 * (plan ruling 10) — the page still constructs and owns `cart`/
 * `seatHoldRegistry` themselves (handleSelectTier and the seat picker need
 * direct access to them for reasons outside checkout), so this factory takes
 * them as deps rather than constructing them.
 */
import { tick } from 'svelte';
import type { QueryClient } from '@tanstack/svelte-query';
import { toast } from 'svelte-sonner';
import * as m from '$lib/paraglide/messages.js';
import type { EventDetailSchema, BuyerBillingInfoSchema } from '$lib/api/generated/types.gen';
import { authStore } from '$lib/stores/auth.svelte';
import { releaseAnonymousHolds } from '$lib/utils/seat-holds';
import type { EventCart } from '../tickets/cart.svelte';
import type { CartSeatHoldRegistry } from '../tickets/cart-seat-registry.svelte';
import { GuestIdentity } from '../tickets/guest-identity.svelte';
import {
	buildCartItems,
	buildCartCheckoutParams,
	buildGuestCartCheckoutParams
} from '../tickets/cart-payload';
import { defaultGuestName } from '../tickets/purchase-items';
import * as cartBaHolds from '../tickets/cart-ba-holds';
import { createCartCheckoutController } from './cart-checkout-controller.svelte';
import { createGuestCartCheckoutController } from './guest-cart-checkout-controller.svelte';
import { createSignInDetector } from './sign-in-detector';

export interface CartPurchaseFlowDeps {
	event: EventDetailSchema;
	eventId: string;
	queryClient: QueryClient;
	/** The trustworthy per-request SSR truth (`data.isAuthenticated`) — static
	 * for the page's lifetime; see the login-mid-cart effect below for why the
	 * live `authStore` is read separately rather than used here. */
	isAuthenticated: boolean;
	cart: EventCart;
	registry: CartSeatHoldRegistry;
	getInitialDiscountCode: () => string;
	getTicketHolderDefaultName: () => string;
	refreshUserStatus: () => Promise<void>;
	setShowMyTicketModal: (open: boolean) => void;
}

export function createCartPurchaseFlow(deps: CartPurchaseFlowDeps) {
	const { event, eventId, queryClient, isAuthenticated, cart, registry } = deps;

	// Guest buyer identity for the cart checkout sheet — lives for the flow's
	// (i.e. the page's) lifetime, cleared after a successful guest purchase or
	// on login mid-cart.
	const guestIdentity = new GuestIdentity();

	// The guest checkout controller's `message` branch (non-online tiers): the
	// backend emailed a confirm link instead of returning a ticket. Rendered by
	// `CartEmailConfirmation` once set.
	let guestEmailConfirmation = $state<{ email: string; message: string } | null>(null);

	// Checkout sheet (#853 PR 2): multi-tier carts and any require_ticket_names
	// event route here for names/PWYC/discount/billing; single-tier carts on a
	// no-names event skip it entirely (direct checkout below).
	let showCheckoutSheet = $state(false);
	let cartPurchaseError = $state<unknown>(null);
	// Guards the BA-hold round-trip: neither controller's isPending covers it.
	let holdingSeats = $state(false);

	// Shared "purchase handed off" routine: flags the seat-hold registry BEFORE
	// clearing the cart so `CartSeatGroupHolds`' destroy handler (fired by the
	// groups disappearing below) skips its release-on-unmount — the tickets (or,
	// for a guest's `message` branch, the still-pending reservation behind the
	// emailed confirmation link) now own the held seats, not an abandoned cart.
	// Reset once the resulting unmounts have settled. Shared by both the authed
	// AND guest controllers' `onPurchaseComplete`: the guest `message` branch
	// calls `onEmailConfirmationPending` FIRST (closing the sheet, arming
	// `guestEmailConfirmation`) and only then this — so the holds this must keep
	// alive for the email-confirm step are already flagged safe by the time the
	// cart empties.
	function handlePurchaseComplete() {
		registry.handedOffToCheckout = true;
		cart.clear();
		void tick().then(() => {
			registry.handedOffToCheckout = false;
		});
	}

	const cartController = createCartCheckoutController({
		eventId,
		queryClient,
		refreshUserStatus: deps.refreshUserStatus,
		setShowMyTicketModal: deps.setShowMyTicketModal,
		onPurchaseComplete: handlePurchaseComplete
	});

	const guestCartController = createGuestCartCheckoutController({
		eventId,
		queryClient,
		onPurchaseComplete: handlePurchaseComplete,
		onEmailConfirmationPending: (message, email) => {
			guestEmailConfirmation = { email, message };
			showCheckoutSheet = false;
		}
	});

	// Stranded-cart guard: a cart that empties out from under an open sheet
	// (e.g. the last held seat expiring) must close it rather than show an
	// empty checkout form.
	$effect(() => {
		if (cart.isEmpty) showCheckoutSheet = false;
	});

	// Closing the sheet (confirm, cancel, or the stranded-cart guard above)
	// discards any inline purchase error — the next open starts clean.
	$effect(() => {
		if (!showCheckoutSheet) cartPurchaseError = null;
	});

	// Login mid-cart: a guest can sign in without a full page reload (e.g.
	// `/login` in another tab, or client-side navigation back to this page)
	// while cart items and a guest identity are still in memory — those were
	// priced/held under the anonymous identity and must not silently carry
	// over to the new authenticated one. `createSignInDetector` (pure, unit
	// tested) is seeded from `isAuthenticated` (the trustworthy per-request
	// SSR truth) and reports a genuine false→true transition on the LIVE
	// `authStore` exactly once — critically, it does NOT fire on the client
	// auth store's bootstrap-gate catch-up (auth.svelte.ts), which can observe
	// `authStore.isAuthenticated === false` on this effect's first several
	// runs even for an already-authenticated visitor. An earlier version of
	// this guard wrote `wasAuthenticated = nowAuthenticated` unconditionally,
	// which let that stale bootstrap `false` clobber the `true` SSR seed —
	// the eventual bootstrap resolution then looked exactly like a guest
	// signing in and wiped a real authenticated buyer's cart. See
	// `sign-in-detector.ts` for the fixed state machine and its tests.
	const signInDetector = createSignInDetector(isAuthenticated);
	$effect(() => {
		const nowAuthenticated = authStore.isAuthenticated;
		if (signInDetector.check(nowAuthenticated) && !cart.isEmpty) {
			// Bare-client release FIRST: the anonymous-cookie identity, not the
			// new Bearer token, owns these holds (see seat-holds.ts's module
			// doc) — releasing after `cart.clear()` would let the per-group
			// unmount's authenticated release race it with the wrong identity.
			void releaseAnonymousHolds();
			cart.clear();
			guestIdentity.clear();
			toast.info(m['cart.signedInCartCleared']());
		}
	});

	function buildCartCheckoutItems() {
		return buildCartItems(cart.groups, {
			requireTicketNames: event.require_ticket_names,
			defaultName: defaultGuestName(deps.getTicketHolderDefaultName())
		});
	}

	// Deps for `submitCart` (cart-ba-holds.ts) — `cart`/`holdingSeats` are live,
	// so both dep objects are built once. `submitCart` is generic over the
	// controller's params type, so the guest variant threads
	// `GuestCartCheckoutParams` through automatically.
	const cartSubmitDeps = {
		cart,
		registry,
		controller: cartController,
		isHolding: () => holdingSeats,
		setHolding: (value: boolean) => (holdingSeats = value)
	};
	const guestCartSubmitDeps = {
		cart,
		registry,
		controller: guestCartController,
		isHolding: () => holdingSeats,
		setHolding: (value: boolean) => (holdingSeats = value)
	};

	async function handleCartBuy() {
		// A URL-seeded discount code needs the sheet too, even on a direct
		// single-tier "Buy" — skipping straight to checkout would drop it.
		// `needsSheet` is unconditionally true for a guest (identity has nowhere
		// else to go), so this only ever short-circuits to checkout for an
		// authenticated buyer.
		if (
			cart.needsSheet(event.require_ticket_names, !isAuthenticated) ||
			deps.getInitialDiscountCode()
		) {
			showCheckoutSheet = true;
			return;
		}
		// '' / null keep the fingerprint byte-identical to PR 1's `{ items }`.
		const params = buildCartCheckoutParams(buildCartCheckoutItems(), '', null);
		// onError omitted: the controller's own toast surfaces the failure.
		await cartBaHolds.submitCart(params, cartSubmitDeps, {
			onHoldFailure: (message) => toast.error(message)
		});
	}

	async function handleSheetConfirm({
		discountCode,
		billingInfo
	}: {
		discountCode: string;
		billingInfo: BuyerBillingInfoSchema | null;
	}) {
		const items = buildCartCheckoutItems();
		const handlers = {
			onHoldFailure: (message: string) => (cartPurchaseError = new Error(message)),
			onError: (e: unknown) => (cartPurchaseError = e)
		};
		// Sheet stays open with the inline error either way; the relevant
		// controller's own toast fires too. The guest branch's `message`
		// response closes the sheet itself (`onEmailConfirmationPending`) before
		// `submitCart` resolves, so the `ok`-guarded close below is a no-op then.
		const ok = isAuthenticated
			? await cartBaHolds.submitCart(
					buildCartCheckoutParams(items, discountCode, billingInfo),
					cartSubmitDeps,
					handlers
				)
			: await cartBaHolds.submitCart(
					buildGuestCartCheckoutParams(
						items,
						{
							email: guestIdentity.email,
							firstName: guestIdentity.firstName,
							lastName: guestIdentity.lastName
						},
						discountCode,
						billingInfo
					),
					guestCartSubmitDeps,
					handlers
				);
		if (ok) showCheckoutSheet = false;
	}

	return {
		guestIdentity,
		get guestEmailConfirmation() {
			return guestEmailConfirmation;
		},
		set guestEmailConfirmation(value: { email: string; message: string } | null) {
			guestEmailConfirmation = value;
		},
		get showCheckoutSheet() {
			return showCheckoutSheet;
		},
		set showCheckoutSheet(value: boolean) {
			showCheckoutSheet = value;
		},
		get cartPurchaseError() {
			return cartPurchaseError;
		},
		get isProcessing() {
			return cartController.isPending || guestCartController.isPending || holdingSeats;
		},
		handleCartBuy,
		handleSheetConfirm
	};
}

export type CartPurchaseFlow = ReturnType<typeof createCartPurchaseFlow>;
