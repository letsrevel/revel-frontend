<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { formatDate } from '$lib/utils/date';
	import type { TicketMembershipRecordSchema } from '$lib/api/generated/types.gen';
	import { dayMemberBadgeState } from './day-member-badge';

	interface Props {
		/** The ticket's `membership_record` (null/undefined when it produced none). */
		record: TicketMembershipRecordSchema | null | undefined;
		/** Injected clock so the live/ended split is deterministic in tests. */
		now?: Date;
		class?: string;
	}

	const { record, now, class: className = '' }: Props = $props();

	// A day membership grants no privileges, so the copy says nothing of benefits.
	const state = $derived(dayMemberBadgeState(record, now));
</script>

{#if state === 'live' && record}
	<span class="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 {className}">
		<StatusBadge
			tone="info"
			size="sm"
			label={m['dayMemberBadge.label']()}
			data-testid="day-member-badge"
			class="w-fit whitespace-nowrap"
		/>
		{#if record.valid_until}
			<span class="text-xs text-muted-foreground" data-testid="day-member-until">
				{m['dayMemberBadge.until']({ date: formatDate(record.valid_until) })}
			</span>
		{/if}
	</span>
{:else if state === 'ended'}
	<StatusBadge
		tone="neutral"
		size="sm"
		label={m['dayMemberBadge.ended']()}
		data-testid="day-member-badge-ended"
		class="w-fit whitespace-nowrap {className}"
	/>
{/if}
