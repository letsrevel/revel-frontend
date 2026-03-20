<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	interface Props {
		currency: string;
		minAmount: number;
		maxAmount: number | null;
		pwycAmount: string;
		pwycError: string;
		isProcessing: boolean;
		suggestions: number[];
		onAmountChange: (value: string) => void;
		onKeydown: (e: KeyboardEvent) => void;
	}

	const {
		currency,
		minAmount,
		maxAmount,
		pwycAmount,
		pwycError,
		isProcessing,
		suggestions,
		onAmountChange,
		onKeydown
	}: Props = $props();

	// Derive aria-invalid from error and validation state
	const hasError = $derived(!!pwycError);
</script>

<div class="space-y-3">
	<div class="space-y-2">
		<Label for="pwyc-amount">{m['ticketConfirmationDialog.paymentAmount']()}</Label>
		<div class="text-xs text-muted-foreground">
			Range: {currency}
			{minAmount.toFixed(2)} - {maxAmount !== null
				? `${currency} ${maxAmount.toFixed(2)}`
				: 'any amount'}
		</div>
		<div class="relative">
			<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
				{currency}
			</span>
			<Input
				id="pwyc-amount"
				type="text"
				inputmode="decimal"
				value={pwycAmount}
				oninput={(e) => {
					const val = (e.currentTarget as HTMLInputElement).value
						.replace(/,/g, '.')
						.replace(/[^\d.]/g, '');
					onAmountChange(val);
				}}
				onkeydown={onKeydown}
				class="pl-12 text-lg font-semibold"
				placeholder={minAmount.toFixed(2)}
				disabled={isProcessing}
				aria-invalid={hasError ? 'true' : 'false'}
				aria-describedby={hasError ? 'amount-error' : undefined}
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
			{#each suggestions as suggested (suggested)}
				<Button
					variant="outline"
					size="sm"
					onclick={() => {
						onAmountChange(suggested.toFixed(2));
					}}
					disabled={isProcessing}
				>
					{currency}{suggested.toFixed(2)}
				</Button>
			{/each}
		</div>
	</div>
</div>
