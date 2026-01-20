<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { eventpublicdetailsGetPronounDistribution } from '$lib/api';
	import { Users, Loader2 } from 'lucide-svelte';

	interface Props {
		eventId: string;
		isAuthenticated: boolean;
	}

	let { eventId, isAuthenticated }: Props = $props();

	// Query for pronoun distribution
	let pronounQuery = createQuery(() => ({
		queryKey: ['event-pronoun-distribution', eventId],
		queryFn: async () => {
			const response = await eventpublicdetailsGetPronounDistribution({
				path: { event_id: eventId }
			});

			if (!response.data) {
				throw new Error('Failed to load pronoun distribution');
			}

			return response.data;
		},
		enabled: isAuthenticated
	}));

	// Derived state
	let distribution = $derived(pronounQuery.data?.distribution ?? []);
	let totalWithPronouns = $derived(pronounQuery.data?.total_with_pronouns ?? 0);
	let totalWithoutPronouns = $derived(pronounQuery.data?.total_without_pronouns ?? 0);
	let totalAttendees = $derived(pronounQuery.data?.total_attendees ?? 0);

	// Calculate percentage for bar width
	function getPercentage(count: number): number {
		if (totalAttendees === 0) return 0;
		return (count / totalAttendees) * 100;
	}

	// Get color class for pronoun bars - cycle through colors
	const colorClasses = [
		'bg-violet-500',
		'bg-blue-500',
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

{#if isAuthenticated}
	<section class="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
		<div class="mb-4 flex items-center gap-2">
			<Users class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
			<h2 class="text-lg font-semibold">{m['pronounDistribution.title']()}</h2>
		</div>

		{#if pronounQuery.isLoading}
			<div class="flex items-center justify-center py-8">
				<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
				<span class="sr-only">{m['pronounDistribution.loading']()}</span>
			</div>
		{:else if pronounQuery.isError}
			<div class="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
				<p>{m['pronounDistribution.error']()}</p>
			</div>
		{:else if totalAttendees === 0}
			<p class="text-sm text-muted-foreground">
				{m['pronounDistribution.noAttendees']()}
			</p>
		{:else}
			<!-- Distribution bars -->
			<div class="space-y-3">
				{#each distribution as item, index (item.pronouns)}
					<div class="space-y-1">
						<div class="flex items-center justify-between text-sm">
							<span class="font-medium">{item.pronouns}</span>
							<span class="text-muted-foreground">
								{item.count}
								({Math.round(getPercentage(item.count))}%)
							</span>
						</div>
						<div class="h-2 w-full overflow-hidden rounded-full bg-secondary">
							<div
								class={`h-full rounded-full transition-all duration-500 ${getColorClass(index)}`}
								style="width: {getPercentage(item.count)}%"
								role="progressbar"
								aria-valuenow={item.count}
								aria-valuemin={0}
								aria-valuemax={totalAttendees}
								aria-label="{item.pronouns}: {item.count} attendees"
							></div>
						</div>
					</div>
				{/each}

				<!-- Not specified bar -->
				{#if totalWithoutPronouns > 0}
					<div class="space-y-1">
						<div class="flex items-center justify-between text-sm">
							<span class="font-medium text-muted-foreground">
								{m['pronounDistribution.notSpecified']()}
							</span>
							<span class="text-muted-foreground">
								{totalWithoutPronouns}
								({Math.round(getPercentage(totalWithoutPronouns))}%)
							</span>
						</div>
						<div class="h-2 w-full overflow-hidden rounded-full bg-secondary">
							<div
								class="h-full rounded-full bg-gray-400 transition-all duration-500 dark:bg-gray-600"
								style="width: {getPercentage(totalWithoutPronouns)}%"
								role="progressbar"
								aria-valuenow={totalWithoutPronouns}
								aria-valuemin={0}
								aria-valuemax={totalAttendees}
								aria-label="{m[
									'pronounDistribution.notSpecified'
								]()}: {totalWithoutPronouns} attendees"
							></div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Summary -->
			<div class="mt-4 border-t pt-4">
				<p class="text-sm text-muted-foreground">
					{m['pronounDistribution.summary']({
						withPronouns: totalWithPronouns,
						total: totalAttendees
					})}
				</p>
			</div>
		{/if}
	</section>
{/if}
