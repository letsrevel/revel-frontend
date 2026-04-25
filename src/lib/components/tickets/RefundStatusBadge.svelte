<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';

	interface Props {
		/** Refund status from the backend payment record. May be null/unknown. */
		status: string | null | undefined;
		/** Optional refund amount + currency to surface as a tooltip on hover. */
		amount?: string | null;
		currency?: string | null;
	}

	const { status, amount, currency }: Props = $props();

	// Whitelist the statuses we know how to render. An unknown value (future
	// status, empty string, null) renders nothing instead of being silently
	// mislabeled as "failed".
	const known = $derived.by((): 'succeeded' | 'pending' | 'failed' | null => {
		if (status === 'succeeded' || status === 'pending' || status === 'failed') return status;
		return null;
	});

	const tooltip = $derived(amount && currency ? `${amount} ${currency}` : undefined);
</script>

{#if known}
	<span
		class={cn(
			'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
			known === 'succeeded' &&
				'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300',
			known === 'pending' &&
				'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
			known === 'failed' && 'border-destructive/50 bg-destructive/10 text-destructive'
		)}
		title={tooltip}
	>
		{#if known === 'succeeded'}
			{m['adminTicketTable.refundStatus.succeeded']()}
		{:else if known === 'pending'}
			{m['adminTicketTable.refundStatus.pending']()}
		{:else}
			{m['adminTicketTable.refundStatus.failed']()}
		{/if}
	</span>
{/if}
