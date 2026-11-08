<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { MoreVertical, Pencil, CalendarX, Trash2, Mail } from '@lucide/svelte';
	import { getEditability } from '$lib/member-register/editability';
	import { canInvite } from '$lib/member-register/invite';

	interface Props {
		record: MembershipRecordSchema;
		/** Delete is owner-only on the backend; non-owners never see it. */
		isOwner: boolean;
		onEdit: (record: MembershipRecordSchema) => void;
		onEnd: (record: MembershipRecordSchema) => void;
		onDelete: (record: MembershipRecordSchema) => void;
		onInvite: (record: MembershipRecordSchema) => void;
		/** Reactive clock so a row becomes invitable once valid_from passes. */
		now?: Date;
	}

	const { record, isOwner, onEdit, onEnd, onDelete, onInvite, now }: Props = $props();

	const canEnd = $derived(getEditability(record).canEnd);
	// `now` ticks on the register page, so a row that crosses valid_from while the
	// page is open becomes invitable; the backend re-checks anyway.
	const inviteable = $derived(canInvite(record, now ?? new Date()));
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
		{#if inviteable}
			<DropdownMenu.Item onclick={() => onInvite(record)}>
				<Mail aria-hidden="true" />
				{record.invite_status === 'invited'
					? m['memberRegister.actionResendInvite']()
					: m['memberRegister.actionInvite']()}
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
