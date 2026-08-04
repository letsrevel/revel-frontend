<script lang="ts">
	import { getStatusLabel, type SubscriptionStatus } from '$lib/utils/subscriptions';
	import CommonStatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';

	interface Props {
		status: SubscriptionStatus;
		class?: string;
	}

	const { status, class: extraClass = '' }: Props = $props();

	/**
	 * Thin mapper over the shared `StatusBadge` primitive: each of the six
	 * `SubscriptionStatus` values keeps its OWN tone (no collapsing) — in
	 * particular `paused` (admin-imposed, brand) stays visually distinct from
	 * `cancelled` (over, neutral), a real distinction the old raw gray/muted
	 * pairing barely carried.
	 */
	const TONE_MAP: Record<SubscriptionStatus, Tone> = {
		active: 'success',
		pending: 'info',
		past_due: 'warning',
		paused: 'brand',
		cancelled: 'neutral',
		expired: 'danger'
	};

	const tone = $derived(TONE_MAP[status]);
	const label = $derived(getStatusLabel(status));
</script>

<CommonStatusBadge {tone} {label} size="sm" class={extraClass} />
