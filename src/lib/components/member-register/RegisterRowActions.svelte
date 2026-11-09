<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { MoreVertical, Pencil, CalendarX, Trash2, Mail } from '@lucide/svelte';
	import { getEditability } from '$lib/member-register/editability';

	interface Props {
		record: MembershipRecordSchema;
		/** Delete is owner-only on the backend; non-owners never see it. */
		isOwner: boolean;
		onEdit: (record: MembershipRecordSchema) => void;
		onEnd: (record: MembershipRecordSchema) => void;
		onDelete: (record: MembershipRecordSchema) => void;
		onInvite: (record: MembershipRecordSchema) => void;
	}

	const { record, isOwner, onEdit, onEnd, onDelete, onInvite }: Props = $props();

	const canEnd = $derived(getEditability(record).canEnd);
	// The backend's `can_invite` (same helper as the invite endpoint's 400) is the
	// single source of truth. It is computed at fetch time, so an entry whose
	// valid_from passes while the page is open flips on the next refetch.
	// A linked entry already carries a badge, so its blocked reason is not repeated.
	const blockedReason = $derived(
		!record.can_invite && record.invite_status !== 'linked' ? record.invite_blocked_reason : null
	);
	const reasonId = $derived(`invite-blocked-${record.id}`);
</script>

<!--
	Row actions menu. Later register features (merge, unlink) slot in as
	further items here without touching the table or the cards.
-->
<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
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
		{#if record.can_invite}
			<DropdownMenu.Item onclick={() => onInvite(record)}>
				<Mail aria-hidden="true" />
				{record.invite_status === 'invited'
					? m['memberRegister.actionResendInvite']()
					: m['memberRegister.actionInvite']()}
			</DropdownMenu.Item>
		{:else if blockedReason}
			<!-- Visible reason, wired up as the description so AT reads why it is disabled. -->
			<DropdownMenu.Item disabled aria-describedby={reasonId} class="items-start">
				<Mail aria-hidden="true" class="mt-0.5" />
				<span class="flex flex-col">
					<span>{m['memberRegister.actionInvite']()}</span>
					<span id={reasonId} class="text-xs font-normal text-muted-foreground"
						>{blockedReason}</span
					>
				</span>
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
	</DropdownMenu.Content>
</DropdownMenu.Root>
