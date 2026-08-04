<script module lang="ts">
	/** Every status this mapper understands, in the order the regression test walks them. */
	export const REFUND_STATUS_ORDER = ['succeeded', 'pending', 'failed'] as const;
	export type KnownRefundStatus = (typeof REFUND_STATUS_ORDER)[number];
</script>

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import CommonStatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';

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
	const known = $derived.by((): KnownRefundStatus | null => {
		if (status === 'succeeded' || status === 'pending' || status === 'failed') return status;
		return null;
	});

	// `pending` takes `warning` rather than `info`: a refund sitting in "pending"
	// is money not yet back in the attendee's hands, which is closer to "needs
	// attention" than to a neutral in-progress state.
	const TONE_MAP: Record<KnownRefundStatus, Tone> = {
		succeeded: 'success',
		pending: 'warning',
		failed: 'danger'
	};

	const LABEL_MAP: Record<KnownRefundStatus, () => string> = {
		succeeded: () => m['adminTicketTable.refundStatus.succeeded'](),
		pending: () => m['adminTicketTable.refundStatus.pending'](),
		failed: () => m['adminTicketTable.refundStatus.failed']()
	};

	const tone = $derived(known ? TONE_MAP[known] : 'neutral');
	const label = $derived(known ? LABEL_MAP[known]() : '');
	const tooltip = $derived(amount && currency ? `${amount} ${currency}` : undefined);
</script>

<!--
	`aria-label` is deliberate, not redundant: this pill's accessible name is how
	the ticket table/card list surfaces are addressed by tests, and the
	`common/StatusBadge` primitive only names itself from visible text content.
	`title` carries the optional amount+currency tooltip via restProps.
-->
{#if known}
	<!-- w-fit: this sits in TicketTable/TicketCardList's flex flex-col cell, which
	     would otherwise stretch the pill to the cell's full width. -->
	<CommonStatusBadge {tone} {label} size="sm" title={tooltip} aria-label={label} class="w-fit" />
{/if}
