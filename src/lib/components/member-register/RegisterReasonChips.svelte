<script lang="ts">
	import type { RegisterMatchReason } from '$lib/api/generated/types.gen';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { reasonLabel } from '$lib/member-register/reconcile';

	interface Props {
		reasons: RegisterMatchReason[];
		/** Accessible name of the list ("Why they may match"). */
		label: string;
	}

	const { reasons, label }: Props = $props();
</script>

<ul class="flex flex-wrap gap-1.5" aria-label={label}>
	{#each reasons as reason (reason)}
		<li>
			<StatusBadge
				tone="info"
				label={reasonLabel(reason)}
				size="sm"
				data-testid="register-reason-{reason}"
			/>
		</li>
	{/each}
</ul>
