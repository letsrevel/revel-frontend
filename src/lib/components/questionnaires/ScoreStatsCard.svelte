<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

	interface Props {
		min: string | null | undefined;
		avg: string | null | undefined;
		max: string | null | undefined;
	}

	let { min, avg, max }: Props = $props();

	let hasData = $derived(avg != null || min != null || max != null);

	function formatScore(value: string | null | undefined): string {
		if (value == null) return '-';
		const num = parseFloat(value);
		return isNaN(num) ? '-' : num.toFixed(1);
	}
</script>

{#if hasData}
	<Card>
		<CardHeader class="pb-3">
			<CardTitle class="text-base">{m['questionnaireSummaryPage.scoreStats']()}</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="grid grid-cols-3 gap-4 text-center">
				<div>
					<p class="text-sm text-muted-foreground">{m['questionnaireSummaryPage.min']()}</p>
					<p class="text-2xl font-bold">{formatScore(min)}</p>
				</div>
				<div>
					<p class="text-sm text-muted-foreground">{m['questionnaireSummaryPage.avg']()}</p>
					<p class="text-2xl font-bold">{formatScore(avg)}</p>
				</div>
				<div>
					<p class="text-sm text-muted-foreground">{m['questionnaireSummaryPage.max']()}</p>
					<p class="text-2xl font-bold">{formatScore(max)}</p>
				</div>
			</div>
		</CardContent>
	</Card>
{/if}
