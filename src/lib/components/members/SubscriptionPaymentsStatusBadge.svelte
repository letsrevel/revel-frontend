<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipPaymentStatus } from '$lib/api/generated/types.gen';
	import CommonStatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';
	import { Ban, CircleCheck, CircleX, Clock, Undo2 } from '@lucide/svelte';

	interface Props {
		status: MembershipPaymentStatus;
	}

	const { status }: Props = $props();

	/**
	 * Thin mapper over the shared `StatusBadge` primitive. `refunded` collapses
	 * onto `neutral` rather than `danger`/`warning`: unlike a failed charge, a
	 * refund is a completed, intentional action — the icon (Undo2) and the
	 * label carry that it happened, the tone doesn't need to alarm.
	 */
	const TONE_MAP: Record<MembershipPaymentStatus, Tone> = {
		pending: 'info',
		succeeded: 'success',
		failed: 'danger',
		refunded: 'neutral',
		// A voided entry was a recording mistake, not money moving: neutral, like a
		// refund, and told apart by its icon and label.
		voided: 'neutral'
	};

	const LABEL_MAP: Record<MembershipPaymentStatus, () => string> = {
		pending: () => m['orgAdmin.members.payments.status.pending'](),
		succeeded: () => m['orgAdmin.members.payments.status.succeeded'](),
		failed: () => m['orgAdmin.members.payments.status.failed'](),
		refunded: () => m['orgAdmin.members.payments.status.refunded'](),
		voided: () => m['orgAdmin.members.payments.status.voided']()
	};

	// Meaning is carried by the icon + the visible label; the tone is layered on
	// top and is never the only signal (WCAG 1.4.1).
	const ICON_MAP = {
		pending: Clock,
		succeeded: CircleCheck,
		failed: CircleX,
		refunded: Undo2,
		voided: Ban
	};

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
