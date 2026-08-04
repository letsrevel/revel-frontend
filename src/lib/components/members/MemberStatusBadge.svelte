<script lang="ts">
	import type { MembershipStatus } from '$lib/api/generated/types.gen';
	import { getMemberStatusLabel, getMemberStatusTone } from '$lib/utils/member-status';
	import CommonStatusBadge from '$lib/components/common/StatusBadge.svelte';

	interface Props {
		status: MembershipStatus;
		class?: string;
	}

	const { status, class: extraClass = '' }: Props = $props();

	const tone = $derived(getMemberStatusTone(status));
	const label = $derived(getMemberStatusLabel(status));
</script>

<!--
	`aria-label` is deliberate, not redundant with the visible text: this is the
	canonical `common/StatusBadge` mapper pattern (see `members/SubscriptionStatusBadge.svelte`
	for the subscription-status sibling). The primitive has defaulted this name
	from the visible label since #788; the mapper still supplies it explicitly,
	and the enum-driven test pins it whichever side provides it.
-->
<CommonStatusBadge {tone} {label} size="sm" class={extraClass} aria-label={label} />
