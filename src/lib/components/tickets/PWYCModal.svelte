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
	import { DollarSign } from 'lucide-svelte';
	import type { TierSchemaWithId } from '$lib/types/tickets';

	interface Props {
		open: boolean;
		tier: TierSchemaWithId;
		onClose: () => void;
		onConfirm: (amount: number) => void | Promise<void>;
		isProcessing?: boolean;
	}

	let { open = $bindable(), tier, onClose, onConfirm, isProcessing = false }: Props = $props();

	// Get min and max values from tier
	let minAmount = $derived(() => {
		if (tier.pwyc_min) {
			return typeof tier.pwyc_min === 'string' ? parseFloat(tier.pwyc_min) : tier.pwyc_min;
		}
		return 1; // Minimum is always 1
	});

	let maxAmount = $derived(() => {
		if (!tier.pwyc_max) return null;
		return typeof tier.pwyc_max === 'string' ? parseFloat(tier.pwyc_max) : tier.pwyc_max;
	});

	// State
	let amount = $state('');
	let error = $state('');

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

		if (value < minAmount()) {
			error = `Minimum amount is ${tier.currency}${minAmount().toFixed(2)}`;
			return false;
		}

		const max = maxAmount();
		if (max !== null && value > max) {
			error = `Maximum amount is ${tier.currency}${max.toFixed(2)}`;
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

	function getSuggestions(min: number, max: number | null): number[] {
		if (max !== null) {
			return [min, Math.round((min + max) / 2), max];
		}
		return [min, min * 2, min * 3];
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
					<p class="mt-1 text-xs text-muted-foreground">{tier.description}</p>
				{/if}
				<div class="mt-2 text-xs text-muted-foreground">
					Range: {tier.currency}{minAmount().toFixed(2)} - {maxAmount() !== null
						? `${tier.currency}${maxAmount()?.toFixed(2)}`
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
						min={minAmount()}
						max={maxAmount() ?? undefined}
						step="0.01"
						bind:value={amount}
						onkeydown={handleKeydown}
						class="pl-12"
						placeholder={minAmount().toFixed(2)}
						disabled={isProcessing}
						aria-invalid={error ? 'true' : 'false'}
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
					{#each getSuggestions(minAmount(), maxAmount()) as suggested}
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

		<!-- Actions -->
		<div class="flex gap-3">
			<Button variant="outline" onclick={onClose} disabled={isProcessing} class="flex-1">
				Cancel
			</Button>
			<Button onclick={handleConfirm} disabled={isProcessing || !amount.trim()} class="flex-1">
				{isProcessing ? 'Processing...' : 'Continue'}
			</Button>
		</div>
	</DialogContent>
</Dialog>
