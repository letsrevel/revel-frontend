<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/components/ui/badge';
	import type { PollStatus } from '$lib/api/generated/types.gen';

	interface Props {
		status: PollStatus;
	}
	const { status }: Props = $props();

	const label = $derived(
		status === 'draft'
			? m['pollCard.status_draft']()
			: status === 'open'
				? m['pollCard.status_open']()
				: m['pollCard.status_closed']()
	);
</script>

{#if status === 'draft'}
	<Badge class="bg-amber-600 text-xs text-white hover:bg-amber-700">{label}</Badge>
{:else if status === 'open'}
	<Badge class="bg-emerald-700 text-xs text-white hover:bg-emerald-800">{label}</Badge>
{:else}
	<Badge variant="secondary" class="text-xs">{label}</Badge>
{/if}
