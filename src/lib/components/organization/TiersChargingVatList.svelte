<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import { AlertCircle, Loader2 } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { formatRate } from '$lib/utils/format';
	import { eventadminticketsUpdateTicketTier } from '$lib/api/generated/sdk.gen';
	import type { TierChargingVatSchema } from '$lib/api/generated/types.gen';

	interface Props {
		slug: string;
		accessToken: string | null | undefined;
		tiers: TierChargingVatSchema[];
		/** Called (after the billing-info refetch) with a polite announcement. */
		onRemoved?: (announcement: string) => void;
	}

	const { slug, accessToken, tiers, onRemoved }: Props = $props();

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
			}
		},
		// No toast: the inline role="alert" under the item is the feedback; a local handler
		// also replaces the global toast.
		onError: () => undefined,
		// Returning the refetch promise keeps the mutation (and the button) pending until the
		// list reflects the change.
		onSuccess: async (_data, tier) => {
			// The tier now inherits the default rate and drops out of the list.
			await queryClient.invalidateQueries({ queryKey: ['billing-info', slug] });
			onRemoved?.(
				m['smallBiz.tiersChargingVatRemoved']({ event: tier.event_name, tier: tier.tier_name })
			);
		},
		onSettled: (_data, _error, tier) => {
			pending[tier.tier_id] = false;
		}
	}));

	const hasRsvpOnly = $derived(tiers.some((t) => t.event_requires_ticket === false));
</script>

{#if hasRsvpOnly}
	<p
		id="small-business-tiers-rsvp-note"
		class="mb-2 text-xs text-foreground"
		data-testid="small-business-tier-rsvp-hint"
	>
		{m['smallBiz.tiersChargingVatRsvpNote']()}
	</p>
{/if}
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
					aria-describedby="small-business-tiers-rsvp-note"
					aria-busy={pending[tier.tier_id] === true}
					onclick={() => removeMutation.mutate(tier)}
				>
					{#if pending[tier.tier_id]}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{m['smallBiz.tiersChargingVatRemove']()}
				</Button>
				{#if errors[tier.tier_id]}
					<div class="mt-1 flex items-start gap-2 text-sm text-foreground" role="alert">
						<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
						<div class="space-y-1">
							<p>{errors[tier.tier_id]}</p>
							<p class="text-xs">{m['smallBiz.tiersChargingVatRemoveHelp']()}</p>
						</div>
					</div>
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
