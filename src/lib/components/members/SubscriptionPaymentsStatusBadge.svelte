<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PaymentStatus } from '$lib/api/generated/types.gen';
	import CommonStatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';
	import { CircleCheck, CircleX, Clock, Undo2 } from '@lucide/svelte';

	interface Props {
		status: PaymentStatus;
	}

	const { status }: Props = $props();

	/**
	 * Thin mapper over the shared `StatusBadge` primitive. `refunded` collapses
	 * onto `neutral` rather than `danger`/`warning`: unlike a failed charge, a
	 * refund is a completed, intentional action — the icon (Undo2) and the
	 * label carry that it happened, the tone doesn't need to alarm.
	 */
	const TONE_MAP: Record<PaymentStatus, Tone> = {
		pending: 'info',
		succeeded: 'success',
		failed: 'danger',
		refunded: 'neutral'
	};

	const LABEL_MAP: Record<PaymentStatus, () => string> = {
		pending: () => m['orgAdmin.members.payments.status.pending'](),
		succeeded: () => m['orgAdmin.members.payments.status.succeeded'](),
		failed: () => m['orgAdmin.members.payments.status.failed'](),
		refunded: () => m['orgAdmin.members.payments.status.refunded']()
	};

	// Meaning is carried by the icon + the visible label; the tone is layered on
	// top and is never the only signal (WCAG 1.4.1).
	const ICON_MAP = { pending: Clock, succeeded: CircleCheck, failed: CircleX, refunded: Undo2 };

	const tone = $derived(TONE_MAP[status]);
	const label = $derived(LABEL_MAP[status]());
	const Icon = $derived(ICON_MAP[status]);
</script>

<!--
	The org-wide payments ledger row/card is addressed by this pill's status text
	plus the primitive's `data-testid` — no `aria-label`, per the #795 ruling that
	a badge is named by its content.
-->
<CommonStatusBadge {tone} {label} icon={Icon} size="sm" />
