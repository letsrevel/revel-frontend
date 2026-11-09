<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { AlertTriangle } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import ToneTile from '$lib/components/common/ToneTile.svelte';

	interface Props {
		duplicatesCount: number;
		applicationsCount: number;
		onReviewDuplicates: () => void;
		onReviewApplications: () => void;
	}

	const { duplicatesCount, applicationsCount, onReviewDuplicates, onReviewApplications }: Props =
		$props();

	const items = $derived(
		[
			{
				id: 'duplicates',
				count: duplicatesCount,
				label: m['memberPeople.attention.duplicates']({ count: duplicatesCount }),
				review: onReviewDuplicates
			},
			{
				id: 'applications',
				count: applicationsCount,
				label: m['memberPeople.attention.applications']({ count: applicationsCount }),
				review: onReviewApplications
			}
		].filter((item) => item.count > 0)
	);
</script>

<!-- Rendered only when there is something to handle. A labelled region, not a
     live region: it is present on load, so nothing needs announcing. -->
{#if items.length > 0}
	<section
		aria-labelledby="needs-attention-heading"
		class="rounded-lg border-2 border-highlight bg-card p-4"
		data-testid="needs-attention"
	>
		<div class="flex items-start gap-3">
			<ToneTile tone="warning" icon={AlertTriangle} size="sm" />
			<div class="min-w-0 flex-1 space-y-2">
				<h2 id="needs-attention-heading" class="font-bold">
					{m['memberPeople.attention.heading']()}
				</h2>
				<ul class="divide-y divide-border">
					{#each items as item (item.id)}
						<li class="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
							<span id="attention-{item.id}" class="text-sm" data-testid="attention-{item.id}">
								{item.label}
							</span>
							<Button
								variant="outline"
								size="sm"
								aria-describedby="attention-{item.id}"
								data-testid="attention-review-{item.id}"
								onclick={item.review}
							>
								{m['memberPeople.attention.review']()}
							</Button>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</section>
{/if}
