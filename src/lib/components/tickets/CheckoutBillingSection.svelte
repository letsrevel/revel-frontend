<script lang="ts">
	// 1. Imports
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Check, AlertCircle, Loader2, Receipt } from '@lucide/svelte';
	import {
		userbillingGetBillingProfile,
		eventpublicticketsVatPreview
	} from '$lib/api/generated/sdk.gen';
	import type {
		UserBillingProfileSchema,
		BuyerBillingInfoSchema,
		VatPreviewResponseSchema,
		VatPreviewItemSchema
	} from '$lib/api/generated/types.gen';

	// 2. Props interface
	interface Props {
		eventId: string;
		tierId: string;
		tierName: string;
		quantity: number;
		currency: string;
		price: number | string;
		isPwyc: boolean;
		pwycAmount?: string;
		discountCode?: string;
		/** Buyer's zone on a MAPPED best-available tier — a count-based VAT
		 * preview item on such a tier has no single price without it. */
		priceCategoryId?: string | null;
		isAuthenticated: boolean;
		authToken?: string | null;
		disabled?: boolean;
		/** Cart-aware preview: when present, supersedes the single-tier
		 * `tierId`/`quantity`/`priceCategoryId` fields in the VAT preview
		 * request body. The legacy fields stay untouched for existing callers. */
		items?: VatPreviewItemSchema[];
		/** PWYC price override for the multi-item preview. Only read when
		 * `items` is provided; the caller passes it iff exactly one PWYC
		 * group exists in the cart — with 2+ PWYC groups it is omitted
		 * (the preview is then an estimate; checkout resolves each group's
		 * amount server-side). */
		pwycAmountOverride?: string | null;
	}

	const {
		eventId,
		tierId,
		tierName: _tierName,
		quantity,
		currency,
		price: _price,
		isPwyc,
		pwycAmount = '',
		discountCode,
		priceCategoryId = null,
		isAuthenticated,
		authToken = null,
		disabled = false,
		items,
		pwycAmountOverride = null
	}: Props = $props();

	// 3. Local state
	let isOpen = $state(false);
	let billingName = $state('');
	let billingAddress = $state('');
	let vatCountryCode = $state('');
	let billingEmail = $state('');
	let vatId = $state('');
	let saveToProfile = $state(false);

	// VAT preview state
	let vatPreview = $state<VatPreviewResponseSchema | null>(null);
	let isLoadingVat = $state(false);
	let vatPreviewError = $state('');

	// Form validation
	let billingNameError = $state('');

	// 4. Query: pre-fill from billing profile when the user asks for an invoice.
	// Gated on `isOpen` as well: the profile is read ONLY by the prefill below, so
	// firing on mount spent a request on every paid-checkout dialog — and for the
	// many users with nothing saved the endpoint answers 404, which the browser
	// still logs as a failed request even though we handle it (#817).
	// All three operands are read unconditionally: `&&` evaluated inside the
	// tracked options getter would leave the later ones unread — and therefore
	// untracked — freezing `enabled` at its initial value.
	const shouldLoadBillingProfile = $derived.by(() => {
		const authenticated = isAuthenticated;
		const hasToken = !!authToken;
		const sectionOpen = isOpen;
		return authenticated && hasToken && sectionOpen;
	});

	const billingProfileQuery = createQuery<UserBillingProfileSchema | null>(() => ({
		queryKey: ['user-billing-profile'],
		queryFn: async () => {
			if (!authToken) return null;
			const response = await userbillingGetBillingProfile({
				headers: { Authorization: `Bearer ${authToken}` }
			});
			// "Nothing saved yet" is 200 + null since BE #861. The 404 branch stays
			// for deploy-lag tolerance (an older backend still answers 404 for the
			// same empty state); either way it resolves to null, never an error.
			// Non-404 failures ALSO resolve to null on purpose: the profile only
			// feeds the optional invoice prefill, so checkout fails open (user
			// types their details) instead of surfacing an error for a convenience.
			if (response.response?.status === 404) return null;
			if (response.error) return null;
			return (response.data as UserBillingProfileSchema | null | undefined) ?? null;
		},
		enabled: shouldLoadBillingProfile,
		retry: false,
		staleTime: 60_000
	}));

	// 5. Pre-fill form from profile and auto-fetch VAT preview
	function prefillFromProfile() {
		const profile = billingProfileQuery.data;
		if (!profile) return;
		if (!billingName && profile.billing_name) billingName = profile.billing_name;
		if (!billingAddress && profile.billing_address) billingAddress = profile.billing_address;
		if (!vatCountryCode && profile.vat_country_code) vatCountryCode = profile.vat_country_code;
		if (!billingEmail && profile.billing_email) billingEmail = profile.billing_email;
		if (!vatId && profile.vat_id) {
			vatId = profile.vat_id;
			// Auto-fetch VAT preview when pre-filled
			setTimeout(() => fetchVatPreview(), 0);
		}
	}

	// Also pre-fill when profile query resolves after section is already open
	$effect(() => {
		const profile = billingProfileQuery.data;
		if (profile && isOpen) {
			prefillFromProfile();
		}
	});

	// A zone switch (or, for the cart-aware caller, a changed cart `items`
	// array) changes the unit price / composition of the preview — refresh an
	// already-visible preview so it never quotes stale data. Only those two
	// are tracked: the guard reads are untracked so the fetch writing
	// `vatPreview` can't re-trigger the effect.
	$effect(() => {
		void priceCategoryId;
		void items;
		untrack(() => {
			if (isOpen && vatPreview) void fetchVatPreview();
		});
	});

	// 6. VAT preview fetch
	async function fetchVatPreview() {
		if (!vatId.trim()) {
			vatPreview = null;
			vatPreviewError = '';
			return;
		}

		isLoadingVat = true;
		vatPreviewError = '';

		try {
			// Cart-aware callers (multi-item preview) pass `pwycAmountOverride` only
			// when exactly one PWYC group exists in the cart; with 2+ PWYC groups it
			// is omitted on purpose — the preview is then an estimate and checkout
			// resolves each group's amount server-side. Legacy single-tier callers
			// keep the old isPwyc/pwycAmount behavior untouched.
			const pwycValue = items
				? pwycAmountOverride
					? parseFloat(pwycAmountOverride)
					: undefined
				: isPwyc && pwycAmount
					? parseFloat(pwycAmount)
					: undefined;

			const response = await eventpublicticketsVatPreview({
				path: { event_id: eventId },
				body: {
					billing_info: {
						billing_name: billingName || 'Preview',
						vat_id: vatId.trim() || undefined,
						vat_country_code: vatCountryCode.trim().toUpperCase() || undefined,
						billing_address: billingAddress.trim() || undefined,
						billing_email: billingEmail.trim() || undefined
					},
					items: items ?? [
						{
							tier_id: tierId,
							count: quantity,
							// Zone on a mapped best-available tier: without it the
							// count-based item resolves to no single price (400).
							...(priceCategoryId ? { price_category_id: priceCategoryId } : {})
						}
					],
					discount_code: discountCode || undefined,
					price_per_ticket: pwycValue
				},
				...(authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {})
			});

			if (response.error) {
				vatPreviewError = m['checkout.billing.vatPreviewError']();
				vatPreview = null;
			} else if (response.data) {
				vatPreview = response.data as VatPreviewResponseSchema;
			}
		} catch {
			vatPreviewError = m['checkout.billing.vatPreviewError']();
			vatPreview = null;
		} finally {
			isLoadingVat = false;
		}
	}

	// 7. Exposed method: return billing info or null
	export function getBillingInfo(): BuyerBillingInfoSchema | null {
		if (!isOpen) return null;
		if (!billingName.trim()) return null;
		return {
			billing_name: billingName.trim(),
			vat_id: vatId.trim() || undefined,
			vat_country_code: vatCountryCode.trim().toUpperCase() || undefined,
			billing_address: billingAddress.trim() || undefined,
			billing_email: billingEmail.trim() || undefined,
			save_to_profile: isAuthenticated ? saveToProfile : undefined
		};
	}

	// 8. Validate billing name when section is open and user submits
	export function validate(): boolean {
		if (!isOpen) return true;
		if (!billingName.trim()) {
			billingNameError = m['checkout.billing.billingNameRequired']();
			return false;
		}
		billingNameError = '';
		return true;
	}

	// Derived: VAT ID validation status from preview
	const vatIdValid = $derived(vatPreview?.vat_id_valid ?? null);
	const hasVatPreviewData = $derived(vatPreview !== null && !isLoadingVat && !vatPreviewError);
</script>

<div class="space-y-3">
	<!-- Checkbox toggle -->
	<div class="flex items-center gap-2">
		<Checkbox
			id="request-invoice-toggle"
			checked={isOpen}
			onCheckedChange={(checked) => {
				isOpen = checked === true;
				if (isOpen) prefillFromProfile();
			}}
			{disabled}
		/>
		<Label for="request-invoice-toggle" class="cursor-pointer text-sm font-medium">
			{m['checkout.billing.requestInvoice']()}
		</Label>
	</div>

	{#if isOpen}
		<div id="billing-section-content" class="space-y-3 rounded-lg border bg-muted/20 p-4">
			<p class="text-xs text-muted-foreground">
				{m['checkout.billing.requestInvoiceDescription']()}
			</p>

			<!-- Billing Name (required) -->
			<div class="space-y-1.5">
				<Label for="billing-name" class="text-sm font-medium">
					{m['checkout.billing.billingName']()}
					<span class="text-destructive" aria-label={m['checkout.billing.required']()}>*</span>
				</Label>
				<Input
					id="billing-name"
					type="text"
					bind:value={billingName}
					placeholder={m['checkout.billing.billingNamePlaceholder']()}
					{disabled}
					aria-required="true"
					aria-invalid={billingNameError ? 'true' : undefined}
					aria-describedby={billingNameError ? 'billing-name-error' : undefined}
					oninput={() => {
						if (billingName.trim()) billingNameError = '';
					}}
				/>
				{#if billingNameError}
					<p id="billing-name-error" class="text-sm text-destructive" role="alert">
						{billingNameError}
					</p>
				{/if}
			</div>

			<!-- Billing Address (optional) -->
			<div class="space-y-1.5">
				<Label for="billing-address" class="text-sm font-medium">
					{m['checkout.billing.billingAddress']()}
				</Label>
				<Input
					id="billing-address"
					type="text"
					bind:value={billingAddress}
					placeholder={m['checkout.billing.billingAddressPlaceholder']()}
					{disabled}
				/>
			</div>

			<!-- Country Code + VAT ID row -->
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="vat-country-code" class="text-sm font-medium">
						{m['checkout.billing.vatCountryCode']()}
					</Label>
					<Input
						id="vat-country-code"
						type="text"
						bind:value={vatCountryCode}
						placeholder={m['checkout.billing.vatCountryCodePlaceholder']()}
						maxlength={2}
						{disabled}
						oninput={() => {
							vatCountryCode = vatCountryCode.toUpperCase();
						}}
					/>
				</div>

				<div class="space-y-1.5">
					<Label for="vat-id" class="text-sm font-medium">
						{m['checkout.billing.vatId']()}
					</Label>
					<Input
						id="vat-id"
						type="text"
						bind:value={vatId}
						placeholder={m['checkout.billing.vatIdPlaceholder']()}
						{disabled}
						oninput={() => {
							vatId = vatId.toUpperCase();
						}}
						onblur={fetchVatPreview}
					/>
				</div>
			</div>

			<!-- Billing Email (optional) -->
			<div class="space-y-1.5">
				<Label for="billing-email" class="text-sm font-medium">
					{m['checkout.billing.billingEmail']()}
				</Label>
				<Input
					id="billing-email"
					type="email"
					bind:value={billingEmail}
					placeholder={m['checkout.billing.billingEmailPlaceholder']()}
					{disabled}
				/>
			</div>

			<!-- Save to profile (authenticated only) -->
			{#if isAuthenticated}
				<div class="flex items-center gap-2">
					<Checkbox
						id="save-to-profile"
						checked={saveToProfile}
						onCheckedChange={(checked) => {
							saveToProfile = checked === true;
						}}
						{disabled}
						aria-describedby="save-to-profile-label"
					/>
					<Label
						id="save-to-profile-label"
						for="save-to-profile"
						class="cursor-pointer text-sm font-normal"
					>
						{m['checkout.billing.saveToProfile']()}
					</Label>
				</div>
			{/if}

			<!-- VAT Preview section -->
			{#if vatId.trim() || isLoadingVat || vatPreviewError || hasVatPreviewData}
				<div
					class="space-y-2 rounded-md border bg-muted/30 p-3"
					aria-label={m['checkout.billing.vatPreview']()}
				>
					<div class="flex items-center gap-2 text-sm font-medium">
						<Receipt class="h-4 w-4" aria-hidden="true" />
						{m['checkout.billing.vatPreview']()}
					</div>

					<!-- Loading -->
					{#if isLoadingVat}
						<div class="flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2 class="h-3 w-3 animate-spin" aria-hidden="true" />
							{m['checkout.billing.vatPreviewLoading']()}
						</div>
					{/if}

					<!-- Error -->
					{#if vatPreviewError && !isLoadingVat}
						<div class="flex items-center gap-2 text-sm text-destructive" role="alert">
							<AlertCircle class="h-3 w-3" aria-hidden="true" />
							{vatPreviewError}
						</div>
					{/if}

					<!-- Preview data -->
					{#if hasVatPreviewData && vatPreview}
						<!-- VAT ID validation status. Raw emerald/amber swept to semantic
						     tokens (#829): success as text, and the warning follows the
						     highlight-foreground-light / highlight-dark flip the tone
						     vocabulary uses for compact text-only warnings (amber itself
						     fails on a light surface). Icon + words carry the meaning,
						     never colour alone.
						     Surface note: this line sits TWO muted washes deep
						     (bg-muted/20 section > bg-muted/30 box over the dialog's
						     --background) — a stacked-tint site the audit script cannot
						     express, so it is hand-verified here with the script's own
						     compositing math: success 4.80:1 light / 9.63:1 dark;
						     highlight-foreground 13.43:1 light / highlight 9.26:1 dark.
						     Recompute if --muted, --success, --highlight or this nesting
						     changes (the script's success-on-background row is only the
						     token-level floor). -->
						{#if vatPreview.vat_id_valid !== null && vatPreview.vat_id_valid !== undefined}
							<div
								class="flex items-center gap-1.5 text-sm {vatIdValid
									? 'text-success'
									: 'text-highlight-foreground dark:text-highlight'}"
							>
								{#if vatIdValid}
									<Check class="h-3 w-3" aria-hidden="true" />
									{m['checkout.billing.vatIdValid']()}
								{:else}
									<AlertCircle class="h-3 w-3" aria-hidden="true" />
									{m['checkout.billing.vatIdInvalid']()}
								{/if}
							</div>
						{/if}

						<!-- Reverse charge banner. Only ever true for VIRTUAL events since
						     BE #868/#869 (physical admission is a domestic gross supply) —
						     the backend is the single source of truth, no client gating.
						     The two flags are mutually exclusive by construction
						     (reverse_charge requires a VALIDATED VAT ID, the B2C
						     disclaimer requires the opposite), so the else-if is pure
						     defence: if the backend contract ever broke, reverse charge —
						     the one that changes the amount paid — wins over the
						     disclaimer rather than both rendering contradictory advice.
						     Colour: bg-info/10 + text-info on the same stacked-tint
						     surface as the VAT-ID line above; hand-verified with the
						     audit script's compositing math: 7.91:1 light / 7.23:1 dark
						     (the "MyTicketModal / DemoBanner" COMPOSITED_PAIRS row covers
						     only the single-wash variant). -->
						{#if vatPreview.reverse_charge}
							<div class="rounded bg-info/10 px-2 py-1.5 text-sm text-info" role="status">
								{m['checkout.billing.reverseCharge']()}
							</div>
						{:else if vatPreview.virtual_b2c_disclaimer}
							<!-- Virtual EU B2C interim treatment (#830/BE #869): charged at
							     the organizer's rate; the buyer's country's rate may legally
							     apply via OSS. -->
							<div class="rounded bg-info/10 px-2 py-1.5 text-sm text-info" role="status">
								{m['checkout.billing.virtualB2cDisclaimer']()}
							</div>
						{/if}

						<!-- Line items breakdown -->
						{#if vatPreview.line_items.length > 0}
							<div class="space-y-1 text-xs">
								<div class="grid grid-cols-4 gap-1 border-b pb-1 font-medium text-muted-foreground">
									<span>{m['checkout.billing.lineItem']()}</span>
									<span class="text-right">{m['checkout.billing.lineNet']()}</span>
									<span class="text-right">{m['checkout.billing.lineVat']()}</span>
									<span class="text-right">{m['checkout.billing.lineGross']()}</span>
								</div>
								{#each vatPreview.line_items as item (item.tier_name)}
									<div class="grid grid-cols-4 gap-1">
										<span class="truncate"
											>{item.tier_name}
											{#if item.ticket_count > 1}×{item.ticket_count}{/if}</span
										>
										<span class="text-right tabular-nums">{currency} {item.line_net}</span>
										<span class="text-right tabular-nums">{currency} {item.line_vat}</span>
										<span class="text-right tabular-nums">{currency} {item.line_gross}</span>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Totals -->
						<div class="space-y-1 border-t pt-2 text-sm">
							<div class="flex justify-between">
								<span class="text-muted-foreground">{m['checkout.billing.totalNet']()}</span>
								<span class="tabular-nums">{vatPreview.currency} {vatPreview.total_net}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">{m['checkout.billing.totalVat']()}</span>
								<span class="tabular-nums">{vatPreview.currency} {vatPreview.total_vat}</span>
							</div>
							<div class="flex justify-between font-semibold">
								<span>{m['checkout.billing.totalGross']()}</span>
								<span class="tabular-nums">{vatPreview.currency} {vatPreview.total_gross}</span>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
