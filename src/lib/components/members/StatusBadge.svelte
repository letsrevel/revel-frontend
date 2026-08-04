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
	 * Thin mapper over the shared `StatusBadge` primitive. `brand` is reserved
	 * for emphasis, not for a suspended state, so `paused` takes `warning`
	 * (needs attention) instead — it does not share `active`'s `success`, and
	 * it stays visually louder than the two terminal states. `past_due` is a
	 * harder problem than "pending payment" (it risks losing access), so it
	 * escalates to `danger`. `cancelled` and `expired` collapse onto the same
	 * `neutral` tone deliberately: both are terminal/over, and the label text
	 * ("Cancelled" vs "Expired") — not the tone — carries the distinction.
	 */
	const TONE_MAP: Record<SubscriptionStatus, Tone> = {
		active: 'success',
		pending: 'info',
		past_due: 'danger',
		paused: 'warning',
		cancelled: 'neutral',
		expired: 'neutral'
	};

	const tone = $derived(TONE_MAP[status]);
	const label = $derived(getStatusLabel(status));
</script>

<CommonStatusBadge {tone} {label} size="sm" class={extraClass} />
