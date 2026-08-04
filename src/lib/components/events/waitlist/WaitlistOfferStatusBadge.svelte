<script module lang="ts">
	/** Every status this mapper understands, in the order the regression test walks them. */
	export const WAITLIST_OFFER_STATUS_ORDER = ['pending', 'claimed', 'expired', 'revoked'] as const;
</script>

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { WaitlistOfferStatus } from '$lib/api/generated/types.gen';
	import { Ban, Check, Clock, X } from '@lucide/svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';

	interface Props {
		status: WaitlistOfferStatus;
		class?: string;
	}

	const { status, class: className }: Props = $props();

	const TONE_MAP: Record<WaitlistOfferStatus, Tone> = {
		pending: 'warning',
		claimed: 'success',
		expired: 'neutral',
		revoked: 'danger'
	};

	const ICON_MAP: Record<WaitlistOfferStatus, typeof Clock> = {
		pending: Clock,
		claimed: Check,
		expired: X,
		revoked: Ban
	};

	const LABEL_MAP: Record<WaitlistOfferStatus, () => string> = {
		pending: () => m['offerStatus.pending'](),
		claimed: () => m['offerStatus.claimed'](),
		expired: () => m['offerStatus.expired'](),
		revoked: () => m['offerStatus.revoked']()
	};

	// Thin mapper over the shared StatusBadge primitive (rebrand PR 8):
	// dense waitlist admin tables, so size stays 'sm'.
	const tone = $derived(TONE_MAP[status]);
	const icon = $derived(ICON_MAP[status]);
	const label = $derived(LABEL_MAP[status]());
</script>

<!--
	aria-label is deliberate, not redundant with the visible text: this badge
	is a `common/StatusBadge` consumer (see CLAUDE.md primitive contract) and
	every domain mapper attaches its own aria-label explicitly — the primitive
	does not default it.
-->
<StatusBadge {tone} {label} {icon} size="sm" class={className} aria-label={label} />
