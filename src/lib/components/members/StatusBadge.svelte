<script lang="ts">
	import {
		getStatusConfig,
		getStatusLabel,
		type SubscriptionStatus
	} from '$lib/utils/subscriptions';

	interface Props {
		status: SubscriptionStatus;
		class?: string;
	}

	const { status, class: extraClass = '' }: Props = $props();

	const config = $derived(getStatusConfig(status));
	const label = $derived(getStatusLabel(status));
</script>

<span
	class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {config.className} {extraClass}"
	aria-label={label}
>
	{label}
</span>
