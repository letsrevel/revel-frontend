<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { OrganizationMemberSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Settings, StickyNote } from '@lucide/svelte';
	import { formatDistanceToNow } from 'date-fns';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import MemberStatusBadge from './MemberStatusBadge.svelte';

	interface Props {
		member: OrganizationMemberSchema;
		isStaff?: boolean;
		canManage: boolean;
		onManage: (member: OrganizationMemberSchema) => void;
		/** Open the private-note editor. Omit to hide the control (no `manage_members`). */
		onNote?: (member: OrganizationMemberSchema) => void;
	}

	const { member, isStaff = false, canManage, onManage, onNote }: Props = $props();

	// Format member since date
	const memberSince = $derived(
		formatDistanceToNow(new Date(member.member_since), { addSuffix: true })
	);

	// Display name (preferred name or first name or email)
	const displayName = $derived(
		member.user.preferred_name ||
			(member.user.first_name && member.user.last_name
				? `${member.user.first_name} ${member.user.last_name}`
				: member.user.first_name || member.user.email || 'Unknown User')
	);

	function handleManage() {
		onManage(member);
	}
</script>

<div
	class="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
>
	<div class="flex items-start justify-between gap-4">
		<!-- Avatar -->
		<UserAvatar
			profilePictureUrl={member.user.profile_picture_url}
			thumbnailUrl={member.user.profile_picture_thumbnail_url}
			{displayName}
			firstName={member.user.first_name}
			lastName={member.user.last_name}
			size="lg"
			class="shrink-0"
		/>

		<!-- Member Info -->
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<h3 class="truncate font-bold text-foreground">
					{displayName}
				</h3>
				{#if isStaff}
					<span
						class="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
					>
						{m['memberCard.staffBadge']()}
					</span>
				{/if}
			</div>

			{#if member.user.email}
				<p class="mt-1 truncate text-sm text-muted-foreground">{member.user.email}</p>
			{/if}

			<!-- Badges Row -->
			<div class="mt-2 flex flex-wrap gap-2">
				<!-- Status Badge -->
				<MemberStatusBadge status={member.status} />

				<!-- Private staff note indicator (null for staff without manage_members) -->
				{#if member.private_note}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-highlight/20 px-2 py-0.5 text-xs font-medium text-highlight-foreground dark:text-highlight"
						data-testid="member-has-note"
					>
						<StickyNote class="h-3 w-3" aria-hidden="true" />
						{m['userNote.hasNote']()}
					</span>
				{/if}

				<!-- Tier Badge -->
				{#if member.tier}
					<span
						class="inline-flex items-center rounded-full bg-info/10 px-2 py-0.5 text-xs font-medium text-info"
					>
						{member.tier.name}
					</span>
				{/if}
			</div>

			<!-- Additional Info Row -->
			<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
				{#if member.user.phone_number}
					<span class="truncate">📞 {member.user.phone_number}</span>
				{/if}
				{#if member.user.pronouns}
					<span>({member.user.pronouns})</span>
				{/if}
			</div>

			<!-- Member Since -->
			<p class="mt-2 text-xs text-muted-foreground">
				{m['memberCard.memberSince']()}: {memberSince}
			</p>
		</div>

		<!-- Actions -->
		<div class="flex shrink-0 gap-2">
			{#if onNote && member.user.id}
				<Button
					variant="outline"
					size="sm"
					onclick={() => onNote(member)}
					aria-label={m['userNote.editFor']({ name: displayName })}
				>
					<StickyNote class="h-4 w-4" aria-hidden="true" />
					<span class="sr-only md:not-sr-only md:ml-2">{m['userNote.editAction']()}</span>
				</Button>
			{/if}
			{#if canManage}
				<Button
					variant="outline"
					size="sm"
					onclick={handleManage}
					aria-label={m['memberCard.manageAriaLabel']({ name: displayName })}
				>
					<Settings class="h-4 w-4" />
					<span class="sr-only md:not-sr-only md:ml-2">{m['memberCard.manage']()}</span>
				</Button>
			{/if}
		</div>
	</div>
</div>
