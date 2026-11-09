<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { RegisterSubscriptionSummarySchema } from '$lib/api/generated/types.gen';
	import { getStatusLabel } from '$lib/utils/subscriptions';
	import { formatDate } from '$lib/utils/date';

	interface Props {
		subscription: RegisterSubscriptionSummarySchema;
	}

	const { subscription }: Props = $props();

	/**
	 * One compact line: "Subscribed · renews Dec 1, 2026" while it renews,
	 * "Subscription ends Dec 1, 2026" once it is set to end with the period, and
	 * the plain status ("Past due", "Paused", ...) for any other state.
	 */
	const text = $derived.by(() => {
		const end = subscription.current_period_end ?? null;
		if (subscription.status !== 'active') return getStatusLabel(subscription.status);
		if (subscription.cancel_at_period_end) {
			return end
				? m['memberPeople.subscription.ends']({ date: formatDate(end) })
				: m['memberPeople.subscription.active']();
		}
		return end
			? m['memberPeople.subscription.renews']({ date: formatDate(end) })
			: m['memberPeople.subscription.active']();
	});
</script>

<p
	class="text-xs text-muted-foreground"
	title={subscription.plan_name}
	data-testid="register-subscription-line"
>
	{text}
</p>
