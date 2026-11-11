<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import { formatDate } from '$lib/utils/date';
	import { kindLabel, sourceLabel } from '$lib/member-register/badges';
	import { rowHasOpenMenu, shouldOpenRow } from '$lib/member-register/row-click';
	import RegisterEmail from './RegisterEmail.svelte';
	import PersonStatusCell from './PersonStatusCell.svelte';
	import RegisterRowActions from './RegisterRowActions.svelte';

	interface Props {
		records: MembershipRecordSchema[];
		isOwner: boolean;
		onEdit: (record: MembershipRecordSchema) => void;
		onEnd: (record: MembershipRecordSchema) => void;
		onDelete: (record: MembershipRecordSchema) => void;
		onInvite: (record: MembershipRecordSchema) => void;
		onUnlink: (record: MembershipRecordSchema) => void;
		/** Open the person sheet (row click, or Enter on the name button). */
		onOpen: (record: MembershipRecordSchema) => void;
	}

	const { records, isOwner, onEdit, onEnd, onDelete, onInvite, onUnlink, onOpen }: Props = $props();

	// Set at pointerdown: by the time the click lands, the press itself has closed
	// the row's menu, so only the pointerdown still knows it was open.
	let menuOpenAtPointerDown = false;

	const TH =
		'px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground';
</script>

<!-- Desktop table; below md the same rows render as cards (RegisterCards). -->
<div class="hidden overflow-x-auto rounded-lg border border-border md:block">
	<table class="w-full" data-testid="register-table">
		<caption class="sr-only">{m['memberRegister.tableCaption']()}</caption>
		<thead class="bg-muted/50">
			<tr>
				<th scope="col" class={TH}>{m['memberRegister.colName']()}</th>
				<th scope="col" class={TH}>{m['memberRegister.colEmail']()}</th>
				<th scope="col" class={TH}>{m['memberRegister.colTier']()}</th>
				<th scope="col" class={TH}>{m['memberRegister.colKind']()}</th>
				<th scope="col" class={TH}>{m['memberRegister.colValidFrom']()}</th>
				<th scope="col" class={TH}>{m['memberRegister.colValidUntil']()}</th>
				<th scope="col" class={TH}>{m['memberRegister.colSource']()}</th>
				<th scope="col" class={TH}>{m['memberRegister.colStatus']()}</th>
				<th scope="col" class="{TH} text-right">
					<span class="sr-only">{m['memberRegister.colActions']()}</span>
				</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-border bg-card">
			{#each records as record (record.id)}
				<!-- Pointer convenience only: the keyboard and screen reader path is the name
				     button below (Tab, then Enter / Space), and the actions menu keeps its own click. -->
				<tr
					class="cursor-pointer align-top hover:bg-muted/50"
					data-testid="register-row"
					onpointerdown={(event) => (menuOpenAtPointerDown = rowHasOpenMenu(event.currentTarget))}
					onclick={(event) => {
						if (shouldOpenRow(event.target, menuOpenAtPointerDown)) onOpen(record);
						menuOpenAtPointerDown = false;
					}}
				>
					<th scope="row" class="px-4 py-3 text-left text-sm font-medium">
						<button
							type="button"
							class="rounded-sm text-left font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-label={m['memberPeople.row.open']({ name: record.full_name })}
							data-testid="register-open"
							onclick={() => onOpen(record)}
						>
							{record.full_name}
						</button>
					</th>
					<td class="px-4 py-3 text-sm text-muted-foreground">
						{#if record.email}<RegisterEmail email={record.email} />{:else}-{/if}
					</td>
					<td class="px-4 py-3 text-sm">{record.tier_name || '-'}</td>
					<td class="whitespace-nowrap px-4 py-3 text-sm">{kindLabel(record.kind)}</td>
					<td class="whitespace-nowrap px-4 py-3 text-sm">{formatDate(record.valid_from)}</td>
					<td class="whitespace-nowrap px-4 py-3 text-sm">
						{record.valid_until ? formatDate(record.valid_until) : m['memberRegister.openEnded']()}
					</td>
					<td class="whitespace-nowrap px-4 py-3 text-sm">{sourceLabel(record.source)}</td>
					<td class="px-4 py-3"><PersonStatusCell {record} /></td>
					<td class="px-4 py-3 text-right">
						<RegisterRowActions
							{record}
							{isOwner}
							{onEdit}
							{onEnd}
							{onDelete}
							{onInvite}
							{onUnlink}
						/>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
