<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { AlertCircle } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import { isMembershipTierRefusal } from '$lib/utils/eligibility';
	import { extractPurchaseErrorMessage } from './purchase-error';

	interface Props {
		/** Whatever the purchase path threw, or `null` when there is no error. */
		error?: unknown;
		/** The tier being bought — the only source of the required tier names. */
		tier: TierSchemaWithId;
		/**
		 * Organizing org's slug. Without it the membership link is omitted rather
		 * than guessed: a wrong destination is worse than none.
		 */
		organizationSlug?: string | null;
	}

	const { error = null, tier, organizationSlug = null }: Props = $props();

	const message = $derived(
		error ? extractPurchaseErrorMessage(error, m['ticketConfirmationDialog.errorGeneric']()) : ''
	);

	// The purchase was refused because this tier is gated to membership tiers the
	// buyer does not hold (BE #807). It is the one purchase error with somewhere
	// to send the buyer, so it gets a CTA the others don't.
	const membershipGateRefused = $derived(isMembershipTierRefusal(error));

	// Which membership tiers would satisfy the gate. The refusal payload names
	// NONE of them (and cannot say whether the buyer is a non-member or a member
	// on the wrong tier), so they come off the tier — the same list TierCard reads.
	const requiredTierNames = $derived(
		(tier.restricted_to_membership_tiers ?? []).map((t) => t.name).filter(Boolean)
	);

	// The org's membership plans: the only surface where a qualifying tier can be
	// obtained. Deliberately not "Join organization" — a plain membership request
	// grants no tier and would dead-end, which is why the backend refuses to send
	// this case down the become_member path at all.
	const membershipPlansHref = $derived(
		organizationSlug
			? `${resolve('/(public)/org/[slug]', { slug: organizationSlug })}#membership`
			: null
	);
</script>

{#if message}
	<Alert variant="destructive">
		<AlertCircle class="h-4 w-4" />
		<AlertDescription>
			<p class="font-medium">{m['ticketConfirmationDialog.unableToComplete']()}</p>
			<p class="mt-1 text-sm">{message}</p>
			{#if membershipGateRefused && requiredTierNames.length > 0}
				<p class="mt-1 text-sm" data-testid="required-membership-tiers">
					{m['tierCardAdmin.requiresMembership']({ tiers: requiredTierNames.join(', ') })}
				</p>
			{/if}
			{#if membershipGateRefused && membershipPlansHref}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() validates the route id; the appended #membership fragment cannot be expressed through resolve() -->
				<a
					href={membershipPlansHref}
					class="mt-2 inline-block text-sm font-medium underline underline-offset-4"
				>
					{m['membershipPlans.viewMembership']()}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		</AlertDescription>
	</Alert>
{/if}
