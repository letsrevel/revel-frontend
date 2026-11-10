<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
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
	import { listPersonPeriods, memberRegisterKeys } from '$lib/member-register/api';
	import { pickCurrentEntry, type SheetState } from '$lib/member-register/person-target';

	interface Props {
		/** Who the sheet is about (a person, or one specific entry); null while closed. */
		sheet: SheetState | null;
		/** The live list rows: they keep a record-keyed sheet true after a refetch. */
		rows: MembershipRecordSchema[];
		slug: string;
		accessToken: string | null | undefined;
		/** Standard tiers, for the change-tier picker of the member actions. */
		tiers: MembershipTierSchema[];
		staffUserIds: Set<string>;
		isOwner: boolean;
		/** The Payments tab exists for this viewer (`manage_subscriptions`). */
		canOpenPayments: boolean;
		onClose: () => void;
		/** Open one merged entry read-only (from the periods list). */
		onOpenRecord: (record: MembershipRecordSchema) => void;
		onEdit: (record: MembershipRecordSchema) => void;
		onEnd: (record: MembershipRecordSchema) => void;
		onDelete: (record: MembershipRecordSchema) => void;
		onInvite: (record: MembershipRecordSchema) => void;
		onUnlink: (record: MembershipRecordSchema) => void;
		onOpenPayments: () => void;
	}

	const {
		sheet,
		rows,
		slug,
		accessToken,
		tiers,
		staffUserIds,
		isOwner,
		canOpenPayments,
		onClose,
		onOpenRecord,
		onEdit,
		onEnd,
		onDelete,
		onInvite,
		onUnlink,
		onOpenPayments
	}: Props = $props();

	// A linked person is followed by their USER id: a tier change closes one entry
	// and opens another, and the sheet must land on the person's CURRENT entry.
	const target = $derived(sheet?.target ?? null);
	const userId = $derived(target?.kind === 'user' ? target.userId : null);
	const periodsQuery = createQuery(() => ({
		queryKey: memberRegisterKeys.periods(slug, userId ?? ''),
		queryFn: () => listPersonPeriods(slug, accessToken, userId as string),
		enabled: !!accessToken && !!userId
	}));

	const resolved = $derived.by((): MembershipRecordSchema | null => {
		if (!sheet || !target) return null;
		if (target.kind === 'user') {
			return pickCurrentEntry(periodsQuery.data?.results ?? [], sheet.seed.kind) ?? sheet.seed;
		}
		return rows.find((r) => r.id === target.recordId) ?? sheet.seed;
	});

	// A person with no entry left (deleted, unlinked away) has nothing to show.
	$effect(() => {
		if (
			userId &&
			periodsQuery.isSuccess &&
			!periodsQuery.isFetching &&
			pickCurrentEntry(periodsQuery.data?.results ?? []) === null
		) {
			onClose();
		}
	});

	// Keep the last person rendered until the close animation has finished, so the
	// panel does not go blank while it slides out.
	let displayed = $state<MembershipRecordSchema | null>(null);
	$effect(() => {
		if (resolved) displayed = resolved;
	});
	const record = $derived(resolved ?? displayed);

	// The staff note is the PERSON's: for a linked person the record route proxies to
	// the user's note through ANY of their entries, so pin it to the entry the sheet
	// was opened on. The resolved current entry can change (periods loading, a tier
	// change), and keying the editor on it would remount and drop an unsaved draft.
	const noteRecordId = $derived(
		target?.kind === 'user' && sheet ? sheet.seed.id : (record?.id ?? null)
	);
	const merged = $derived(!!record?.merged_into_id);
</script>

<!--
	Modal side sheet: focus moves in on open, Escape / the close button / the
	overlay dismiss it, and focus returns to the row that opened it. The title
	is the heading the dialog is named by.
-->
<Sheet
	open={sheet !== null}
	onOpenChange={(open) => (!open ? onClose() : undefined)}
	onOpenChangeComplete={(open) => {
		if (!open) displayed = null;
	}}
>
	<SheetContent class="gap-6" data-testid="person-sheet">
		{#if record}
			<SheetHeader class="space-y-2 pr-12 text-left">
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

			<PersonPeriods {record} {slug} {accessToken} {onOpenRecord} />

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
			{:else if noteRecordId}
				<!-- Keyed on the person (see noteRecordId): one mount = one editing session. -->
				{#key noteRecordId}
					<StaffNoteEditor
						{slug}
						{accessToken}
						collapsible
						target={{ kind: 'record', recordId: noteRecordId }}
					/>
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
