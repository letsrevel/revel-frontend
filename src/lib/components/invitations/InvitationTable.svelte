<script lang="ts" generics="T extends EventInvitationListSchema | PendingEventInvitationListSchema">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		EventInvitationListSchema,
		PendingEventInvitationListSchema
	} from '$lib/api/generated/types.gen';
	import type { Snippet } from 'svelte';
	import type { SvelteSet } from 'svelte/reactivity';
	import { enhance } from '$app/forms';
	import { Trash2, Edit, CheckSquare, Square } from '@lucide/svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { Button } from '$lib/components/ui/button';
	import { getUserDisplayName } from '$lib/utils/user-display';

	interface Props {
		title: string;
		invitations: T[];
		selectedIds: SvelteSet<string>;
		invitationType: 'registered' | 'pending';
		processingId: string | null;
		onClear: () => void;
		onEdit: (invitation: T, type: 'registered' | 'pending') => void;
		identityHeaders: Snippet;
		identityCells: Snippet<[T]>;
		emptyState: Snippet;
	}

	let {
		title,
		invitations,
		selectedIds,
		invitationType,
		processingId = $bindable(),
		onClear,
		onEdit,
		identityHeaders,
		identityCells,
		emptyState
	}: Props = $props();

	function formatDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			return formatDistanceToNow(date, { addSuffix: true });
		} catch {
			return dateString;
		}
	}

	function toggleSelection(id: string) {
		if (selectedIds.has(id)) {
			selectedIds.delete(id);
		} else {
			selectedIds.add(id);
		}
	}

	function invitationLabel(
		invitation: EventInvitationListSchema | PendingEventInvitationListSchema
	): string {
		return 'user' in invitation ? getUserDisplayName(invitation.user) : invitation.email;
	}

	function toggleSelectAll() {
		const allSelected = selectedIds.size === invitations.length;
		selectedIds.clear();
		if (!allSelected) {
			for (const inv of invitations) selectedIds.add(inv.id);
		}
	}
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<h3 class="text-lg font-semibold">
			{title}
		</h3>
		{#if selectedIds.size > 0}
			<div class="flex items-center gap-2">
				<span class="text-sm text-muted-foreground">
					{m['eventInvitationsAdmin.selected']({ count: selectedIds.size })}
				</span>
				<Button size="sm" variant="outline" onclick={onClear}
					>{m['eventInvitationsAdmin.clear']()}</Button
				>
			</div>
		{/if}
	</div>

	{#if invitations.length === 0}
		<div class="rounded-lg border bg-card p-8 text-center">
			{@render emptyState()}
		</div>
	{:else}
		<div class="overflow-hidden rounded-lg border bg-card">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="border-b bg-muted/50">
						<tr>
							<th class="w-12 px-4 py-3">
								<button
									type="button"
									onclick={toggleSelectAll}
									aria-label={m['eventInvitationsAdmin.selectAll']()}
									aria-pressed={selectedIds.size === invitations.length && invitations.length > 0}
									class="flex items-center justify-center text-muted-foreground hover:text-foreground"
								>
									{#if selectedIds.size === invitations.length && invitations.length > 0}
										<CheckSquare class="h-4 w-4" aria-hidden="true" />
									{:else}
										<Square class="h-4 w-4" aria-hidden="true" />
									{/if}
								</button>
							</th>
							{@render identityHeaders()}
							<th
								class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
							>
								{m['eventInvitationsAdmin.headerProperties']()}
							</th>
							<th
								class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
							>
								{m['eventInvitationsAdmin.headerCreated']()}
							</th>
							<th
								class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
							>
								{m['eventInvitationsAdmin.headerActions']()}
							</th>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each invitations as invitation (invitation.id)}
							<tr class="transition-colors hover:bg-muted/50">
								<!-- Checkbox -->
								<td class="px-4 py-4">
									<button
										type="button"
										onclick={() => toggleSelection(invitation.id)}
										aria-label={m['eventInvitationsAdmin.selectInvitation']({
											name: invitationLabel(invitation)
										})}
										aria-pressed={selectedIds.has(invitation.id)}
										class="flex items-center justify-center text-muted-foreground hover:text-foreground"
									>
										{#if selectedIds.has(invitation.id)}
											<CheckSquare class="h-4 w-4" aria-hidden="true" />
										{:else}
											<Square class="h-4 w-4" aria-hidden="true" />
										{/if}
									</button>
								</td>

								<!-- Identity (user / email) -->
								{@render identityCells(invitation)}

								<!-- Properties -->
								<td class="px-4 py-4">
									{@render invitationProperties(invitation)}
								</td>

								<!-- Created -->
								<td class="px-4 py-4 text-sm text-muted-foreground">
									{formatDate(invitation.created_at)}
								</td>

								<!-- Actions -->
								<td class="px-4 py-4 text-right">
									<div class="flex items-center justify-end gap-2">
										<button
											type="button"
											onclick={() => onEdit(invitation, invitationType)}
											class="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
										>
											<Edit class="h-3 w-3" aria-hidden="true" />
											{m['eventInvitationsAdmin.edit']()}
										</button>
										<form
											method="POST"
											action="?/deleteInvitation"
											use:enhance={() => {
												processingId = invitation.id;
												return async ({ update }) => {
													await update();
													processingId = null;
													selectedIds.delete(invitation.id);
												};
											}}
										>
											<input type="hidden" name="invitation_id" value={invitation.id} />
											<input type="hidden" name="invitation_type" value={invitationType} />
											<button
												type="submit"
												disabled={processingId === invitation.id}
												class="inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
											>
												<Trash2 class="h-3 w-3" aria-hidden="true" />
												{m['eventInvitationsAdmin.delete']()}
											</button>
										</form>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

{#snippet invitationProperties(invitation: T)}
	<div class="flex flex-wrap gap-1">
		{#if invitation.waives_questionnaire}
			<span
				class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
				title={m['invitationListTab.waivesQuestionnaireTitle']()}
			>
				{m['eventInvitationsAdmin.noQuestionnaire']()}
			</span>
		{/if}
		{#if invitation.waives_purchase}
			<span
				class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
				title={m['invitationListTab.waivesPurchaseTitle']()}
			>
				{m['eventInvitationsAdmin.free']()}
			</span>
		{/if}
		{#if invitation.waives_membership_required}
			<span
				class="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200"
				title={m['invitationListTab.waivesMembershipTitle']()}
			>
				{m['eventInvitationsAdmin.noMembership']()}
			</span>
		{/if}
		{#if invitation.waives_rsvp_deadline}
			<span
				class="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200"
				title={m['invitationListTab.waivesRsvpDeadlineTitle']()}
			>
				{m['eventInvitationsAdmin.noDeadline']()}
			</span>
		{/if}
		{#if invitation.overrides_max_attendees}
			<span
				class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200"
				title={m['invitationListTab.overridesMaxAttendeesTitle']()}
			>
				{m['eventInvitationsAdmin.overrideCap']()}
			</span>
		{/if}
		{#if invitation.tiers?.length}
			{#each invitation.tiers as tier (tier.id)}
				<span
					class="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
					title={m['invitationListTab.assignedTierTitle']({ name: tier.name })}
				>
					{tier.name}
				</span>
			{/each}
		{/if}
		{#if invitation.custom_message}
			<span
				class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-900 dark:text-gray-200"
				title={invitation.custom_message}
			>
				Has {m['eventInvitationsAdmin.headerMessage']()}
			</span>
		{/if}
	</div>
{/snippet}
