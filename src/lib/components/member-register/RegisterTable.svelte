<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import { formatDate } from '$lib/utils/date';
	import { kindLabel, sourceLabel } from '$lib/member-register/badges';
	import RegisterBadges from './RegisterBadges.svelte';
	import RegisterRowActions from './RegisterRowActions.svelte';

	interface Props {
		records: MembershipRecordSchema[];
		isOwner: boolean;
		onEdit: (record: MembershipRecordSchema) => void;
		onEnd: (record: MembershipRecordSchema) => void;
		onDelete: (record: MembershipRecordSchema) => void;
		onInvite: (record: MembershipRecordSchema) => void;
		/** Reactive clock for time-dependent row rules. */
		now?: Date;
	}

	const { records, isOwner, onEdit, onEnd, onDelete, onInvite, now }: Props = $props();

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
				<tr class="align-top hover:bg-muted/50" data-testid="register-row">
					<th scope="row" class="px-4 py-3 text-left text-sm font-medium">{record.full_name}</th>
					<td class="break-all px-4 py-3 text-sm text-muted-foreground">{record.email || '-'}</td>
					<td class="px-4 py-3 text-sm">{record.tier_name || '-'}</td>
					<td class="whitespace-nowrap px-4 py-3 text-sm">{kindLabel(record.kind)}</td>
					<td class="whitespace-nowrap px-4 py-3 text-sm">{formatDate(record.valid_from)}</td>
					<td class="whitespace-nowrap px-4 py-3 text-sm">
						{record.valid_until ? formatDate(record.valid_until) : m['memberRegister.openEnded']()}
					</td>
					<td class="whitespace-nowrap px-4 py-3 text-sm">{sourceLabel(record.source)}</td>
					<td class="px-4 py-3"><RegisterBadges {record} /></td>
					<td class="px-4 py-3 text-right">
						<RegisterRowActions {record} {isOwner} {onEdit} {onEnd} {onDelete} {onInvite} {now} />
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
