<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { getPersonStatus, type PersonStatusId } from '$lib/member-register/people-view';

	interface Props {
		record: MembershipRecordSchema;
	}

	const { record }: Props = $props();

	const status = $derived(getPersonStatus(record));

	// Static message calls keep the build tree-shakeable.
	function labelFor(id: PersonStatusId): string {
		switch (id) {
			case 'active':
				return m['memberPeople.status.active']();
			case 'day-member':
				return m['memberPeople.status.dayMember']();
			case 'ended':
				return m['memberPeople.status.ended']();
			case 'upcoming':
				return m['memberPeople.status.upcoming']();
			case 'no-account':
				return m['memberPeople.status.noAccount']();
			case 'invited':
				return m['memberPeople.status.invited']();
		}
	}
</script>

<StatusBadge
	tone={status.tone}
	label={labelFor(status.id)}
	size="sm"
	data-testid="register-status-{status.id}"
/>
