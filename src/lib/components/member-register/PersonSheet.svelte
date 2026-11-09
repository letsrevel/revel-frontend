<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Receipt } from '@lucide/svelte';
	import type { MembershipRecordSchema, MembershipTierSchema } from '$lib/api/generated/types.gen';
	import {
		Sheet,
		SheetContent,
		SheetDescription,
		SheetHeader,
		SheetTitle
	} from '$lib/components/ui/sheet';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import { Button } from '$lib/components/ui/button';
	import StaffNoteEditor from '$lib/components/members/StaffNoteEditor.svelte';
	import PersonStatusCell from './PersonStatusCell.svelte';
	import PersonMembershipSection from './PersonMembershipSection.svelte';
	import PersonPeriods from './PersonPeriods.svelte';
	import PersonAccountSection from './PersonAccountSection.svelte';

	interface Props {
		/** The entry the sheet is about; null while closed. */
		record: MembershipRecordSchema | null;
		slug: string;
		accessToken: string | null | undefined;
		/** Standard tiers, for the change-tier picker of the member actions. */
		tiers: MembershipTierSchema[];
		staffUserIds: Set<string>;
		isOwner: boolean;
		/** The Payments tab exists for this viewer (`manage_subscriptions`). */
		canOpenPayments: boolean;
		onClose: () => void;
		onEdit: (record: MembershipRecordSchema) => void;
		onEnd: (record: MembershipRecordSchema) => void;
		onDelete: (record: MembershipRecordSchema) => void;
		onInvite: (record: MembershipRecordSchema) => void;
		onUnlink: (record: MembershipRecordSchema) => void;
		onOpenPayments: () => void;
	}

	const {
		record,
		slug,
		accessToken,
		tiers,
		staffUserIds,
		isOwner,
		canOpenPayments,
		onClose,
		onEdit,
		onEnd,
		onDelete,
		onInvite,
		onUnlink,
		onOpenPayments
	}: Props = $props();

	const merged = $derived(!!record?.merged_into_id);
</script>

<!--
	Modal side sheet: focus moves in on open, Escape / the close button / the
	overlay dismiss it, and focus returns to the row that opened it. The title
	is the heading the dialog is named by.
-->
<Sheet open={record !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
	<SheetContent class="gap-6" data-testid="person-sheet">
		{#if record}
			<SheetHeader class="space-y-2 pr-8 text-left">
				<SheetTitle class="break-words text-2xl font-extrabold tracking-tight">
					{record.full_name}
				</SheetTitle>
				<SheetDescription class="sr-only">{m['memberPeople.sheet.description']()}</SheetDescription>
				{#if record.email}
					<p class="break-all text-sm text-muted-foreground">{record.email}</p>
				{/if}
				<PersonStatusCell {record} />
			</SheetHeader>

			<PersonMembershipSection
				{record}
				{slug}
				{accessToken}
				{tiers}
				{isOwner}
				isStaff={!!record.user_id && staffUserIds.has(record.user_id)}
				{onEdit}
				{onEnd}
				{onDelete}
				{onInvite}
			/>

			<PersonPeriods {record} {slug} {accessToken} />

			{#if merged}
				<section class="space-y-2" aria-labelledby="staff-note-heading">
					<SectionHeader
						id="staff-note-heading"
						level={3}
						title={m['memberPeople.sheet.noteHeading']()}
					/>
					<p class="text-sm text-muted-foreground" data-testid="staff-note-merged">
						{m['memberPeople.sheet.mergedNote']()}
					</p>
				</section>
			{:else if record.id}
				<!-- Keyed on the entry: one mount = one editing session. -->
				{#key record.id}
					<StaffNoteEditor {slug} {accessToken} target={{ kind: 'record', recordId: record.id }} />
				{/key}
			{/if}

			<PersonAccountSection {record} {onUnlink} />

			{#if canOpenPayments && record.user_id}
				<section
					aria-labelledby="person-payments-heading"
					class="space-y-3"
					data-testid="person-payments"
				>
					<SectionHeader
						id="person-payments-heading"
						level={3}
						title={m['memberPeople.sheet.paymentsHeading']()}
					/>
					<p class="text-sm text-muted-foreground">{m['memberPeople.sheet.paymentsHelp']()}</p>
					<Button variant="outline" onclick={onOpenPayments} data-testid="person-open-payments">
						<Receipt aria-hidden="true" />
						{m['memberPeople.sheet.openPayments']()}
					</Button>
				</section>
			{/if}
		{/if}
	</SheetContent>
</Sheet>
