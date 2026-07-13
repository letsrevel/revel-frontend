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

<!-- Mobile cards -->
<div class="space-y-4 md:hidden">
	{#each rsvps as rsvp (rsvp.id)}
		<div class="rounded-lg border border-border bg-card p-4">
			<div class="space-y-3">
				<div class="flex items-start justify-between gap-2">
					<div class="flex items-start gap-3">
						<UserAvatar
							profilePictureUrl={rsvp.user.profile_picture_url}
							previewUrl={rsvp.user.profile_picture_preview_url}
							thumbnailUrl={rsvp.user.profile_picture_thumbnail_url}
							displayName={getUserDisplayName(rsvp.user)}
							firstName={rsvp.user.first_name}
							lastName={rsvp.user.last_name}
							size="md"
							clickable={true}
						/>
						<div>
							<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
								<p class="font-medium">{getUserDisplayName(rsvp.user)}</p>
								{#if rsvp.user.pronouns}
									<span class="text-xs text-muted-foreground">({rsvp.user.pronouns})</span>
								{/if}
								{#if rsvp.membership}
									<Badge variant="secondary" class="text-xs">
										{rsvp.membership.tier?.name
											? m['memberBadge.tierName']({ tier: rsvp.membership.tier.name })
											: m['memberBadge.member']()}
									</Badge>
								{/if}
							</div>
							<p class="text-sm text-muted-foreground">{rsvp.user.email || 'N/A'}</p>
						</div>
					</div>
					<span
						class={cn(
							'shrink-0 rounded-full px-2 py-1 text-xs font-semibold',
							getRsvpStatusColor(rsvp.status)
						)}
					>
						{getRsvpStatusLabel(rsvp.status)}
					</span>
				</div>

				<p class="text-xs text-muted-foreground">
					{m['attendeesAdmin.mobileRsvpdOn']({ date: formatDateTime(rsvp.created_at) })}
				</p>

				<div class="flex flex-wrap gap-2 border-t border-border pt-3">
					{#if !rsvp.membership && rsvp.user?.id}
						<button
							type="button"
							onclick={() => onMakeMember(rsvp)}
							disabled={addMemberPending || tiersLoading}
							class="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
						>
							<UserPlus class="h-4 w-4" aria-hidden="true" />
							{m['makeMemberAction.button']()}
						</button>
					{/if}
					<button
						type="button"
						onclick={() => onEdit(rsvp)}
						class="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
						aria-label={m['attendeesAdmin.editRsvpAriaLabel']({
							name: getUserDisplayName(rsvp.user)
						})}
					>
						<Edit class="h-4 w-4" aria-hidden="true" />
						{m['attendeesAdmin.actionEdit']()}
					</button>
					<button
						type="button"
						onclick={() => onDelete(rsvp)}
						class="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
						aria-label={m['attendeesAdmin.deleteRsvpAriaLabel']({
							name: getUserDisplayName(rsvp.user)
						})}
					>
						<Trash2 class="h-4 w-4" aria-hidden="true" />
						{m['attendeesAdmin.actionDelete']()}
					</button>
					<!-- More actions dropdown for mobile -->
					{#if rsvp.user?.id}
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								{#snippet child({ props })}
									<button
										{...props}
										class="inline-flex items-center justify-center rounded-md bg-secondary p-2 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
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
			</div>
		</div>
	{/each}
</div>
