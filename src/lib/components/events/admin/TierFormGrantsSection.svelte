<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/ui/label';
	import type { MembershipTierSchema } from '$lib/api/generated/types.gen';
	import { audienceBlocksGrant, GRANT_MAX_TICKETS, hasGrant } from './tier-grants';

	interface Props {
		/** `grants_membership_tier_id`; '' = grants nothing. */
		grantId: string;
		/** Locked to {@link GRANT_MAX_TICKETS} while a grant is set; restored when cleared. */
		maxTicketsPerUser: string;
		purchasableBy: string;
		/** TEMPORARY tiers of the org only (`temporaryTiers()`): the sole kind the backend accepts. */
		membershipTiers: MembershipTierSchema[];
		status?: 'ready' | 'loading' | 'error';
		/** Server message about this field (e.g. wrong org, not a temporary tier). */
		error?: string;
		isPending: boolean;
	}

	let {
		grantId = $bindable(),
		maxTicketsPerUser = $bindable(),
		purchasableBy,
		membershipTiers,
		status = 'ready',
		error = '',
		isPending
	}: Props = $props();

	const uid = $props.id();
	const helpId = `${uid}-help`;
	const blockedId = `${uid}-blocked`;
	const errorId = `${uid}-error`;

	// The picker and the audience select exclude each other: the audience select
	// disables the member-only options while a grant is set (TierFormAvailabilitySection),
	// and this picker is disabled while one of those is selected, so no state can hold both.
	const blockedByAudience = $derived(audienceBlocksGrant(purchasableBy));
	const unavailableStored = $derived(
		hasGrant(grantId) && status === 'ready' && !membershipTiers.some((tier) => tier.id === grantId)
	);
	const describedBy = $derived(
		[helpId, blockedByAudience ? blockedId : '', error ? errorId : ''].filter(Boolean).join(' ')
	);

	// Granting needs exactly one ticket per person: force 1 and remember the prior
	// value so clearing the grant puts it back.
	let savedMax: string | null = null;
	$effect(() => {
		if (hasGrant(grantId)) {
			if (maxTicketsPerUser !== GRANT_MAX_TICKETS) {
				savedMax ??= maxTicketsPerUser;
				maxTicketsPerUser = GRANT_MAX_TICKETS;
			}
		} else if (savedMax !== null) {
			maxTicketsPerUser = savedMax;
			savedMax = null;
		}
	});
</script>

<div data-testid="tier-grants-section">
	<Label for="grants-membership">{m['tierForm.grants.label']()}</Label>
	<select
		id="grants-membership"
		bind:value={grantId}
		disabled={isPending || status === 'loading' || (blockedByAudience && !hasGrant(grantId))}
		aria-describedby={describedBy}
		aria-invalid={error ? true : undefined}
		class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		<option value="">{m['tierForm.grants.none']()}</option>
		{#each membershipTiers as tier (tier.id ?? tier.name)}
			{#if tier.id}
				<option value={tier.id}>{tier.name}</option>
			{/if}
		{/each}
		{#if unavailableStored}
			<option value={grantId}>{m['tierForm.grants.unavailable']()}</option>
		{/if}
	</select>
	<p id={helpId} class="mt-1 text-xs text-muted-foreground">
		{m['tierForm.grants.help']()}
	</p>
	{#if status === 'loading' && membershipTiers.length === 0}
		<p class="mt-1 text-xs text-muted-foreground" role="status">
			{m['tierForm.grants.loading']()}
		</p>
	{:else if status === 'error' && membershipTiers.length === 0}
		<p class="mt-1 text-xs text-destructive" role="alert">{m['tierForm.grants.loadError']()}</p>
	{:else if status === 'ready' && membershipTiers.length === 0 && !hasGrant(grantId)}
		<p class="mt-1 text-xs text-muted-foreground">{m['tierForm.grants.noTiers']()}</p>
	{/if}
	{#if blockedByAudience}
		<p id={blockedId} class="mt-1 text-xs text-muted-foreground" data-testid="tier-grants-blocked">
			{m['tierForm.grants.blockedByAudience']()}
		</p>
	{/if}
	<p class="mt-1 text-xs text-muted-foreground" data-testid="tier-grants-retroactive">
		{m['tierForm.grants.retroactive']()}
	</p>
	{#if error}
		<p
			id={errorId}
			class="mt-1 text-sm text-destructive"
			role="alert"
			data-testid="tier-grants-error"
		>
			{error}
		</p>
	{/if}
</div>
