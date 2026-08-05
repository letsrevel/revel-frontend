<script lang="ts">
	import type { MembershipRequestStatus } from '$lib/api/generated/types.gen';
	import {
		getMembershipRequestStatusLabel,
		getMembershipRequestStatusTone
	} from '$lib/utils/membership-request-status';
	import CommonStatusBadge from '$lib/components/common/StatusBadge.svelte';

	interface Props {
		status: MembershipRequestStatus;
		class?: string;
	}

	const { status, class: extraClass = '' }: Props = $props();

	const tone = $derived(getMembershipRequestStatusTone(status));
	const label = $derived(getMembershipRequestStatusLabel(status));
</script>

<!-- House `common/StatusBadge` mapper pattern (see
     `members/SubscriptionStatusBadge.svelte`): no ARIA of its own — the badge is
     named by its visible text (#795). -->
<CommonStatusBadge {tone} {label} size="sm" class={extraClass} />
