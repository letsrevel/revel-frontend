<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipTierSchema } from '$lib/api/generated/types.gen';

	interface Props {
		/** STANDARD membership tiers only (`standardTiers()`); temporary tiers are refused. */
		membershipTiers: MembershipTierSchema[];
		/** Empty = every active member is excluded; non-empty = only members of these tiers. */
		selectedIds: string[];
		/** Server message about this field (e.g. wrong audience, foreign-org id). */
		error?: string;
		isPending: boolean;
	}

	let { membershipTiers, selectedIds = $bindable(), error = '', isPending }: Props = $props();

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
	{#if membershipTiers.length > 0}
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
