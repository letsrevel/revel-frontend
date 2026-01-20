<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { DollarSign, AlertCircle } from 'lucide-svelte';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';

	interface Props {
		open: boolean;
		tier: TierSchemaWithId;
		onClose: () => void;
		onConfirm: (amount: number) => void | Promise<void>;
		isProcessing?: boolean;
	}

	let { open = $bindable(), tier, onClose, onConfirm, isProcessing = false }: Props = $props();

	// Get min and max values from tier
	let minAmount = $derived.by(() => {
		if (tier.pwyc_min) {
			return typeof tier.pwyc_min === 'string' ? parseFloat(tier.pwyc_min) : tier.pwyc_min;
		}
		return 1; // Minimum is always 1
	});

	let maxAmount = $derived.by(() => {
		if (!tier.pwyc_max) return null;
		return typeof tier.pwyc_max === 'string' ? parseFloat(tier.pwyc_max) : tier.pwyc_max;
	});

	// State
	let amount = $state('');
	let error = $state('');

	// Validation state for button disabled and UI hints
	let amountValidation = $derived.by(() => {
		const trimmed = amount.trim();
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

	// Quick amount suggestions
	let suggestions = $derived.by(() => {
		if (maxAmount !== null) {
			return [minAmount, Math.round((minAmount + maxAmount) / 2), maxAmount];
		}
		return [minAmount, minAmount * 2, minAmount * 3];
	});

	// Reset state when dialog opens/closes
	$effect(() => {
		if (!open) {
			amount = '';
			error = '';
		}
	});

	// Validation
	function validateAmount(): boolean {
		error = '';

		if (!amount.trim()) {
			error = 'Please enter an amount';
			return false;
		}

		const value = parseFloat(amount);

		if (isNaN(value)) {
			error = 'Please enter a valid number';
			return false;
		}

		if (value < minAmount) {
			error = `Minimum amount is ${tier.currency}${minAmount.toFixed(2)}`;
			return false;
		}

		if (maxAmount !== null && value > maxAmount) {
			error = `Maximum amount is ${tier.currency}${maxAmount.toFixed(2)}`;
			return false;
		}

		return true;
	}

	async function handleConfirm() {
		if (!validateAmount()) return;

		const value = parseFloat(amount);
		await onConfirm(value);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleConfirm();
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['pwycModal.pwyc']()}</DialogTitle>
			<DialogDescription>{m['pwycModal.chooseAmount']()}</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 py-4">
			<!-- Tier Info -->
			<div class="rounded-md border border-border bg-muted p-3">
				<div class="flex items-center gap-2 text-sm font-medium">
					<DollarSign class="h-4 w-4 text-primary" aria-hidden="true" />
					<span>{tier.name}</span>
				</div>
				{#if tier.description}
					<MarkdownContent content={tier.description} class="mt-1 text-xs text-muted-foreground" />
				{/if}
				<div class="mt-2 text-xs text-muted-foreground">
					Range: {tier.currency}{minAmount.toFixed(2)} - {maxAmount !== null
						? `${tier.currency}${maxAmount.toFixed(2)}`
						: 'any amount'}
				</div>
			</div>

			<!-- Amount Input -->
			<div class="space-y-2">
				<Label for="pwyc-amount">{m['pwycModal.amount']()} ({tier.currency})</Label>
				<div class="relative">
					<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
						{tier.currency}
					</span>
					<Input
						id="pwyc-amount"
						type="number"
						min={minAmount}
						max={maxAmount ?? undefined}
						step="0.01"
						value={amount}
						oninput={(e) => {
							amount = e.currentTarget.value;
							error = '';
						}}
						onkeydown={handleKeydown}
						class="pl-12"
						placeholder={minAmount.toFixed(2)}
						disabled={isProcessing}
						aria-invalid={error || !amountValidation.valid ? 'true' : 'false'}
						aria-describedby={error ? 'amount-error' : undefined}
					/>
				</div>
				{#if error}
					<p id="amount-error" class="text-sm text-destructive" role="alert">
						{error}
					</p>
				{/if}
			</div>

			<!-- Quick Amount Suggestions -->
			<div class="space-y-2">
				<p class="text-sm font-medium">{m['pwycModal.quickSelect']()}</p>
				<div class="grid grid-cols-3 gap-2">
					{#each suggestions as suggested (suggested)}
						<Button
							variant="outline"
							size="sm"
							onclick={() => {
								amount = suggested.toFixed(2);
								error = '';
							}}
							disabled={isProcessing}
						>
							{tier.currency}{suggested.toFixed(2)}
						</Button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Validation hint when button would be disabled -->
		{#if !amountValidation.valid && !isProcessing}
			<p class="text-center text-sm text-amber-600 dark:text-amber-500">
				<AlertCircle class="mr-1 inline-block h-4 w-4" />
				{#if amountValidation.error === 'empty'}
					Please enter a payment amount
				{:else if amountValidation.error === 'invalid'}
					Please enter a valid number
				{:else if amountValidation.error === 'below_min'}
					Amount must be at least {tier.currency}{minAmount.toFixed(2)}
				{:else if amountValidation.error === 'above_max'}
					Amount cannot exceed {tier.currency}{maxAmount?.toFixed(2)}
				{/if}
			</p>
		{/if}

		<!-- Actions -->
		<div class="flex gap-3">
			<Button variant="outline" onclick={onClose} disabled={isProcessing} class="flex-1">
				Cancel
			</Button>
			<Button
				onclick={handleConfirm}
				disabled={isProcessing || !amountValidation.valid}
				class="flex-1"
			>
				{isProcessing ? 'Processing...' : 'Continue'}
			</Button>
		</div>
	</DialogContent>
</Dialog>
