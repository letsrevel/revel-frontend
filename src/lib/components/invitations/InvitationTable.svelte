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
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';

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
								class="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
							>
								{m['eventInvitationsAdmin.headerProperties']()}
							</th>
							<th
								class="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
							>
								{m['eventInvitationsAdmin.headerCreated']()}
							</th>
							<th
								class="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
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
			<StatusBadge
				tone="info"
				label={m['eventInvitationsAdmin.noQuestionnaire']()}
				size="sm"
				title={m['invitationListTab.waivesQuestionnaireTitle']()}
			/>
		{/if}
		{#if invitation.waives_purchase}
			<StatusBadge
				tone="success"
				label={m['eventInvitationsAdmin.free']()}
				size="sm"
				title={m['invitationListTab.waivesPurchaseTitle']()}
			/>
		{/if}
		{#if invitation.waives_membership_required}
			<StatusBadge
				tone="brand"
				label={m['eventInvitationsAdmin.noMembership']()}
				size="sm"
				title={m['invitationListTab.waivesMembershipTitle']()}
			/>
		{/if}
		{#if invitation.waives_rsvp_deadline}
			<StatusBadge
				tone="warning"
				label={m['eventInvitationsAdmin.noDeadline']()}
				size="sm"
				title={m['invitationListTab.waivesRsvpDeadlineTitle']()}
			/>
		{/if}
		{#if invitation.overrides_max_attendees}
			<StatusBadge
				tone="danger"
				label={m['eventInvitationsAdmin.overrideCap']()}
				size="sm"
				title={m['invitationListTab.overridesMaxAttendeesTitle']()}
			/>
		{/if}
		{#if invitation.tiers?.length}
			{#each invitation.tiers as tier (tier.id)}
				<StatusBadge
					tone="neutral"
					label={tier.name}
					size="sm"
					title={m['invitationListTab.assignedTierTitle']({ name: tier.name })}
				/>
			{/each}
		{/if}
		{#if invitation.custom_message}
			<StatusBadge
				tone="neutral"
				label={`Has ${m['eventInvitationsAdmin.headerMessage']()}`}
				size="sm"
				title={invitation.custom_message}
			/>
		{/if}
	</div>
{/snippet}
