<script lang="ts">
	import { getStatusLabel, getStatusTone, type SubscriptionStatus } from '$lib/utils/subscriptions';
	import CommonStatusBadge from '$lib/components/common/StatusBadge.svelte';

	interface Props {
		status: SubscriptionStatus;
		class?: string;
	}

	const { status, class: extraClass = '' }: Props = $props();

	// Tone mapping lives in `utils/subscription-status.ts::getStatusTone` — the
	// single source this badge and `members/SubscriptionMetrics`'s chip strip
	// both render from (see that function's doc for the per-status reasoning),
	// so the two surfaces can't drift onto different tones for the same status.
	const tone = $derived(getStatusTone(status));
	const label = $derived(getStatusLabel(status));
</script>

<!--
	`aria-label` is deliberate and load-bearing, not redundant with the visible
	text: the subscription status is the one bit of this pill that other surfaces
	address it by, and the status word alone ("Active", "Past due") is what names
	it. It predates the shared primitive — every subscription surface (account
	hub card, org landing inline card, admin subs table/drawer) is located by it,
	so dropping it when this became a mapper silently un-named every one of them.
	#788 since baked the same default into `common/StatusBadge` itself, so this
	pass is now belt-and-suspenders rather than the only thing supplying the name.
	It stays because the enum-driven test above it is the contract, and a mapper
	that states its own accessible name cannot lose it to a primitive refactor.
-->
<CommonStatusBadge {tone} {label} size="sm" class={extraClass} aria-label={label} />
