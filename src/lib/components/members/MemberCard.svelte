<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { OrganizationMemberSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Settings } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';

	interface Props {
		member: OrganizationMemberSchema;
		isStaff?: boolean;
		canManage: boolean;
		onManage: (member: OrganizationMemberSchema) => void;
	}

	let { member, isStaff = false, canManage, onManage }: Props = $props();

	// Format member since date
	let memberSince = $derived(
		formatDistanceToNow(new Date(member.member_since), { addSuffix: true })
	);

	// Display name (preferred name or first name or email)
	let displayName = $derived(
		member.user.preferred_name ||
			(member.user.first_name && member.user.last_name
				? `${member.user.first_name} ${member.user.last_name}`
				: member.user.first_name || member.user.email || 'Unknown User')
	);

	// Status badge styling
	const statusStyles = {
		active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
		paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
		cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
		banned: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
	};

	function handleManage() {
		onManage(member);
	}
</script>

<div
	class="rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
>
	<div class="flex items-start justify-between gap-4">
		<!-- Avatar -->
		<UserAvatar
			profilePictureUrl={(member.user as any).profile_picture_url}
			thumbnailUrl={(member.user as any).profile_picture_thumbnail_url}
			{displayName}
			firstName={member.user.first_name}
			lastName={member.user.last_name}
			size="lg"
			class="shrink-0"
		/>

		<!-- Member Info -->
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<h3 class="truncate font-semibold text-foreground">
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
				<span
					class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {statusStyles[
						member.status
					]}"
				>
					{m[`memberStatus.${member.status}`]()}
				</span>

				<!-- Tier Badge -->
				{#if member.tier}
					<span
						class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-100"
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
		<div class="flex shrink-0">
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
