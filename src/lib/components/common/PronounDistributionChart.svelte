<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PronounCountSchema } from '$lib/api/generated/types.gen';

	interface Props {
		distribution: PronounCountSchema[];
		totalAttendees: number;
		totalWithPronouns: number;
		totalWithoutPronouns: number;
	}

	let { distribution, totalAttendees, totalWithPronouns, totalWithoutPronouns }: Props = $props();

	function getPercentage(count: number): number {
		if (totalAttendees === 0) return 0;
		return (count / totalAttendees) * 100;
	}

	// IMPORTANT: Avoid bg-blue-* and bg-slate-* as they can blend with bg-secondary background
	const colorClasses = [
		'bg-violet-500',
		'bg-orange-500',
		'bg-emerald-500',
		'bg-amber-500',
		'bg-rose-500',
		'bg-cyan-500',
		'bg-fuchsia-500',
		'bg-lime-500'
	];

	function getColorClass(index: number): string {
		return colorClasses[index % colorClasses.length];
	}
</script>

<div class="space-y-2">
	{#each distribution as item, index (item.pronouns)}
		<div class="space-y-1">
			<div class="flex items-center justify-between text-xs">
				<span class="font-medium">{item.pronouns}</span>
				<span class="text-muted-foreground">
					{item.count} ({Math.round(getPercentage(item.count))}%)
				</span>
			</div>
			<div class="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
				<div
					class={`h-full rounded-full transition-all duration-500 ${getColorClass(index)}`}
					style="width: {getPercentage(item.count)}%"
					role="progressbar"
					aria-valuenow={item.count}
					aria-valuemin={0}
					aria-valuemax={totalAttendees}
					aria-label="{item.pronouns}: {item.count}"
				></div>
			</div>
		</div>
	{/each}

	{#if totalWithoutPronouns > 0}
		<div class="space-y-1">
			<div class="flex items-center justify-between text-xs">
				<span class="font-medium text-muted-foreground">
					{m['pronounDistribution.notSpecified']()}
				</span>
				<span class="text-muted-foreground">
					{totalWithoutPronouns} ({Math.round(getPercentage(totalWithoutPronouns))}%)
				</span>
			</div>
			<div class="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
				<div
					class="h-full rounded-full bg-gray-400 transition-all duration-500 dark:bg-gray-600"
					style="width: {getPercentage(totalWithoutPronouns)}%"
					role="progressbar"
					aria-valuenow={totalWithoutPronouns}
					aria-valuemin={0}
					aria-valuemax={totalAttendees}
					aria-label="{m['pronounDistribution.notSpecified']()}: {totalWithoutPronouns}"
				></div>
			</div>
		</div>
	{/if}
</div>

<p class="mt-3 text-xs text-muted-foreground">
	{m['pronounDistribution.summary']({
		withPronouns: totalWithPronouns,
		total: totalAttendees
	})}
</p>
