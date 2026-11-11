<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { GitMerge } from '@lucide/svelte';
	import type { PossibleDuplicateSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { isSameName } from '$lib/member-register/reconcile';
	import DuplicateEntry from './DuplicateEntry.svelte';
	import RegisterReasonChips from './RegisterReasonChips.svelte';

	interface Props {
		pairs: PossibleDuplicateSchema[];
		onMerge: (pair: PossibleDuplicateSchema) => void;
	}

	const { pairs, onMerge }: Props = $props();
</script>

<ul class="space-y-4" data-testid="duplicates-list">
	{#each pairs as pair (`${pair.unlinked.id}:${pair.linked.id}`)}
		<li class="space-y-3 rounded-lg border border-border bg-card p-4" data-testid="duplicate-pair">
			<RegisterReasonChips reasons={pair.reasons} label={m['memberRegister.reasonsLabel']()} />
			<div class="grid gap-3 md:grid-cols-2">
				<DuplicateEntry
					record={pair.unlinked}
					heading={m['memberRegister.pairUnlinked']()}
					testid="duplicate-unlinked"
				/>
				<DuplicateEntry
					record={pair.linked}
					heading={m['memberRegister.pairLinked']()}
					testid="duplicate-linked"
				/>
			</div>
			<div class="flex justify-end">
				<Button
					variant="outline"
					data-testid="duplicate-merge"
					aria-label={isSameName(pair.unlinked.full_name, pair.linked.full_name)
						? m['memberRegister.mergeAriaSameName']({ survivor: pair.linked.full_name })
						: m['memberRegister.mergeAria']({
								absorbed: pair.unlinked.full_name,
								survivor: pair.linked.full_name
							})}
					onclick={() => onMerge(pair)}
				>
					<GitMerge aria-hidden="true" />
					{m['memberRegister.actionMerge']()}
				</Button>
			</div>
		</li>
	{/each}
</ul>
