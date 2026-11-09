<script lang="ts">
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { getRecordBadges } from '$lib/member-register/badges';

	interface Props {
		record: MembershipRecordSchema;
	}

	const { record }: Props = $props();

	const badges = $derived(getRecordBadges(record));
</script>

<ul class="flex flex-wrap gap-1.5">
	{#each badges as badge (badge.id)}
		<li>
			<StatusBadge
				tone={badge.tone}
				label={badge.label}
				size="sm"
				data-testid="register-badge-{badge.id}"
			/>
		</li>
	{/each}
</ul>
