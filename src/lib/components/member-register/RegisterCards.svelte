<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import { formatDate } from '$lib/utils/date';
	import { kindLabel, sourceLabel } from '$lib/member-register/badges';
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
		/** Open the person sheet. */
		onOpen: (record: MembershipRecordSchema) => void;
	}

	const { records, isOwner, onEdit, onEnd, onDelete, onInvite, onUnlink, onOpen }: Props = $props();
</script>

<!-- Mobile cards (below md); the table takes over from md up. -->
<ul class="space-y-3 md:hidden" aria-label={m['memberRegister.tableCaption']()}>
	{#each records as record (record.id)}
		<li class="rounded-lg border border-border bg-card p-4" data-testid="register-card">
			<div class="flex items-start justify-between gap-2">
				<div class="min-w-0">
					<button
						type="button"
						class="rounded-sm text-left font-bold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label={m['memberPeople.row.open']({ name: record.full_name })}
						data-testid="register-open"
						onclick={() => onOpen(record)}
					>
						<span class="break-words">{record.full_name}</span>
					</button>
					{#if record.email}
						<p class="break-all text-sm text-muted-foreground">{record.email}</p>
					{/if}
				</div>
				<RegisterRowActions {record} {isOwner} {onEdit} {onEnd} {onDelete} {onInvite} {onUnlink} />
			</div>
			<dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
				<div>
					<dt class="text-xs text-muted-foreground">{m['memberRegister.colTier']()}</dt>
					<dd>{record.tier_name || '-'}</dd>
				</div>
				<div>
					<dt class="text-xs text-muted-foreground">{m['memberRegister.colKind']()}</dt>
					<dd>{kindLabel(record.kind)}</dd>
				</div>
				<div>
					<dt class="text-xs text-muted-foreground">{m['memberRegister.colValidFrom']()}</dt>
					<dd>{formatDate(record.valid_from)}</dd>
				</div>
				<div>
					<dt class="text-xs text-muted-foreground">{m['memberRegister.colValidUntil']()}</dt>
					<dd>
						{record.valid_until ? formatDate(record.valid_until) : m['memberRegister.openEnded']()}
					</dd>
				</div>
				<div class="col-span-2">
					<dt class="text-xs text-muted-foreground">{m['memberRegister.colSource']()}</dt>
					<dd>{sourceLabel(record.source)}</dd>
				</div>
			</dl>
			<div class="mt-3"><PersonStatusCell {record} /></div>
		</li>
	{/each}
</ul>
