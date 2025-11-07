<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { OrganizationStaffSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { UserX, Settings } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';

	interface Props {
		staff: OrganizationStaffSchema;
		canRemove: boolean;
		canEditPermissions: boolean;
		onRemove: (staff: OrganizationStaffSchema) => void;
		onEditPermissions: (staff: OrganizationStaffSchema) => void;
		isRemoving?: boolean;
	}

	let {
		staff,
		canRemove,
		canEditPermissions,
		onRemove,
		onEditPermissions,
		isRemoving = false
	}: Props = $props();

	// Format staff since date
	let staffSince = $derived(formatDistanceToNow(new Date(staff.staff_since), { addSuffix: true }));

	// Display name
	let displayName = $derived(
		staff.user.preferred_name ||
			(staff.user.first_name && staff.user.last_name
				? `${staff.user.first_name} ${staff.user.last_name}`
				: staff.user.first_name || staff.user.email || 'Unknown User')
	);

	// Count active permissions
	let activePermissionsCount = $derived(
		Object.values(staff.permissions?.default || {}).filter(Boolean).length
	);

	function handleRemove() {
		if (confirm(`Are you sure you want to remove ${displayName} from staff?`)) {
			onRemove(staff);
		}
	}

	function handleEditPermissions() {
		onEditPermissions(staff);
	}
</script>

<div
	class="rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
>
	<div class="flex items-start justify-between gap-4">
		<!-- Staff Info -->
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-2">
				<h3 class="truncate font-semibold text-foreground">
					{displayName}
				</h3>
				<Badge variant="secondary" class="text-xs">{m['staffCard.staff']()}</Badge>
			</div>

			{#if staff.user.email}
				<p class="mt-1 truncate text-sm text-muted-foreground">{staff.user.email}</p>
			{/if}

			<!-- Additional Info Row -->
			<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
				{#if staff.user.phone_number}
					<span class="truncate">📞 {staff.user.phone_number}</span>
				{/if}
				{#if staff.user.pronouns}
					<span>({staff.user.pronouns})</span>
				{/if}
			</div>

			<!-- Staff Since & Permissions -->
			<div class="mt-2 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
				<span>{m['staffCard.staffSince']()} {staffSince}</span>
				<span>{activePermissionsCount} permissions granted</span>
			</div>

			<!-- Key Permissions Preview -->
			{#if staff.permissions?.default}
				<div class="mt-3 flex flex-wrap gap-1">
					{#if staff.permissions.default.create_event}
						<Badge variant="outline" class="text-xs">{m['staffCard.createEvents']()}</Badge>
					{/if}
					{#if staff.permissions.default.edit_organization}
						<Badge variant="outline" class="text-xs">{m['staffCard.editOrg']()}</Badge>
					{/if}
					{#if staff.permissions.default.manage_members}
						<Badge variant="outline" class="text-xs">{m['staffCard.manageMembers']()}</Badge>
					{/if}
					{#if activePermissionsCount > 3}
						<Badge variant="outline" class="text-xs">+{activePermissionsCount - 3} more</Badge>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex shrink-0 flex-col gap-2">
			{#if canEditPermissions}
				<Button
					variant="outline"
					size="sm"
					onclick={handleEditPermissions}
					aria-label="Edit permissions for {displayName}"
				>
					<Settings class="h-4 w-4" />
					<span class="sr-only md:not-sr-only md:ml-2">{m['staffCard.permissions']()}</span>
				</Button>
			{/if}

			{#if canRemove}
				<Button
					variant="ghost"
					size="sm"
					onclick={handleRemove}
					disabled={isRemoving}
					aria-label="Remove {displayName} from staff"
				>
					<UserX class="h-4 w-4" />
					<span class="sr-only md:not-sr-only md:ml-2">{m['staffCard.remove']()}</span>
				</Button>
			{/if}
		</div>
	</div>
</div>
