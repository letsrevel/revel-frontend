<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import { Loader2 } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { formatRate } from '$lib/utils/format';
	import { eventadminticketsUpdateTicketTier } from '$lib/api/generated/sdk.gen';
	import type { TierChargingVatSchema } from '$lib/api/generated/types.gen';

	interface Props {
		slug: string;
		accessToken: string | null | undefined;
		tiers: TierChargingVatSchema[];
	}

	const { slug, accessToken, tiers }: Props = $props();

	const queryClient = useQueryClient();

	/** Per-tier state, keyed by tier_id so errors and spinners never bleed between items. */
	const pending = $state<Record<string, boolean>>({});
	const errors = $state<Record<string, string>>({});

	const removeMutation = createMutation(() => ({
		mutationFn: async (tier: TierChargingVatSchema) => {
			pending[tier.tier_id] = true;
			errors[tier.tier_id] = '';
			try {
				const response = await eventadminticketsUpdateTicketTier({
					path: { event_id: tier.event_id, tier_id: tier.tier_id },
					headers: { Authorization: `Bearer ${accessToken}` },
					body: { vat_rate: null }
				});
				if (response.error) {
					throw new Error(
						extractErrorMessage(response.error, m['smallBiz.tiersChargingVatRemoveError']())
					);
				}
			} catch (err) {
				errors[tier.tier_id] =
					err instanceof Error ? err.message : m['smallBiz.tiersChargingVatRemoveError']();
				throw err;
			} finally {
				pending[tier.tier_id] = false;
			}
		},
		// No toast: the inline role="alert" under the item is the feedback; a local handler
		// also replaces the global toast.
		onError: () => undefined,
		onSuccess: () => {
			// The tier now inherits the default rate and drops out of the list.
			queryClient.invalidateQueries({ queryKey: ['billing-info', slug] });
		}
	}));
</script>

<ul aria-labelledby="small-business-tiers-title" class="list-disc space-y-3 pl-5">
	{#each tiers as tier (tier.tier_id)}
		{@const label = m['smallBiz.tiersChargingVatItem']({
			event: tier.event_name,
			tier: tier.tier_name,
			rate: formatRate(tier.vat_rate)
		})}
		<li>
			{#if tier.event_requires_ticket === false}
				<!-- RSVP-only: requires_ticket is immutable and there is no tier editor, so the
				     rate can only be removed from here. -->
				<span class="font-medium">{label}</span>
				<p
					id="small-business-tier-{tier.tier_id}-rsvp"
					class="mt-0.5 text-xs text-foreground"
					data-testid="small-business-tier-rsvp-hint"
				>
					{m['smallBiz.tiersChargingVatRsvpNote']()}
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="mt-1.5"
					disabled={pending[tier.tier_id] === true}
					aria-label={m['smallBiz.tiersChargingVatRemoveAria']({
						event: tier.event_name,
						tier: tier.tier_name
					})}
					aria-describedby="small-business-tier-{tier.tier_id}-rsvp"
					onclick={() => removeMutation.mutate(tier)}
				>
					{#if pending[tier.tier_id]}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{m['smallBiz.tiersChargingVatRemove']()}
				</Button>
				{#if errors[tier.tier_id]}
					<p class="mt-1 text-sm text-destructive" role="alert">{errors[tier.tier_id]}</p>
				{/if}
			{:else}
				<a
					href="{resolve('/(auth)/org/[slug]/admin/events/[event_id]/edit', {
						slug,
						event_id: tier.event_id
					})}?tab=ticketing"
					class="font-medium text-foreground underline underline-offset-2"
				>
					{label}<span class="sr-only"> {m['smallBiz.tiersChargingVatLinkSr']()}</span>
				</a>
			{/if}
		</li>
	{/each}
</ul>
