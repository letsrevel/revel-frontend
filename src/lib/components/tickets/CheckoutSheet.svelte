<script lang="ts">
	/** Multi-group checkout sheet (#853 PR 2): the sole place where names, PWYC
	 * amounts, discount code, and billing info come together for a cart with
	 * several tiers. Per-group data (names/PWYC amount) lives on `cart` — it
	 * survives a close — so writes go through `cart.setGuestName`/
	 * `setPwycAmount` only. Only the discount input/results and the
	 * accordion-open flags are sheet-local (see `EventCart.needsSheet`). */
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
	import GuestNameInputs from './GuestNameInputs.svelte';
	import PwycInput from './PwycInput.svelte';
	import PurchaseErrorAlert from './PurchaseErrorAlert.svelte';
	import CheckoutBillingSection from './CheckoutBillingSection.svelte';
	import type { EventCart, CartGroup } from './cart.svelte';
	import {
		discountApplicable,
		makeValidateDiscountFn,
		validateCartDiscount,
		type CartDiscountResult
	} from './cart-discount';
	import { cartTotal, cartTotalArgs, checkoutTotal } from './checkout-total';
	import {
		pwycBounds,
		pwycErrorMessage,
		pwycSuggestions,
		validatePwycAmount
	} from './pwyc-validation';
	import { sheetValidationError } from './checkout-sheet-validation';
	import { formatMoney } from '$lib/utils/format';
	import type { BuyerBillingInfoSchema, VatPreviewItemSchema } from '$lib/api/generated/types.gen';

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
		onConfirm
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
	// has since typed or cleared.
	$effect(() => {
		if (seeded) return;
		seeded = true;
		if (initialDiscountCode) {
			discountInput = initialDiscountCode;
			discountOpen = true;
			void applyDiscount();
		}
	});

	async function applyDiscount() {
		const code = discountInput.trim().toUpperCase();
		if (!code) return;
		discountValidating = true;
		const result = await validateCartDiscount(code, cart.groups, makeValidateDiscountFn(eventId));
		discountValidating = false;
		discountResult = result;
		appliedDiscountCode = result.anyValid ? code : '';
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
	// first. `submitAttempted` only governs when per-field inline errors show.
	let submitAttempted = $state(false);
	const validationError = $derived(sheetValidationError(cart.groups, requireTicketNames));

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

	function guestNamesFor(group: CartGroup): string[] {
		return Array.from({ length: group.quantity }, (_, index) => group.guestNames[index] ?? '');
	}

	function groupNameError(group: CartGroup): string {
		if (!submitAttempted || !requireTicketNames) return '';
		const missing = guestNamesFor(group).some((name) => !name.trim());
		return missing ? m['cartSheet.nameRequired']() : '';
	}

	function groupPwycError(group: CartGroup): string {
		if (!submitAttempted) return '';
		const { minAmount, maxAmount } = pwycBounds(group.tier);
		const validation = validatePwycAmount(group.pwycAmount ?? '', minAmount, maxAmount);
		if (validation.valid) return '';
		return pwycErrorMessage(validation.error, group.tier.currency, minAmount, maxAmount);
	}

	function groupTotal(group: CartGroup): string | null {
		return checkoutTotal(
			cartTotalArgs({
				tier: group.tier,
				quantity: group.quantity,
				seatIds: group.seatIds,
				pwycAmount: group.pwycAmount,
				priceCategoryId: group.priceCategoryId,
				discountedPrice: discountResult?.byTier.get(group.tier.id)?.discounted_price ?? null
			})
		);
	}

	async function handleConfirm() {
		submitAttempted = true;
		if (sheetValidationError(cart.groups, requireTicketNames)) return;
		if (billingSection && !billingSection.validate()) return;
		await onConfirm({
			discountCode: appliedDiscountCode,
			billingInfo: billingSection?.getBillingInfo() ?? null
		});
	}

	function handlePwycKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !isProcessing) {
			e.preventDefault();
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
			{#each cart.groups as group (group.tier.id)}
				<div class="space-y-3 rounded-[1.25rem] border-2 border-border bg-card p-4 shadow-poster">
					<div class="flex items-center justify-between gap-3">
						<p class="font-bold">
							{m['cartSheet.groupTickets']({ tierName: group.tier.name, count: group.quantity })}
						</p>
						{#if !isFree}
							<p class="text-sm font-semibold text-primary">
								{formatMoney(groupTotal(group), group.tier.currency)}
							</p>
						{/if}
					</div>

					{#if requireTicketNames}
						<GuestNameInputs
							guestNames={guestNamesFor(group)}
							idPrefix={group.tier.id}
							{isProcessing}
							guestNameError={groupNameError(group)}
							onUpdateName={(index, value) => cart.setGuestName(group.tier.id, index, value)}
							onClearError={() => (submitAttempted = false)}
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
							pwycError={groupPwycError(group)}
							{isProcessing}
							suggestions={pwycSuggestions(bounds.minAmount, bounds.maxAmount)}
							onAmountChange={(value) => cart.setPwycAmount(group.tier.id, value)}
							onKeydown={handlePwycKeydown}
						/>
					{/if}
				</div>
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
										{:else}
											<span class="text-destructive">
												{response?.message || m['cartSheet.discountNoMatch']()}
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

			<PurchaseErrorAlert
				error={purchaseError}
				tiers={cart.groups.map((group) => group.tier)}
				{organizationSlug}
			/>
		</div>

		<DialogFooter class="flex-col gap-2">
			{#if validationError && !isProcessing}
				<p class="text-center text-sm text-highlight-foreground dark:text-highlight">
					<AlertCircle class="mr-1 inline-block h-4 w-4" />
					{#if validationError === 'names'}
						{m['cartSheet.nameRequired']()}
					{:else if firstInvalidPwyc}
						{pwycErrorMessage(
							firstInvalidPwyc.validation.error,
							firstInvalidPwyc.group.tier.currency,
							firstInvalidPwyc.bounds.minAmount,
							firstInvalidPwyc.bounds.maxAmount
						)}
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
					disabled={isProcessing || !!validationError}
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
		</DialogFooter>
	</DialogContent>
</Dialog>
