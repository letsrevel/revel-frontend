<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import { formatRate } from '$lib/utils/format';
	import type { TierChargingVatSchema } from '$lib/api/generated/types.gen';

	interface Props {
		slug: string;
		tiers: TierChargingVatSchema[];
	}

	const { slug, tiers }: Props = $props();
</script>

<ul aria-labelledby="small-business-tiers-title" class="list-disc space-y-3 pl-5">
	{#each tiers as tier (tier.tier_id)}
		{@const label = m['smallBiz.tiersChargingVatItem']({
			event: tier.event_name,
			tier: tier.tier_name,
			rate: formatRate(tier.vat_rate)
		})}
		<li>
			<a
				href="{resolve('/(auth)/org/[slug]/admin/events/[event_id]/edit', {
					slug,
					event_id: tier.event_id
				})}?tab=ticketing"
				class="font-medium text-foreground underline underline-offset-2"
			>
				{label}<span class="sr-only"> {m['smallBiz.tiersChargingVatLinkSr']()}</span>
			</a>
		</li>
	{/each}
</ul>
