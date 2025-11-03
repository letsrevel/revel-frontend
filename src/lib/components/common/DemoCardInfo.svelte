<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { appStore } from '$lib/stores/app.svelte';
	import { toast } from 'svelte-sonner';
	import { CreditCard, Copy, Check } from 'lucide-svelte';

	let isDemoMode = $derived(appStore.isDemoMode);
	let copied = $state(false);

	// Test card number (formatted with spaces)
	const TEST_CARD_NUMBER = '4000 0004 0000 0008';
	const TEST_CARD_RAW = '4000000400000008';

	async function copyCardNumber() {
		try {
			await navigator.clipboard.writeText(TEST_CARD_RAW);
			copied = true;
			toast.success('Card number copied!');
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (err) {
			toast.error('Failed to copy card number');
		}
	}
</script>

{#if isDemoMode}
	<div
		class="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950"
	>
		<div class="flex items-start gap-3">
			<CreditCard class="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
			<div class="flex-1 space-y-2">
				<p class="text-sm font-semibold text-blue-900 dark:text-blue-100">{m['demoCardInfo.demoPaymentTestCard']()}</p>
				<p class="text-xs text-blue-800 dark:text-blue-200">
					Use these test credentials for payment:
				</p>

				<!-- Test Card Number -->
				<div class="mt-2 flex items-center gap-2">
					<div
						class="flex-1 rounded border border-blue-300 bg-white px-3 py-2 font-mono text-sm dark:border-blue-700 dark:bg-blue-900"
					>
						{TEST_CARD_NUMBER}
					</div>
					<button
						type="button"
						onclick={copyCardNumber}
						class="rounded-md border border-blue-300 bg-white p-2 transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-700 dark:bg-blue-900 dark:hover:bg-blue-800"
						aria-label="Copy card number"
					>
						{#if copied}
							<Check class="h-4 w-4 text-green-600" aria-hidden="true" />
						{:else}
							<Copy class="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
						{/if}
					</button>
				</div>

				<!-- Other Fields -->
				<ul class="mt-2 space-y-1 text-xs text-blue-800 dark:text-blue-200">
					<li>
						<strong>{m['demoCardInfo.expiry']()}</strong> Any valid future date (e.g., 12/34)
					</li>
					<li>
						<strong>{m['demoCardInfo.cvc']()}</strong> Any 3 digits (4 for Amex)
					</li>
					<li>
						<strong>{m['demoCardInfo.otherFields']()}</strong> Any value
					</li>
				</ul>
			</div>
		</div>
	</div>
{/if}
