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
	The canonical `common/StatusBadge` mapper pattern (see
	`members/SubscriptionStatusBadge.svelte` for the subscription-status sibling):
	enum in, tone + already-translated label out, no ARIA of its own — the badge
	is named by the text it renders (#795). The enum-driven test pins the label.
-->
<CommonStatusBadge {tone} {label} size="sm" class={extraClass} />
