<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { formatDateTime } from '$lib/utils/date';
	import type { TicketMembershipRecordSchema } from '$lib/api/generated/types.gen';

	interface Props {
		/** The ticket's `membership_record` (null/undefined when it produced none). */
		record: TicketMembershipRecordSchema | null | undefined;
		class?: string;
	}

	const { record, class: className = '' }: Props = $props();

	// The flag comes from the backend record, never from the ticket tier: a tier
	// can grant a day membership whose record has already ended. Revoked records
	// are hidden; standard memberships are covered by the existing member badge.
	// A day membership grants no privileges, so the copy says nothing of benefits.
	const visible = $derived(record?.kind === 'temporary' && record.ended_reason !== 'revoked');
</script>

{#if visible && record}
	<StatusBadge
		tone="info"
		size="sm"
		label={m['dayMemberBadge.label']()}
		srLabel={record.valid_until
			? m['dayMemberBadge.until']({ date: formatDateTime(record.valid_until) })
			: undefined}
		data-testid="day-member-badge"
		class="w-fit whitespace-nowrap {className}"
	/>
{/if}
