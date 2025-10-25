<script lang="ts">
	import type { OrganizationMemberSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { UserX, UserCog } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';

	interface Props {
		member: OrganizationMemberSchema;
		isStaff?: boolean;
		canRemove: boolean;
		canMakeStaff: boolean;
		onRemove: (member: OrganizationMemberSchema) => void;
		onMakeStaff: (member: OrganizationMemberSchema) => void;
		isRemoving?: boolean;
		isPromoting?: boolean;
	}

	let {
		member,
		isStaff = false,
		canRemove,
		canMakeStaff,
		onRemove,
		onMakeStaff,
		isRemoving = false,
		isPromoting = false
	}: Props = $props();

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

	function handleRemove() {
		if (confirm(`Are you sure you want to remove ${displayName} from the organization?`)) {
			onRemove(member);
		}
	}

	function handleMakeStaff() {
		onMakeStaff(member);
	}
</script>

<div
	class="rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
>
	<div class="flex items-start justify-between gap-4">
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
						Staff
					</span>
				{/if}
			</div>

			{#if member.user.email}
				<p class="mt-1 truncate text-sm text-muted-foreground">{member.user.email}</p>
			{/if}

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
				Member since: {memberSince}
			</p>
		</div>

		<!-- Actions -->
		<div class="flex shrink-0 flex-col gap-2">
			{#if canMakeStaff}
				<Button
					variant="outline"
					size="sm"
					onclick={handleMakeStaff}
					disabled={isPromoting || isRemoving}
					aria-label="Make {displayName} a staff member"
				>
					<UserCog class="h-4 w-4" />
					<span class="sr-only md:not-sr-only md:ml-2">Make Staff</span>
				</Button>
			{/if}

			{#if canRemove}
				<Button
					variant="ghost"
					size="sm"
					onclick={handleRemove}
					disabled={isRemoving || isPromoting}
					aria-label="Remove {displayName}"
				>
					<UserX class="h-4 w-4" />
					<span class="sr-only md:not-sr-only md:ml-2">Remove</span>
				</Button>
			{/if}
		</div>
	</div>
</div>
