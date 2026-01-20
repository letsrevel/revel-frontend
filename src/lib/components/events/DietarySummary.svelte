<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { browser } from '$app/environment';
	import { eventpublicdetailsGetDietarySummary } from '$lib/api';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		Loader2,
		Info,
		ExternalLink,
		ChevronDown,
		ChevronUp,
		AlertTriangle,
		AlertCircle,
		Frown,
		Circle
	} from 'lucide-svelte';
	import type { EventDietarySummarySchema, RestrictionType } from '$lib/api/generated/types.gen.js';

	interface Props {
		eventId: string;
		authToken: string | null;
		isAuthenticated: boolean;
	}

	let { eventId, authToken, isAuthenticated }: Props = $props();

	// Build profile URL with redirect back to current page
	let profileDietaryUrl = $derived.by(() => {
		const baseUrl = '/account/profile#dietary-section';
		if (browser) {
			return `${baseUrl.replace('#', '')}?redirect=${encodeURIComponent(window.location.pathname)}#dietary-section`;
		}
		return baseUrl;
	});

	// State
	let isExpanded = $state(false);

	// Fetch dietary summary
	const dietarySummaryQuery = createQuery(() => ({
		queryKey: ['dietary-summary', eventId],
		queryFn: async () => {
			if (!authToken) {
				throw new Error('Not authenticated');
			}
			const response = await eventpublicdetailsGetDietarySummary({
				path: { event_id: eventId },
				headers: { Authorization: `Bearer ${authToken}` }
			});
			return response.data;
		},
		enabled: isAuthenticated && !!authToken
	}));

	// Derived state
	let dietarySummary = $derived<EventDietarySummarySchema | null>(dietarySummaryQuery.data ?? null);
	let isLoading = $derived(dietarySummaryQuery.isLoading);
	let hasData = $derived(
		dietarySummary &&
			((dietarySummary.preferences?.length ?? 0) > 0 ||
				(dietarySummary.restrictions?.length ?? 0) > 0)
	);

	// Helper to get plural form
	function getAttendeeCountText(count: number): string {
		const pluralSuffix = count === 1 ? '' : m['dietary.eventSummary_attendeeCount_plural']();
		return m['dietary.eventSummary_attendeeCount']({
			count: count.toString(),
			plural: pluralSuffix
		});
	}

	// Get severity display info
	function getSeverityInfo(type: RestrictionType): {
		label: string;
		color: string;
		icon: any;
	} {
		switch (type) {
			case 'severe_allergy':
				return {
					label: 'Severe Allergy',
					color:
						'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
					icon: AlertTriangle
				};
			case 'allergy':
				return {
					label: 'Allergy',
					color:
						'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-900',
					icon: AlertCircle
				};
			case 'intolerant':
				return {
					label: 'Intolerant',
					color:
						'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-900',
					icon: Circle
				};
			case 'dislike':
				return {
					label: 'Dislike',
					color:
						'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
					icon: Frown
				};
			default:
				return {
					label: type,
					color:
						'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
					icon: Circle
				};
		}
	}

	// Group restrictions by food item and severity
	function getRestrictionSummary() {
		if (!dietarySummary?.restrictions) return [];

		const grouped = new Map<
			string,
			{ severities: Map<RestrictionType, number>; notes: string[] }
		>();

		for (const restriction of dietarySummary.restrictions) {
			if (!grouped.has(restriction.food_item)) {
				grouped.set(restriction.food_item, { severities: new Map(), notes: [] });
			}
			const item = grouped.get(restriction.food_item)!;
			item.severities.set(restriction.severity, restriction.attendee_count);

			// Collect notes
			if (restriction.notes && restriction.notes.length > 0) {
				item.notes.push(...restriction.notes);
			}
		}

		return Array.from(grouped.entries()).map(([foodItem, { severities, notes }]) => ({
			foodItem,
			severities: Array.from(severities.entries()),
			notes
		}));
	}
</script>

{#if !isAuthenticated}
	<!-- Show nothing if not authenticated -->
	<div></div>
{:else if isLoading}
	<div class="flex items-center justify-center py-8">
		<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
		<span class="sr-only">Loading dietary information...</span>
	</div>
{:else if hasData}
	<div class="rounded-lg border bg-card">
		<!-- Collapsible Header -->
		<button
			type="button"
			onclick={() => (isExpanded = !isExpanded)}
			class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-accent"
			aria-expanded={isExpanded}
		>
			<div class="flex items-center gap-3">
				<Info class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				<div>
					<h3 class="font-semibold">{m['dietary.eventSummary_heading']()}</h3>
					<p class="text-sm text-muted-foreground">{m['dietary.eventSummary_description']()}</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<a
					href={profileDietaryUrl}
					onclick={(e) => e.stopPropagation()}
					class="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
					aria-label="Add your dietary preferences and restrictions"
				>
					<span>{m['dietary.profile_quickActionButton']()}</span>
				</a>
				{#if isExpanded}
					<ChevronUp class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				{:else}
					<ChevronDown class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				{/if}
			</div>
		</button>

		<!-- Collapsible Content -->
		{#if isExpanded}
			<div class="border-t p-4">
				<div class="grid gap-6 md:grid-cols-2">
					<!-- Dietary Preferences -->
					{#if dietarySummary && dietarySummary.preferences && dietarySummary.preferences.length > 0}
						<div class="space-y-3">
							<h4 class="font-medium text-foreground">
								{m['dietary.eventSummary_preferencesHeading']()}
							</h4>
							<ul class="space-y-2" role="list">
								{#each dietarySummary.preferences as preference}
									<li class="rounded-md border bg-background p-3">
										<div class="flex items-baseline justify-between">
											<span class="font-medium">{preference.name}</span>
											<span class="text-sm text-muted-foreground">
												{getAttendeeCountText(preference.attendee_count)}
											</span>
										</div>
										{#if preference.comments && preference.comments.length > 0}
											<div class="mt-2 space-y-1">
												<p class="text-xs font-medium text-muted-foreground">
													{m['dietary.eventSummary_comments']()}
												</p>
												{#each preference.comments as comment}
													<p class="text-sm text-muted-foreground">• {comment}</p>
												{/each}
											</div>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Dietary Restrictions -->
					{#if dietarySummary && dietarySummary.restrictions && dietarySummary.restrictions.length > 0}
						<div class="space-y-3">
							<h4 class="font-medium text-foreground">
								{m['dietary.eventSummary_restrictionsHeading']()}
							</h4>
							<ul class="space-y-2" role="list">
								{#each getRestrictionSummary() as { foodItem, severities, notes }}
									<li class="rounded-md border bg-background p-3">
										<div class="flex items-baseline justify-between">
											<div class="flex flex-wrap items-center gap-2">
												<span class="font-medium">{foodItem}</span>
												{#each severities as [severity, count]}
													{@const info = getSeverityInfo(severity)}
													<span
														class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium {info.color}"
													>
														<svelte:component this={info.icon} class="h-3 w-3" aria-hidden="true" />
														<span>{count} {info.label}</span>
													</span>
												{/each}
											</div>
										</div>
										{#if notes && notes.length > 0}
											<div class="mt-2 space-y-1">
												<p class="text-xs font-medium text-muted-foreground">
													{m['dietary.eventSummary_notes']()}
												</p>
												{#each notes as note}
													<p class="text-sm text-muted-foreground">• {note}</p>
												{/each}
											</div>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{:else}
	<!-- Empty state -->
	<div class="rounded-lg border border-dashed p-8 text-center">
		<Info class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
		<p class="text-sm font-medium text-muted-foreground">
			{m['dietary.eventSummary_emptyState']()}
		</p>
		<p class="mt-1 text-sm text-muted-foreground">
			{m['dietary.eventSummary_emptyStateDescription']()}
		</p>
		<a
			href={profileDietaryUrl}
			class="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
		>
			<span>{m['dietary.profile_quickActionButton']()}</span>
		</a>
	</div>
{/if}
