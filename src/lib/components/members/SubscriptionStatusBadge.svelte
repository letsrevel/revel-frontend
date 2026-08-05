<script lang="ts">
	import { getStatusLabel, getStatusTone, type SubscriptionStatus } from '$lib/utils/subscriptions';
	import type { HTMLAttributes } from 'svelte/elements';
	import CommonStatusBadge from '$lib/components/common/StatusBadge.svelte';

	interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, 'aria-label'> {
		status: SubscriptionStatus;
		class?: string;
	}

	const { status, class: extraClass = '', ...restProps }: Props = $props();

	// Tone mapping lives in `utils/subscription-status.ts::getStatusTone` — the
	// single source this badge and `members/SubscriptionMetrics`'s chip strip
	// both render from (see that function's doc for the per-status reasoning),
	// so the two surfaces can't drift onto different tones for the same status.
	const tone = $derived(getStatusTone(status));
	const label = $derived(getStatusLabel(status));
</script>

<!--
	No `aria-label` here, or in any other mapper: per the #795 ruling the badge's
	accessible name is its visible text, and `common/StatusBadge` omits the
	attribute from its public type. Every subscription surface (account hub card,
	org landing inline card, admin subs table/drawer) that used to be located by
	that name is located by the primitive's `data-testid` plus this status text
	instead; the enum-driven test above is still the contract for the text.
-->
<CommonStatusBadge {tone} {label} size="sm" class={extraClass} {...restProps} />
