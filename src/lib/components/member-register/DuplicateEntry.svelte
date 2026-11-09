<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import { formatDate } from '$lib/utils/date';
	import { kindLabel } from '$lib/member-register/badges';
	import RegisterBadges from './RegisterBadges.svelte';

	interface Props {
		record: MembershipRecordSchema;
		heading: string;
		testid: string;
	}

	const { record, heading, testid }: Props = $props();
</script>

<div class="min-w-0 rounded-md border border-border bg-background p-3" data-testid={testid}>
	<p class="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
		{heading}
	</p>
	<p class="mt-1 break-words font-bold">{record.full_name}</p>
	{#if record.email}
		<p class="break-all text-sm text-muted-foreground">{record.email}</p>
	{/if}
	<dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
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
	</dl>
	<div class="mt-2"><RegisterBadges {record} /></div>
</div>
