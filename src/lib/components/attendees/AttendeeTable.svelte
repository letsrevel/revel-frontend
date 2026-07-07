<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import { getRsvpStatusColor, getRsvpStatusLabel } from '$lib/utils/status-colors';
	import { formatDateTime } from '$lib/utils/date';
	import { Edit, Trash2, UserPlus, MoreVertical, Ban } from '@lucide/svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Badge } from '$lib/components/ui/badge';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import type { RsvpDetailSchema } from '$lib/api/generated/types.gen';

	interface Props {
		rsvps: RsvpDetailSchema[];
		addMemberPending: boolean;
		tiersLoading: boolean;
		onMakeMember: (rsvp: RsvpDetailSchema) => void;
		onEdit: (rsvp: RsvpDetailSchema) => void;
		onDelete: (rsvp: RsvpDetailSchema) => void;
		onBlacklist: (rsvp: RsvpDetailSchema) => void;
	}

	const {
		rsvps,
		addMemberPending,
		tiersLoading,
		onMakeMember,
		onEdit,
		onDelete,
		onBlacklist
	}: Props = $props();
</script>

<!-- Desktop table -->
<div class="hidden overflow-hidden rounded-lg border border-border md:block">
	<table class="w-full">
		<thead class="bg-muted/50">
			<tr>
				<th
					class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
				>
					{m['attendeesAdmin.tableHeaderName']()}
				</th>
				<th
					class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
				>
					{m['attendeesAdmin.tableHeaderEmail']()}
				</th>
				<th
					class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
				>
					{m['attendeesAdmin.tableHeaderStatus']()}
				</th>
				<th
					class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
				>
					{m['attendeesAdmin.tableHeaderRsvpDate']()}
				</th>
				<th
					class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
				>
					{m['attendeesAdmin.tableHeaderActions']()}
				</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-border bg-card">
			{#each rsvps as rsvp (rsvp.id)}
				<tr class="hover:bg-muted/50">
					<td class="whitespace-nowrap px-6 py-4 text-sm font-medium">
						<div class="flex items-center gap-3">
							<UserAvatar
								profilePictureUrl={rsvp.user.profile_picture_url}
								previewUrl={rsvp.user.profile_picture_preview_url}
								thumbnailUrl={rsvp.user.profile_picture_thumbnail_url}
								displayName={getUserDisplayName(rsvp.user)}
								firstName={rsvp.user.first_name}
								lastName={rsvp.user.last_name}
								size="sm"
								clickable={true}
							/>
							<div class="flex flex-col">
								<div class="flex items-center gap-2">
									<span>{getUserDisplayName(rsvp.user)}</span>
									{#if rsvp.user.pronouns}
										<span class="text-xs text-muted-foreground">({rsvp.user.pronouns})</span>
									{/if}
								</div>
								{#if rsvp.membership}
									<Badge variant="secondary" class="mt-0.5 w-fit text-xs">
										{rsvp.membership.tier?.name
											? m['memberBadge.tierName']({ tier: rsvp.membership.tier.name })
											: m['memberBadge.member']()}
									</Badge>
								{/if}
							</div>
						</div>
					</td>
					<td class="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
						{rsvp.user.email || 'N/A'}
					</td>
					<td class="whitespace-nowrap px-6 py-4 text-sm">
						<span
							class={cn(
								'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
								getRsvpStatusColor(rsvp.status)
							)}
						>
							{getRsvpStatusLabel(rsvp.status)}
						</span>
					</td>
					<td class="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
						{formatDateTime(rsvp.created_at)}
					</td>
					<td class="whitespace-nowrap px-6 py-4 text-right text-sm">
						<div class="flex items-center justify-end gap-2">
							{#if !rsvp.membership && rsvp.user?.id}
								<button
									type="button"
									onclick={() => onMakeMember(rsvp)}
									disabled={addMemberPending || tiersLoading}
									class="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
									aria-label={m['attendeesAdmin.makeMemberAriaLabel']({
										name: getUserDisplayName(rsvp.user)
									})}
								>
									<UserPlus class="h-3 w-3" aria-hidden="true" />
									{m['makeMemberAction.button']()}
								</button>
							{/if}
							<button
								type="button"
								onclick={() => onEdit(rsvp)}
								class="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
								aria-label={m['attendeesAdmin.editRsvpAriaLabel']({
									name: getUserDisplayName(rsvp.user)
								})}
							>
								<Edit class="h-3 w-3" aria-hidden="true" />
								{m['attendeesAdmin.actionEdit']()}
							</button>
							<button
								type="button"
								onclick={() => onDelete(rsvp)}
								class="inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
								aria-label={m['attendeesAdmin.deleteRsvpAriaLabel']({
									name: getUserDisplayName(rsvp.user)
								})}
							>
								<Trash2 class="h-3 w-3" aria-hidden="true" />
								{m['attendeesAdmin.actionDelete']()}
							</button>
							<!-- More actions dropdown -->
							{#if rsvp.user?.id}
								<DropdownMenu.Root>
									<DropdownMenu.Trigger>
										{#snippet child({ props })}
											<button
												{...props}
												class="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
												aria-label={m['attendeesAdmin.moreActionsForAriaLabel']({
													name: getUserDisplayName(rsvp.user)
												})}
											>
												<MoreVertical class="h-4 w-4" aria-hidden="true" />
											</button>
										{/snippet}
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="end">
										<DropdownMenu.Item
											onclick={() => onBlacklist(rsvp)}
											class="text-destructive focus:text-destructive"
										>
											<Ban class="mr-2 h-4 w-4" aria-hidden="true" />
											{m['attendeesAdmin.blacklistUser']()}
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							{/if}
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
