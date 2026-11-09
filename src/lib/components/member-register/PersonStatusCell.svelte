<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { StickyNote } from '@lucide/svelte';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import RegisterStatusBadge from './RegisterStatusBadge.svelte';
	import PersonSubscriptionLine from './PersonSubscriptionLine.svelte';

	interface Props {
		record: MembershipRecordSchema;
	}

	const { record }: Props = $props();
</script>

<!-- Status, the staff-note marker and (linked rows) the subscription, stacked. -->
<div class="flex flex-col items-start gap-1">
	<div class="flex items-center gap-1.5">
		<RegisterStatusBadge {record} />
		{#if record.has_note}
			<span class="inline-flex text-muted-foreground" data-testid="register-note-marker">
				<StickyNote class="h-4 w-4" aria-hidden="true" />
				<span class="sr-only">{m['memberPeople.row.hasNote']()}</span>
			</span>
		{/if}
	</div>
	{#if record.subscription}
		<PersonSubscriptionLine subscription={record.subscription} />
	{/if}
</div>
