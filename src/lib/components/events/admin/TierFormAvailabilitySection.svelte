<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { MembershipTierSchema } from '$lib/api/generated/types.gen';

	interface Props {
		totalQuantity: string;
		salesStartAt: string;
		salesEndAt: string;
		salesStartReadback: string;
		salesEndReadback: string;
		visibility: 'public' | 'private' | 'members-only' | 'staff-only';
		purchasableBy: 'public' | 'members' | 'invited' | 'invited_and_members';
		restrictVisibilityToLinkedInvitations: boolean;
		restrictPurchaseToLinkedInvitations: boolean;
		restrictedToMembershipTiersIds: string[];
		membershipTiers: MembershipTierSchema[];
		isPending: boolean;
	}

	let {
		totalQuantity = $bindable(),
		salesStartAt = $bindable(),
		salesEndAt = $bindable(),
		salesStartReadback,
		salesEndReadback,
		visibility = $bindable(),
		purchasableBy = $bindable(),
		restrictVisibilityToLinkedInvitations = $bindable(),
		restrictPurchaseToLinkedInvitations = $bindable(),
		restrictedToMembershipTiersIds = $bindable(),
		membershipTiers,
		isPending
	}: Props = $props();
</script>

<!-- Total Quantity -->
<div>
	<Label for="total-quantity">{m['tierForm.totalTickets']()}</Label>
	<Input
		id="total-quantity"
		type="number"
		min="1"
		bind:value={totalQuantity}
		placeholder={m['tierForm.unlimitedPlaceholder']()}
		disabled={isPending}
	/>
	<p class="mt-1 text-xs text-muted-foreground">{m['tierForm.unlimitedTickets']()}</p>
</div>

<!-- Sales Period -->
<div class="grid grid-cols-2 gap-4">
	<div>
		<Label for="sales-start">{m['tierForm.salesStart']()}</Label>
		<Input id="sales-start" type="datetime-local" bind:value={salesStartAt} disabled={isPending} />
		{#if salesStartReadback}
			<p class="mt-1 text-xs text-muted-foreground">
				{m['dateTimePicker.selectedDate']({ value: salesStartReadback })}
			</p>
		{/if}
	</div>
	<div>
		<Label for="sales-end">{m['tierForm.salesEnd']()}</Label>
		<Input id="sales-end" type="datetime-local" bind:value={salesEndAt} disabled={isPending} />
		{#if salesEndReadback}
			<p class="mt-1 text-xs text-muted-foreground">
				{m['dateTimePicker.selectedDate']({ value: salesEndReadback })}
			</p>
		{/if}
	</div>
</div>

<!-- Visibility -->
<div>
	<Label for="visibility">{m['tierForm.visibility']()}</Label>
	<select
		id="visibility"
		bind:value={visibility}
		disabled={isPending}
		class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		<option value="public">{m['tierForm.public']()}</option>
		<option value="private">{m['tierForm.private']()}</option>
		<option value="members-only">{m['tierForm.membersOnly']()}</option>
		<option value="staff-only">{m['tierForm.staffOnly']()}</option>
	</select>

	{#if visibility === 'private'}
		<label class="mt-2 flex cursor-pointer items-start gap-2">
			<input
				type="checkbox"
				bind:checked={restrictVisibilityToLinkedInvitations}
				disabled={isPending}
				class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
			/>
			<div>
				<span class="text-sm font-medium">{m['tierForm.onlyShowLinkedInvitees']()}</span>
				<p class="text-xs text-muted-foreground">
					{m['tierForm.onlyShowLinkedInviteesHelp']()}
				</p>
			</div>
		</label>
	{/if}
</div>

<!-- Purchasable By -->
<div>
	<Label for="purchasable-by">{m['tierForm.whoCanPurchase']()}</Label>
	<select
		id="purchasable-by"
		bind:value={purchasableBy}
		disabled={isPending}
		class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		<option value="public">{m['tierForm.anyone']()}</option>
		<option value="members">{m['tierForm.membersOnly']()}</option>
		<option value="invited">{m['tierForm.invitedOnly']()}</option>
		<option value="invited_and_members">{m['tierForm.invitedAndMembers']()}</option>
	</select>

	{#if purchasableBy === 'invited' || purchasableBy === 'invited_and_members'}
		<label class="mt-2 flex cursor-pointer items-start gap-2">
			<input
				type="checkbox"
				bind:checked={restrictPurchaseToLinkedInvitations}
				disabled={isPending}
				class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
			/>
			<div>
				<span class="text-sm font-medium">{m['tierForm.onlyAllowPurchaseLinkedInvitees']()}</span>
				<p class="text-xs text-muted-foreground">
					{m['tierForm.onlyAllowPurchaseLinkedInviteesHelp']()}
				</p>
			</div>
		</label>
	{/if}
</div>

<!-- Restricted to Membership Tiers -->
{#if (purchasableBy === 'members' || purchasableBy === 'invited_and_members') && membershipTiers.length > 0}
	<div>
		<Label for="restricted-tiers">{m['tierForm.restrictToMembershipTiers']()}</Label>
		<p class="mb-2 text-xs text-muted-foreground">
			{m['tierForm.restrictToMembershipTiersHelp']()}
		</p>
		<div class="space-y-2 rounded-md border border-input bg-background p-3">
			{#each membershipTiers as tier (tier.id ?? tier.name)}
				{#if tier.id}
					<label class="flex cursor-pointer items-start gap-2">
						<input
							type="checkbox"
							checked={restrictedToMembershipTiersIds.includes(tier.id)}
							onchange={(e) => {
								const checked = e.currentTarget.checked;
								if (checked && tier.id && !restrictedToMembershipTiersIds.includes(tier.id)) {
									restrictedToMembershipTiersIds = [...restrictedToMembershipTiersIds, tier.id];
								} else if (!checked && tier.id) {
									restrictedToMembershipTiersIds = restrictedToMembershipTiersIds.filter(
										(id) => id !== tier.id
									);
								}
							}}
							disabled={isPending}
							class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
						/>
						<div class="flex-1">
							<span class="text-sm font-medium">{tier.name}</span>
							{#if tier.description}
								<p class="text-xs text-muted-foreground">{tier.description}</p>
							{/if}
						</div>
					</label>
				{/if}
			{/each}
		</div>
	</div>
{/if}
