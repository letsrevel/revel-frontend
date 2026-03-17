<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Tag, X, ChevronDown, Loader2 } from 'lucide-svelte';
	import type { DiscountCodeValidationResponse } from '$lib/api/generated/types.gen';
	import { eventpublicticketsValidateDiscount } from '$lib/api/generated/sdk.gen';

	interface Props {
		eventId: string;
		tierId: string;
		currency: string;
		originalPrice: number;
		quantity: number;
		isProcessing: boolean;
		initialOpen?: boolean;
		initialCode?: string;
		/** The currently applied discount code */
		appliedDiscountCode: string;
		/** The validated discount result */
		discountResult: DiscountCodeValidationResponse | null;
		/** Callback when discount is applied */
		onApply: (code: string, result: DiscountCodeValidationResponse) => void;
		/** Callback when discount is removed */
		onRemove: () => void;
	}

	const {
		eventId,
		tierId,
		currency,
		originalPrice,
		quantity,
		isProcessing,
		initialOpen = false,
		initialCode = '',
		appliedDiscountCode,
		discountResult,
		onApply,
		onRemove
	}: Props = $props();

	let discountOpen = $state(initialOpen);
	let discountCodeInput = $state(initialCode);
	let isValidatingDiscount = $state(false);
	let discountError = $state('');

	// Computed discounted price
	const discountedPrice = $derived.by(() => {
		if (!discountResult?.discounted_price) return null;
		return parseFloat(discountResult.discounted_price);
	});

	const discountBadge = $derived.by(() => {
		if (!discountResult) return '';
		if (discountResult.discount_type === 'percentage') {
			return `-${discountResult.discount_value}%`;
		}
		return `-${currency} ${discountResult.discount_value}`;
	});

	async function validateDiscountCode() {
		const code = discountCodeInput.trim().toUpperCase();
		if (!code) {
			discountError = 'Please enter a discount code';
			return;
		}

		isValidatingDiscount = true;
		discountError = '';

		try {
			const response = await eventpublicticketsValidateDiscount({
				path: { event_id: eventId, tier_id: tierId },
				body: { code }
			});

			if (response.error) {
				const err = response.error as any;
				const detail = err?.detail;
				discountError =
					typeof detail === 'string'
						? detail
						: Array.isArray(detail)
							? detail.map((d: { msg?: string }) => d.msg || String(d)).join(', ')
							: 'Failed to validate code';
				return;
			}

			if (response.data) {
				if (response.data.valid) {
					discountError = '';
					onApply(code, response.data);
				} else {
					discountError = response.data.message || 'Invalid discount code';
				}
			}
		} catch {
			discountError = 'Failed to validate discount code';
		} finally {
			isValidatingDiscount = false;
		}
	}

	function handleRemove() {
		discountCodeInput = '';
		discountError = '';
		onRemove();
	}

	/** Reset input state when the parent removes the discount externally */
	export function resetInput(code: string, open: boolean) {
		discountCodeInput = code;
		discountOpen = open;
		discountError = '';
	}
</script>

<div class="rounded-lg border">
	<button
		type="button"
		onclick={() => (discountOpen = !discountOpen)}
		class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent"
		aria-expanded={discountOpen}
	>
		<span class="flex items-center gap-2">
			<Tag class="h-4 w-4" aria-hidden="true" />
			Have a discount code?
		</span>
		<ChevronDown
			class="h-4 w-4 transition-transform {discountOpen ? 'rotate-180' : ''}"
			aria-hidden="true"
		/>
	</button>

	{#if discountOpen}
		<div class="space-y-3 border-t px-4 py-3">
			{#if appliedDiscountCode && discountResult?.valid}
				<!-- Applied discount display -->
				<div class="rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/30">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Tag class="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
							<span class="font-mono font-semibold text-emerald-800 dark:text-emerald-300">
								{appliedDiscountCode}
							</span>
							<span
								class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
							>
								{discountBadge}
							</span>
						</div>
						<button
							type="button"
							onclick={handleRemove}
							disabled={isProcessing}
							class="rounded-md p-1 text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
							aria-label="Remove discount code"
						>
							<X class="h-4 w-4" />
						</button>
					</div>

					{#if discountedPrice !== null}
						<div class="mt-2 text-sm">
							<span class="text-muted-foreground line-through">
								{currency}
								{originalPrice.toFixed(2)}
							</span>
							<span class="ml-2 font-semibold text-emerald-800 dark:text-emerald-300">
								{currency}
								{discountedPrice.toFixed(2)}
							</span>
							<span class="text-muted-foreground"> / ticket</span>

							{#if quantity > 1}
								<p class="mt-1 font-medium text-emerald-800 dark:text-emerald-300">
									Total: {currency}
									{(discountedPrice * quantity).toFixed(2)}
								</p>
							{/if}
						</div>
					{/if}
				</div>
			{:else}
				<!-- Discount code input -->
				<div class="flex gap-2">
					<Input
						type="text"
						bind:value={discountCodeInput}
						placeholder="Enter code"
						disabled={isProcessing || isValidatingDiscount}
						class="flex-1 uppercase"
						aria-label="Discount code"
						aria-invalid={discountError ? 'true' : undefined}
						aria-describedby={discountError ? 'discount-error' : undefined}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								e.stopPropagation();
								validateDiscountCode();
							}
						}}
					/>
					<Button
						variant="outline"
						onclick={validateDiscountCode}
						disabled={isProcessing || isValidatingDiscount || !discountCodeInput.trim()}
					>
						{#if isValidatingDiscount}
							<Loader2 class="h-4 w-4 animate-spin" />
						{:else}
							Apply
						{/if}
					</Button>
				</div>

				{#if discountError}
					<p id="discount-error" class="text-sm text-destructive" role="alert">
						{discountError}
					</p>
				{/if}
			{/if}
		</div>
	{/if}
</div>
