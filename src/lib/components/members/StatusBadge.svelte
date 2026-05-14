<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getStatusConfig, type SubscriptionStatus } from '$lib/utils/subscriptions';

	interface Props {
		status: SubscriptionStatus;
		class?: string;
	}

	const { status, class: extraClass = '' }: Props = $props();

	const config = $derived(getStatusConfig(status));
	const label = $derived(
		{
			active: m['subscriptions.status.active'](),
			pending: m['subscriptions.status.pending'](),
			past_due: m['subscriptions.status.past_due'](),
			paused: m['subscriptions.status.paused'](),
			cancelled: m['subscriptions.status.cancelled'](),
			expired: m['subscriptions.status.expired']()
		}[status]
	);
</script>

<span
	class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {config.className} {extraClass}"
	aria-label={label}
>
	{label}
</span>
