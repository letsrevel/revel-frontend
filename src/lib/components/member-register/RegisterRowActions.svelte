<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { MoreVertical, Pencil, CalendarX, Trash2, Mail, Unlink, UserCog } from '@lucide/svelte';
	import { getEditability } from '$lib/member-register/editability';
	import { canUnlink } from '$lib/member-register/reconcile';

	interface Props {
		record: MembershipRecordSchema;
		/** Delete is owner-only on the backend; non-owners never see it. */
		isOwner: boolean;
		onEdit: (record: MembershipRecordSchema) => void;
		onEnd: (record: MembershipRecordSchema) => void;
		onDelete: (record: MembershipRecordSchema) => void;
		onInvite: (record: MembershipRecordSchema) => void;
		onUnlink: (record: MembershipRecordSchema) => void;
		/** Bridge to the per-member access list (until the person sheet exists). */
		onManageAccess?: (record: MembershipRecordSchema) => void;
	}

	const { record, isOwner, onEdit, onEnd, onDelete, onInvite, onUnlink, onManageAccess }: Props =
		$props();

	const canEnd = $derived(getEditability(record).canEnd);
	// The backend's `can_invite` (same helper as the invite endpoint's 400) is the
	// single source of truth. It is computed at fetch time, so an entry whose
	// valid_from passes while the page is open flips on the next refetch.
	// A linked entry already carries a badge, so its blocked reason is not repeated.
	// The reason is plain text, never a (disabled) menu item: roving focus skips
	// disabled items, which would hide it from keyboard and screen reader users.
	const blockedReason = $derived(
		!record.can_invite && record.invite_status !== 'linked' ? record.invite_blocked_reason : null
	);
	const reasonId = $derived(`invite-blocked-${record.id}`);
	const unlinkable = $derived(canUnlink(record));
	// Only a linked standard entry has an OrganizationMember behind it.
	const manageable = $derived(!!onManageAccess && !!record.user_id && record.kind === 'standard');
</script>

<!-- Row actions menu. Merge lives in the Possible duplicates dialog, where the pairs are. -->
<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				aria-describedby={blockedReason ? reasonId : undefined}
				type="button"
				data-testid="register-row-actions"
				class="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={m['memberRegister.actionsFor']({ name: record.full_name })}
			>
				<MoreVertical class="h-4 w-4" aria-hidden="true" />
			</button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Item onclick={() => onEdit(record)}>
			<Pencil aria-hidden="true" />
			{m['memberRegister.actionEdit']()}
		</DropdownMenu.Item>
		{#if manageable}
			<DropdownMenu.Item onclick={() => onManageAccess?.(record)} data-testid="manage-access">
				<UserCog aria-hidden="true" />
				{m['memberPeople.manageAccess']()}
			</DropdownMenu.Item>
		{/if}
		{#if record.can_invite}
			<DropdownMenu.Item onclick={() => onInvite(record)}>
				<Mail aria-hidden="true" />
				{record.invite_status === 'invited'
					? m['memberRegister.actionResendInvite']()
					: m['memberRegister.actionInvite']()}
			</DropdownMenu.Item>
		{/if}
		{#if unlinkable}
			<DropdownMenu.Item onclick={() => onUnlink(record)}>
				<Unlink aria-hidden="true" />
				{m['memberRegister.actionUnlink']()}
			</DropdownMenu.Item>
		{/if}
		{#if canEnd}
			<DropdownMenu.Item onclick={() => onEnd(record)}>
				<CalendarX aria-hidden="true" />
				{m['memberRegister.actionEnd']()}
			</DropdownMenu.Item>
		{/if}
		{#if isOwner}
			<DropdownMenu.Item
				onclick={() => onDelete(record)}
				class="text-destructive focus:text-destructive"
			>
				<Trash2 aria-hidden="true" />
				{m['memberRegister.actionDelete']()}
			</DropdownMenu.Item>
		{/if}
		{#if blockedReason}
			<!--
				Sighted-only copy of the reason: a disabled menu item is skipped by roving
				focus, and a text node inside a menu is not reachable by it either. Screen
				reader and keyboard users get the same sentence once, as the trigger's
				description (below), so this one is aria-hidden to avoid a double read.
			-->
			<DropdownMenu.Separator />
			<DropdownMenu.Label
				aria-hidden="true"
				class="max-w-64 text-xs font-normal text-muted-foreground"
				data-testid="invite-blocked-note"
			>
				{blockedReason}
			</DropdownMenu.Label>
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>
{#if blockedReason}
	<span id={reasonId} class="sr-only">{blockedReason}</span>
{/if}
