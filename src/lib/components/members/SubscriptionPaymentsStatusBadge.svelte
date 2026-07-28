<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PaymentStatus } from '$lib/api/generated/types.gen';
	import { getPaymentStatusConfig } from './SubscriptionPaymentsShared';
	import { CircleCheck, CircleX, Clock, Undo2 } from '@lucide/svelte';

	interface Props {
		status: PaymentStatus;
	}

	const { status }: Props = $props();

	const config = $derived(getPaymentStatusConfig(status));

	const label = $derived(
		{
			pending: m['orgAdmin.members.payments.status.pending'](),
			succeeded: m['orgAdmin.members.payments.status.succeeded'](),
			failed: m['orgAdmin.members.payments.status.failed'](),
			refunded: m['orgAdmin.members.payments.status.refunded']()
		}[status]
	);

	// Meaning is carried by the icon + the visible label; the tint is layered on
	// top and is never the only signal (WCAG 1.4.1).
	const Icon = $derived(
		{ pending: Clock, succeeded: CircleCheck, failed: CircleX, refunded: Undo2 }[status]
	);
</script>

<span
	class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium {config.className}"
>
	<Icon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
	<span>{label}</span>
</span>
