<script lang="ts">
	import { Ticket } from '@lucide/svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import type { TierSchemaWithId } from '$lib/types/tickets';

	interface Props {
		tier: TierSchemaWithId;
		isPwyc: boolean;
	}

	const { tier, isPwyc }: Props = $props();
</script>

<!-- Tier Info Card -->
<div class="rounded-lg border border-border bg-muted/50 p-4">
	<div class="flex items-start justify-between gap-4">
		<div class="flex-1 space-y-1">
			<h3 class="font-semibold">{tier.name}</h3>
			{#if tier.description}
				<MarkdownContent content={tier.description} class="text-sm text-muted-foreground" />
			{/if}
			{#if !isPwyc}
				<p class="text-lg font-bold text-primary">
					{tier.currency}
					{parseFloat(tier.price).toFixed(2)}
				</p>
			{/if}
		</div>
		<Ticket class="h-8 w-8 shrink-0 text-muted-foreground" aria-hidden="true" />
	</div>
</div>
