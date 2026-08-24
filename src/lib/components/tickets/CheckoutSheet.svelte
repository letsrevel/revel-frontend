<script lang="ts">
	/** Multi-group checkout sheet (#853 PR 2): the sole place where names, PWYC
	 * amounts, discount code, and billing info come together for a cart with
	 * several tiers. Per-group data (names/PWYC amount) lives on `cart` — it
	 * survives a close — so writes go through `cart.setGuestName`/
	 * `setPwycAmount` only. Only the discount input/results and the
	 * accordion-open flags are sheet-local (see `EventCart.needsSheet`). */
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
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
	import { AlertCircle, ChevronDown, Loader2, Tag } from '@lucide/svelte';
	import CheckoutSheetGroup from './CheckoutSheetGroup.svelte';
	import PurchaseErrorAlert from './PurchaseErrorAlert.svelte';
	import CheckoutBillingSection from './CheckoutBillingSection.svelte';
	import GuestIdentityFields from './GuestIdentityFields.svelte';
	import GuestOnlinePaymentNotice from './GuestOnlinePaymentNotice.svelte';
	import type { EventCart, CartGroup } from './cart.svelte';
	import type { CartSeatHoldRegistry } from './cart-seat-registry.svelte';
	import type { GuestIdentity } from './guest-identity.svelte';
	import { guestIdentityError } from './guest-identity.svelte';
	import {
		discountApplicable,
		discountStaysApplied,
		makeValidateDiscountFn,
		validateCartDiscount,
		type CartDiscountResult
	} from './cart-discount';
	import { cartTotal, cartTotalArgs } from './checkout-total';
	import { pwycBounds, pwycErrorMessage, validatePwycAmount } from './pwyc-validation';
	import { sheetValidationError } from './checkout-sheet-validation';
	import { formatMoney } from '$lib/utils/format';
	import type {
		BuyerBillingInfoSchema,
		VatPreviewItemSchema,
		VenueChartSchema
	} from '$lib/api/generated/types.gen';

	interface Props {
		open: boolean;
		cart: EventCart;
		eventId: string;
		requireTicketNames: boolean;
		isAuthenticated: boolean;
		authToken: string | null;
		organizationSlug: string;
		initialDiscountCode?: string;
		isProcessing: boolean;
		purchaseError: unknown;
		onConfirm: (opts: {
			discountCode: string;
			billingInfo: BuyerBillingInfoSchema | null;
		}) => Promise<void>;
		/** Venue chart for seated groups' totals (#853 PR 3) — from the page's
		 * seat-hold registry; null/omitted while no user_choice controller has
		 * loaded one yet (seated totals stay unresolved, same as before). */
		chart?: VenueChartSchema | null;
		/** Cart-lifetime seat-hold controller registry (#853 PR 3, Task 5):
		 * threaded down to each `CheckoutSheetGroup` for its zone availability. */
		registry: CartSeatHoldRegistry;
		/** #853 PR 4: the guest buyer identity store — owned by the page,
		 * `undefined` for authenticated buyers (and for every existing call site
		 * until Task 5 wires guest checkout). When absent while `!isAuthenticated`
		 * the guest identity block/gating is skipped entirely — defensive, not
		 * expected to happen once the page passes it through. */
		identity?: GuestIdentity;
	}

	let {
		open = $bindable(),
		cart,
		eventId,
		requireTicketNames,
		isAuthenticated,
		authToken,
		organizationSlug,
		initialDiscountCode = '',
		isProcessing,
		purchaseError,
		onConfirm,
		chart = null,
		registry,
		identity
	}: Props = $props();

	// Discount: sheet-local input/results. Only the APPLIED code string
	// travels back up (via onConfirm) — the cart itself has no discount field.
	let discountOpen = $state(false);
	let discountInput = $state('');
	let discountValidating = $state(false);
	let discountResult = $state<CartDiscountResult | null>(null);
	let appliedDiscountCode = $state('');
	let seeded = $state(false);

	// Seed the initial (e.g. URL param) code exactly once, on first mount —
	// never re-seed on a later reopen, which would stomp whatever the buyer
	// has since typed or cleared. Validation is deferred to the open-effect
	// below: `+page.svelte` opens the sheet whenever a URL discount code is
	// present (even for a single-tier direct "Buy"), so seeding must not fire
	// the network call while the sheet is still closed.
	$effect(() => {
		if (seeded) return;
		seeded = true;
		if (initialDiscountCode) {
			discountInput = initialDiscountCode;
			discountOpen = true;
		}
	});

	// Re-validate whenever the sheet opens with a code on the books — covers
	// both the seeded code's first check and refreshing stale per-group
	// feedback/footer total after the buyer changed quantities or groups while
	// the sheet was closed. Keyed on `open` only: applyDiscount() itself
	// writes discountInput/appliedDiscountCode, so reading them untracked here
	// keeps this effect from re-triggering on its own writes.
	$effect(() => {
		if (!open) return;
		const hasCode = untrack(() => !!discountInput.trim());
		if (hasCode) void applyDiscount();
	});

	async function applyDiscount() {
		const code = discountInput.trim().toUpperCase();
		if (!code) return;
		discountValidating = true;
		const result = await validateCartDiscount(code, cart.groups, makeValidateDiscountFn(eventId));
		discountValidating = false;
		discountResult = result;
		appliedDiscountCode = discountStaysApplied(result, cart.groups) ? code : '';
	}

	// Billing section ref: getBillingInfo()/validate() called at submit time.
	let billingSection: CheckoutBillingSection | undefined = $state();

	const billingItems = $derived<VatPreviewItemSchema[]>(
		cart.groups.map((group) => ({
			tier_id: group.tier.id,
			count: group.quantity,
			...(group.priceCategoryId ? { price_category_id: group.priceCategoryId } : {})
		}))
	);
	const pwycGroups = $derived(cart.groups.filter((group) => group.tier.price_type === 'pwyc'));
	// Exactly one PWYC group: its amount previews honestly. With 2+, omitted —
	// the preview stays an estimate and checkout resolves each server-side.
	const pwycAmountOverride = $derived(pwycGroups.length === 1 ? pwycGroups[0].pwycAmount : null);
	const showBilling = $derived(cart.groups.some((group) => group.tier.invoicing_available));

	// Submit gate: the pure, unit-tested helper decides which rule fails
	// first. It's live (no "submit attempted" flag) and drives both the
	// disabled confirm button and the footer hint below — the shipped
	// disabled-with-hint UX, not per-field inline alerts on submit.
	const validationError = $derived(sheetValidationError(cart.groups, requireTicketNames));

	// Guest-only gate (#853 PR 4): checked BEFORE validationError below — an
	// unauthenticated buyer without a usable email/name has nothing to submit
	// regardless of the cart's own state. `identity` is optional (defensive:
	// every current call site is authenticated and omits it), so this is a
	// no-op for `isAuthenticated` and for the not-yet-wired guest path alike.
	const guestError = $derived(
		!isAuthenticated && identity ? guestIdentityError(identity, requireTicketNames) : null
	);

	// Split the translated "Already have an account? <a>Log in</a>" string around
	// its <a> markers so we can render a real anchor instead of {@html}-injecting
	// translator-editable content (latent XSS channel). Ported from the legacy
	// `GuestTicketFooter`.
	const orLoginParts = $derived.by(() => {
		const message = m['guest_attendance.or_login']();
		const match = message.match(/^(.*)<a>(.*)<\/a>(.*)$/s);
		if (!match) return { before: message, link: '', after: '' };
		return { before: match[1], link: match[2], after: match[3] };
	});

	// First offending PWYC group's precise reason (empty/below-min/above-max)
	// for the footer hint text — sheetValidationError only reports the tag.
	const firstInvalidPwyc = $derived.by(() => {
		for (const group of cart.groups) {
			if (group.tier.price_type !== 'pwyc') continue;
			const bounds = pwycBounds(group.tier);
			const validation = validatePwycAmount(
				group.pwycAmount ?? '',
				bounds.minAmount,
				bounds.maxAmount
			);
			if (!validation.valid) return { group, validation, bounds };
		}
		return null;
	});

	const currency = $derived(cart.currency ?? '');
	const isFree = $derived(cart.paymentMethod === 'free');
	const total = $derived(
		cartTotal(
			cart.groups.map((group) =>
				cartTotalArgs({
					tier: group.tier,
					quantity: group.quantity,
					seatIds: group.seatIds,
					chart,
					pwycAmount: group.pwycAmount,
					priceCategoryId: group.priceCategoryId,
					discountedPrice: discountResult?.byTier.get(group.tier.id)?.discounted_price ?? null
				})
			)
		)
	);

	const confirmLabel = $derived.by(() => {
		if (cart.paymentMethod === 'online') return m['cartSheet.payNow']();
		if (cart.paymentMethod === 'offline' || cart.paymentMethod === 'at_the_door')
			return m['cartSheet.reserve']();
		return m['cartSheet.claim']();
	});

	/** This group's per-ticket discounted price, when a discount is applied —
	 * threaded down to `CheckoutSheetGroup` for its own total computation. */
	function discountedPriceFor(group: CartGroup): string | null {
		return discountResult?.byTier.get(group.tier.id)?.discounted_price ?? null;
	}

	async function handleConfirm() {
		if (guestError) return;
		if (validationError) return;
		if (billingSection && !billingSection.validate()) return;
		await onConfirm({
			discountCode: appliedDiscountCode,
			billingInfo: billingSection?.getBillingInfo() ?? null
		});
	}

	// Same guard as the (disabled) confirm button: Enter in a PWYC field must
	// not bypass it and submit while some group is still invalid.
	function handlePwycKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !isProcessing) {
			e.preventDefault();
			if (guestError || validationError) return;
			void handleConfirm();
		}
	}
</script>

<Dialog bind:open>
	<DialogContent
		class="flex max-h-[92vh] flex-col sm:max-w-lg"
		showCloseButton={!isProcessing}
		escapeKeydownBehavior={isProcessing ? 'ignore' : 'close'}
		interactOutsideBehavior={isProcessing ? 'ignore' : 'close'}
	>
		<DialogHeader>
			<DialogTitle class="text-3xl font-black leading-[1.12]">{m['cartSheet.title']()}</DialogTitle>
			<DialogDescription>
				{m['cart.ticketCount']({ count: cart.totalCount })}
				{#if isFree}
					· {m['cart.free']()}
				{:else if total !== null}
					· {formatMoney(total, currency)}
				{/if}
			</DialogDescription>
		</DialogHeader>

		<div class="min-h-0 flex-1 space-y-4 overflow-y-auto py-2">
			<!-- Purchaser identity (#853 PR 4): only for an unauthenticated buyer,
			     and only once `identity` is actually threaded through (Task 5). -->
			{#if !isAuthenticated && identity}
				<GuestIdentityFields
					{identity}
					{requireTicketNames}
					{isProcessing}
					idPrefix="cart-sheet-guest"
				/>
			{/if}

			{#each cart.groups as group (group.tier.id)}
				<CheckoutSheetGroup
					{group}
					{cart}
					{requireTicketNames}
					{isProcessing}
					{isFree}
					{chart}
					discountedPrice={discountedPriceFor(group)}
					{registry}
					isGuest={!isAuthenticated}
					onPwycKeydown={handlePwycKeydown}
				/>
			{/each}

			<!-- Discount code (cart-wide, fans out over every applicable group) -->
			<div class="rounded-lg border">
				<button
					type="button"
					onclick={() => (discountOpen = !discountOpen)}
					class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent"
					aria-expanded={discountOpen}
				>
					<span class="flex items-center gap-2">
						<Tag class="h-4 w-4" aria-hidden="true" />
						{m['cartSheet.discountSection']()}
					</span>
					<ChevronDown
						class="h-4 w-4 transition-transform {discountOpen ? 'rotate-180' : ''}"
						aria-hidden="true"
					/>
				</button>
				{#if discountOpen}
					<div class="space-y-3 border-t px-4 py-3">
						<div class="flex gap-2">
							<Input
								type="text"
								bind:value={discountInput}
								placeholder={m['discountCodeInput.codePlaceholder']()}
								disabled={isProcessing || discountValidating}
								class="flex-1 uppercase"
								aria-label={m['cartSheet.discountSection']()}
								oninput={() => {
									discountInput = discountInput.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										void applyDiscount();
									}
								}}
							/>
							<Button
								variant="outline"
								onclick={() => void applyDiscount()}
								disabled={isProcessing || discountValidating || !discountInput.trim()}
							>
								{#if discountValidating}
									<Loader2 class="h-4 w-4 animate-spin" />
								{:else}
									{m['discountCodeInput.apply']()}
								{/if}
							</Button>
						</div>
						{#if discountResult}
							<div class="space-y-1 text-xs" aria-live="polite">
								{#each cart.groups as group (group.tier.id)}
									{@const applicable = discountApplicable(group.tier)}
									{@const response = discountResult.byTier.get(group.tier.id)}
									<p class="flex items-center justify-between gap-2">
										<span class="text-muted-foreground">{group.tier.name}</span>
										{#if !applicable}
											<span class="text-muted-foreground">
												{m['cartSheet.discountNotApplicable']()}
											</span>
										{:else if response?.valid}
											<span class="text-success">
												{m['cartSheet.discountApplies']({ tierName: group.tier.name })}
											</span>
										{:else if response}
											<span class="text-destructive">
												{response.message || m['cartSheet.discountNoMatch']()}
											</span>
										{:else}
											<!-- Transport failure for this group's check specifically — not
											     "invalid", so stay neutral rather than implying the code is bad. -->
											<span class="text-muted-foreground">
												{m['cartSheet.discountCheckFailed']()}
											</span>
										{/if}
									</p>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Billing / invoicing (any group's tier allows it) -->
			{#if showBilling}
				<div class="space-y-2">
					<p class="text-sm font-semibold">{m['cartSheet.billingSection']()}</p>
					<CheckoutBillingSection
						bind:this={billingSection}
						{eventId}
						tierId={cart.groups[0]?.tier.id ?? ''}
						tierName={cart.groups[0]?.tier.name ?? ''}
						quantity={cart.totalCount}
						{currency}
						price={cart.groups[0]?.tier.price ?? '0'}
						isPwyc={false}
						items={billingItems}
						{pwycAmountOverride}
						discountCode={appliedDiscountCode || undefined}
						{isAuthenticated}
						{authToken}
						disabled={isProcessing}
					/>
				</div>
			{/if}

			<!-- #853 PR 4: cart-wide, guests only, redirect-to-Stripe heads-up. -->
			{#if !isAuthenticated && cart.paymentMethod === 'online'}
				<GuestOnlinePaymentNotice />
			{/if}

			<PurchaseErrorAlert
				error={purchaseError}
				tiers={cart.groups.map((group) => group.tier)}
				{organizationSlug}
			/>
		</div>

		<DialogFooter class="flex-col gap-2">
			{#if guestError && !isProcessing}
				<!-- Guest identity gate takes priority: without a usable email/name
				     there is nothing to submit, regardless of the cart's own state. -->
				<p class="text-center text-sm text-highlight-foreground dark:text-highlight">
					<AlertCircle class="mr-1 inline-block h-4 w-4" aria-hidden="true" />
					{#if guestError === 'email'}
						{m['guest_attendance.validation_email']()}
					{:else}
						{m['cartSheet.guestNameRequired']()}
					{/if}
				</p>
			{:else if validationError && !isProcessing}
				<p class="text-center text-sm text-highlight-foreground dark:text-highlight">
					<AlertCircle class="mr-1 inline-block h-4 w-4" aria-hidden="true" />
					{#if validationError === 'names'}
						{m['cartSheet.nameRequired']()}
					{:else if validationError === 'pwyc' && firstInvalidPwyc}
						{pwycErrorMessage(
							firstInvalidPwyc.validation.error,
							firstInvalidPwyc.group.tier.currency,
							firstInvalidPwyc.bounds.minAmount,
							firstInvalidPwyc.bounds.maxAmount
						)}
					{:else if validationError === 'zone'}
						{m['seatZones.selectHint']()}
					{/if}
				</p>
			{/if}
			<p class="flex w-full items-center justify-between border-t border-border pt-2 text-sm">
				<span class="text-muted-foreground">{m['checkoutFooter.total']()}</span>
				<span class="text-base font-bold">
					{isFree ? m['cart.free']() : formatMoney(total, currency)}
				</span>
			</p>
			<div class="flex w-full gap-2 sm:justify-end">
				<Button
					variant="outline"
					onclick={() => (open = false)}
					disabled={isProcessing}
					class="flex-1 sm:flex-initial"
				>
					{m['cartSheet.close']()}
				</Button>
				<Button
					onclick={handleConfirm}
					disabled={isProcessing || !!guestError || !!validationError}
					class="flex-1 sm:flex-initial"
				>
					{#if isProcessing}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{m['ticketConfirmationDialog.processing']()}
					{:else}
						{confirmLabel}
					{/if}
				</Button>
			</div>

			<!-- #853 PR 4: subtle login link for guests — ported from the legacy
			     `GuestTicketFooter`. -->
			{#if !isAuthenticated}
				<div class="border-t pt-3 text-center text-xs text-muted-foreground">
					<p>
						{orLoginParts.before}{#if orLoginParts.link}<a
								href={resolve('/(public)/login', {})}
								class="text-primary hover:underline">{orLoginParts.link}</a
							>{/if}{orLoginParts.after}
					</p>
				</div>
			{/if}
		</DialogFooter>
	</DialogContent>
</Dialog>
