<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { formatPrice } from '$lib/utils/format';
	import { Tag } from '@lucide/svelte';
	import type { AdminTicketSchema } from '$lib/api';

	interface Props {
		ticket: AdminTicketSchema;
		class?: string;
	}

	const { ticket, class: className = '' }: Props = $props();

	const code = $derived(ticket.discount_code?.code ?? null);
	const currency = $derived(
		ticket.discount_code?.currency ?? ticket.payment?.currency ?? ticket.tier?.currency
	);
	const amountNum = $derived(
		ticket.discount_amount != null ? parseFloat(ticket.discount_amount) : 0
	);
	const amountLabel = $derived(
		amountNum > 0 ? formatPrice(ticket.discount_amount, currency) : null
	);
</script>

{#if code}
	<div
		class="mt-0.5 inline-flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground {className}"
		title={amountLabel
			? m['eventTicketsAdmin.discountApplied']({ code, amount: amountLabel })
			: m['eventTicketsAdmin.discountAppliedNoAmount']({ code })}
	>
		<span class="inline-flex items-center gap-1 whitespace-nowrap font-medium">
			<Tag class="h-3 w-3 shrink-0" aria-hidden="true" />
			{code}
		</span>
		{#if amountLabel}
			<span class="whitespace-nowrap">−{amountLabel}</span>
		{/if}
	</div>
{/if}
