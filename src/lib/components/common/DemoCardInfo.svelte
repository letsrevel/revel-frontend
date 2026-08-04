<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { appStore } from '$lib/stores/app.svelte';
	import { toast } from 'svelte-sonner';
	import { CreditCard, Copy, Check } from '@lucide/svelte';

	const isDemoMode = $derived(appStore.isDemoMode);
	let copied = $state(false);

	// Test card number (formatted with spaces)
	const TEST_CARD_NUMBER = '4000 0004 0000 0008';
	const TEST_CARD_RAW = '4000000400000008';

	async function copyCardNumber() {
		try {
			await navigator.clipboard.writeText(TEST_CARD_RAW);
			copied = true;
			toast.success(m['demoCardInfo.cardNumberCopied']());
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			toast.error(m['demoCardInfo.copyFailed']());
		}
	}
</script>

{#if isDemoMode}
	<!-- Demo → info tone (matches DemoBanner). text-info on bg-info/10 measures
	     8.27:1 light / 7.98:1 dark (see DemoBanner for the base computation);
	     the heading here is the same pair, just bolder. -->
	<div class="mt-4 rounded-md border border-info/30 bg-info/10 p-4">
		<div class="flex items-start gap-3">
			<CreditCard class="mt-0.5 h-5 w-5 flex-shrink-0 text-info" />
			<div class="flex-1 space-y-2">
				<h3 class="text-sm font-bold text-info">
					{m['demoCardInfo.demoPaymentTestCard']()}
				</h3>
				<p class="text-xs text-info">
					{m['demoCardInfo.useTestCredentials']()}
				</p>

				<!-- Test Card Number -->
				<div class="mt-2 flex items-center gap-2">
					<div
						class="flex-1 rounded border border-info/30 bg-card px-3 py-2 font-mono text-sm text-card-foreground"
					>
						{TEST_CARD_NUMBER}
					</div>
					<button
						type="button"
						onclick={copyCardNumber}
						class="rounded-md border border-info/30 bg-card p-2 transition-colors hover:bg-info/10 focus:outline-none focus:ring-2 focus:ring-info"
						aria-label={m['demoCardInfo.copyCardNumber']()}
					>
						{#if copied}
							<Check class="h-4 w-4 text-success" aria-hidden="true" />
						{:else}
							<Copy class="h-4 w-4 text-info" aria-hidden="true" />
						{/if}
					</button>
				</div>

				<!-- Other Fields -->
				<ul class="mt-2 space-y-1 text-xs text-info">
					<li>
						<strong>{m['demoCardInfo.expiry']()}</strong>
						{m['demoCardInfo.expiryValue']()}
					</li>
					<li>
						<strong>{m['demoCardInfo.cvc']()}</strong>
						{m['demoCardInfo.cvcValue']()}
					</li>
					<li>
						<strong>{m['demoCardInfo.otherFields']()}</strong>
						{m['demoCardInfo.otherFieldsValue']()}
					</li>
				</ul>
			</div>
		</div>
	</div>
{/if}
