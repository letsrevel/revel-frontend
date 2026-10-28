<script module lang="ts">
	export type StripeNotice = 'connected' | 'needsDetails' | 'expired';
</script>

<script lang="ts">
	import { CheckCircle2, AlertTriangle, X } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		notice: StripeNotice;
		onContinue: () => void;
		onDismiss: () => void;
	}

	const { notice, onContinue, onDismiss }: Props = $props();
</script>

<div
	role="status"
	data-testid="stripe-return-notice"
	class="flex items-start gap-3 rounded-xl border p-4 {notice === 'connected'
		? 'border-success/40 bg-success/10'
		: 'border-highlight/40 bg-highlight/20'}"
>
	{#if notice === 'connected'}
		<CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
	{:else}
		<AlertTriangle
			class="mt-0.5 h-5 w-5 shrink-0 text-highlight-foreground dark:text-highlight"
			aria-hidden="true"
		/>
	{/if}
	<div class="min-w-0 flex-1">
		<p class="text-sm font-medium text-foreground">
			{notice === 'connected'
				? m['orgSetup.welcome.stripeConnected']()
				: notice === 'needsDetails'
					? m['orgSetup.welcome.stripeNeedsDetails']()
					: m['orgSetup.welcome.stripeExpired']()}
		</p>
		{#if notice === 'expired'}
			<Button type="button" size="sm" class="mt-3 min-h-[44px]" onclick={onContinue}>
				{m['orgSetup.welcome.stripeContinue']()}
			</Button>
		{/if}
	</div>
	<button
		type="button"
		class="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		aria-label={m['orgSetup.welcome.stripeDismiss']()}
		onclick={onDismiss}
	>
		<X class="h-4 w-4" aria-hidden="true" />
	</button>
</div>
