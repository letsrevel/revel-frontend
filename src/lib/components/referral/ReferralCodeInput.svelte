<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Gift, X, ChevronDown, Loader2, Check } from 'lucide-svelte';
	import { referralValidate } from '$lib/api/generated/sdk.gen';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		/** Pre-filled referral code (e.g. from ?ref= query param) */
		initialCode?: string;
		/** Whether the parent form is currently submitting */
		isProcessing: boolean;
		/** The currently validated referral code (bound to parent) */
		validatedCode: string;
		/** Callback when a code is validated */
		onValidated: (code: string) => void;
		/** Callback when the code is removed */
		onRemove: () => void;
	}

	const { initialCode = '', isProcessing, validatedCode, onValidated, onRemove }: Props = $props();

	let isOpen = $state(!!initialCode);
	let codeInput = $state(initialCode);
	let isValidating = $state(false);
	let errorMessage = $state('');
	let autoValidated = $state(false);

	// Auto-validate initial code on mount
	$effect(() => {
		if (initialCode && !autoValidated && !validatedCode) {
			autoValidated = true;
			codeInput = initialCode;
			isOpen = true;
			validateCode();
		}
	});

	async function validateCode() {
		const code = codeInput.trim().toUpperCase();
		if (!code) {
			errorMessage = m['referral.enterCode']();
			return;
		}

		isValidating = true;
		errorMessage = '';

		try {
			const response = await referralValidate({
				query: { code }
			});

			if (response.response?.status === 404) {
				errorMessage = m['referral.invalidCode']();
				return;
			}

			if (response.error || !response.data) {
				errorMessage = m['referral.validationFailed']();
				return;
			}

			if (response.data.valid) {
				errorMessage = '';
				onValidated(code);
			} else {
				errorMessage = m['referral.invalidCode']();
			}
		} catch {
			errorMessage = m['referral.validationFailed']();
		} finally {
			isValidating = false;
		}
	}

	function handleRemove() {
		codeInput = '';
		errorMessage = '';
		onRemove();
	}
</script>

<div class="rounded-lg border">
	<button
		type="button"
		onclick={() => (isOpen = !isOpen)}
		class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent"
		aria-expanded={isOpen}
	>
		<span class="flex items-center gap-2">
			<Gift class="h-4 w-4" aria-hidden="true" />
			{m['referral.haveReferralCode']()}
		</span>
		<ChevronDown
			class="h-4 w-4 transition-transform {isOpen ? 'rotate-180' : ''}"
			aria-hidden="true"
		/>
	</button>

	{#if isOpen}
		<div class="space-y-3 border-t px-4 py-3">
			{#if validatedCode}
				<!-- Applied code display -->
				<div class="rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/30">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Check class="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
							<span class="font-mono font-semibold text-emerald-800 dark:text-emerald-300">
								{validatedCode}
							</span>
						</div>
						<button
							type="button"
							onclick={handleRemove}
							disabled={isProcessing}
							class="rounded-md p-1 text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
							aria-label={m['referral.removeCode']()}
						>
							<X class="h-4 w-4" />
						</button>
					</div>
					<p class="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
						{m['referral.validCode']()}
					</p>
				</div>
			{:else}
				<!-- Code input -->
				<div class="flex gap-2">
					<Input
						type="text"
						bind:value={codeInput}
						placeholder={m['referral.enterCode']()}
						disabled={isProcessing || isValidating}
						class="flex-1 uppercase"
						aria-label={m['referral.haveReferralCode']()}
						aria-invalid={errorMessage ? 'true' : undefined}
						aria-describedby={errorMessage ? 'referral-error' : undefined}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								e.stopPropagation();
								validateCode();
							}
						}}
					/>
					<Button
						variant="outline"
						onclick={validateCode}
						disabled={isProcessing || isValidating || !codeInput.trim()}
					>
						{#if isValidating}
							<Loader2 class="h-4 w-4 animate-spin" />
						{:else}
							{m['referral.apply']()}
						{/if}
					</Button>
				</div>

				{#if errorMessage}
					<p id="referral-error" class="text-sm text-destructive" role="alert">
						{errorMessage}
					</p>
				{/if}
			{/if}
		</div>
	{/if}
</div>
