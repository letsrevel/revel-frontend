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

<!--
	`aria-label` is deliberate and load-bearing, not redundant with the visible
	text: the subscription status is the one bit of this pill that other surfaces
	address it by, and the status word alone ("Active", "Past due") is what names
	it. It predates the shared primitive — every subscription surface (account
	hub card, org landing inline card, admin subs table/drawer) is located by it,
	so dropping it when this became a mapper silently un-named every one of them.
	Passed through here rather than baked into `common/StatusBadge`: the primitive
	has other consumers whose accessible name should keep coming from its content.
-->
<CommonStatusBadge {tone} {label} size="sm" class={extraClass} aria-label={label} />
