<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipTierSchema } from '$lib/api/generated/types.gen';

	interface Props {
		/** STANDARD membership tiers only (`standardTiers()`); temporary tiers are refused. */
		membershipTiers: MembershipTierSchema[];
		/** State of the org membership-tiers query; an empty list only means "none" once ready. */
		status?: 'ready' | 'loading' | 'error';
		/** Exclusions already stored on the tier being edited (names for ids not in the list). */
		knownExcludedTiers?: MembershipTierSchema[];
		/** Empty = every active member is excluded; non-empty = only members of these tiers. */
		selectedIds: string[];
		/** Server message about this field (e.g. wrong audience, foreign-org id). */
		error?: string;
		isPending: boolean;
	}

	let {
		membershipTiers,
		status = 'ready',
		knownExcludedTiers = [],
		selectedIds = $bindable(),
		error = '',
		isPending
	}: Props = $props();

	// Stored ids missing from the loaded list (deleted, temporary, or the list failed to
	// load) must stay visible and untickable, or they would be sent invisibly.
	const unavailableIds = $derived(
		selectedIds.filter((id) => !membershipTiers.some((tier) => tier.id === id))
	);
	function unavailableName(id: string): string {
		return (
			knownExcludedTiers.find((tier) => tier.id === id)?.name ??
			m['tierForm.excludedMembershipTierUnavailable']()
		);
	}

	const uid = $props.id();
	const helpId = `${uid}-help`;
	const errorId = `${uid}-error`;

	function toggle(id: string, checked: boolean): void {
		selectedIds = checked
			? selectedIds.includes(id)
				? selectedIds
				: [...selectedIds, id]
			: selectedIds.filter((existing) => existing !== id);
	}
</script>

<fieldset
	class="space-y-2"
	aria-describedby={error ? `${helpId} ${errorId}` : helpId}
	data-testid="tier-excluded-tiers"
>
	<legend class="text-sm font-medium">{m['tierForm.excludedMembershipTiers']()}</legend>
	<p id={helpId} class="text-xs text-muted-foreground">
		{m['tierForm.excludedMembershipTiersHelp']()}
	</p>
	{#if status === 'loading' && membershipTiers.length === 0}
		<p class="text-xs text-muted-foreground" role="status" data-testid="tier-excluded-loading">
			{m['tierForm.excludedMembershipTiersLoading']()}
		</p>
	{:else if status === 'error' && membershipTiers.length === 0 && unavailableIds.length === 0}
		<p class="text-xs text-destructive" role="alert" data-testid="tier-excluded-load-error">
			{m['tierForm.excludedMembershipTiersLoadError']()}
		</p>
	{:else if membershipTiers.length > 0 || unavailableIds.length > 0}
		<div class="space-y-2 rounded-md border border-input bg-background p-3">
			{#each membershipTiers as tier (tier.id ?? tier.name)}
				{#if tier.id}
					{@const tierId = tier.id}
					<label class="flex cursor-pointer items-start gap-2">
						<input
							type="checkbox"
							checked={selectedIds.includes(tierId)}
							onchange={(e) => toggle(tierId, e.currentTarget.checked)}
							disabled={isPending}
							class="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary"
						/>
						<span class="text-sm font-medium">{tier.name}</span>
					</label>
				{/if}
			{/each}
			{#each unavailableIds as id (id)}
				<label
					class="flex cursor-pointer items-start gap-2"
					data-testid="tier-excluded-unavailable"
				>
					<input
						type="checkbox"
						checked
						onchange={(e) => toggle(id, e.currentTarget.checked)}
						disabled={isPending}
						class="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary"
					/>
					<span class="text-sm font-medium">{unavailableName(id)}</span>
				</label>
			{/each}
		</div>
	{:else}
		<p class="text-xs text-muted-foreground">{m['tierForm.excludedMembershipTiersNone']()}</p>
	{/if}
	{#if error}
		<p id={errorId} class="text-sm text-destructive" role="alert" data-testid="tier-excluded-error">
			{error}
		</p>
	{/if}
</fieldset>
