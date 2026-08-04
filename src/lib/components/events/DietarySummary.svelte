<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { browser } from '$app/environment';
	import { eventpublicdetailsGetDietarySummary } from '$lib/api';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		Loader2,
		Info,
		ChevronDown,
		ChevronUp,
		AlertTriangle,
		AlertCircle,
		Frown,
		Circle
	} from '@lucide/svelte';
	import type { EventDietarySummarySchema, RestrictionType } from '$lib/api/generated/types.gen.js';
	import type { LucideIcon } from '@lucide/svelte';

	interface Props {
		eventId: string;
		authToken: string | null;
		isAuthenticated: boolean;
	}

	const { eventId, authToken, isAuthenticated }: Props = $props();

	// Build profile URL with redirect back to current page
	const profileDietaryUrl = $derived.by(() => {
		const basePath = resolve('/(auth)/account/profile', {});
		const hash = '#dietary-section';
		if (browser) {
			return `${basePath}?redirect=${encodeURIComponent(window.location.pathname)}${hash}`;
		}
		return `${basePath}${hash}`;
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
	const dietarySummary = $derived<EventDietarySummarySchema | null>(
		dietarySummaryQuery.data ?? null
	);
	const isLoading = $derived(dietarySummaryQuery.isLoading);
	const hasData = $derived(
		dietarySummary &&
			((dietarySummary.preferences?.length ?? 0) > 0 ||
				(dietarySummary.restrictions?.length ?? 0) > 0)
	);

	function getAttendeeCountText(count: number): string {
		return m['dietary.eventSummary_attendeeCount']({ count });
	}

	// Get severity display info
	function getSeverityInfo(type: RestrictionType): {
		label: string;
		color: string;
		icon: LucideIcon;
	} {
		switch (type) {
			case 'severe_allergy':
				return {
					label: m['dietarySummary.severitySevereAllergy'](),
					color: 'border-destructive/40 bg-destructive/10 text-foreground',
					icon: AlertTriangle
				};
			case 'allergy':
				return {
					label: m['dietarySummary.severityAllergy'](),
					color: 'border-highlight/60 bg-highlight/20 text-foreground',
					icon: AlertCircle
				};
			case 'intolerant':
				return {
					label: m['dietarySummary.severityIntolerant'](),
					color: 'border-highlight/40 bg-highlight/10 text-foreground',
					icon: Circle
				};
			case 'dislike':
				return {
					label: m['dietarySummary.severityDislike'](),
					color: 'border-border bg-muted text-muted-foreground',
					icon: Frown
				};
			default:
				return {
					label: type,
					color: 'border-border bg-muted text-muted-foreground',
					icon: Circle
				};
		}
	}

	// Group restrictions by food item and severity.
	// `attendee_count` is withheld (`null`) when the event hides attendee counts
	// (#825); the entries and their notes still arrive, so the list keeps
	// rendering and only the tally is suppressed.
	function getRestrictionSummary() {
		if (!dietarySummary?.restrictions) return [];

		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: local grouping map built and consumed synchronously within this pure helper, never stored
		const grouped = new Map<
			string,
			{ severities: Map<RestrictionType, number | null>; notes: string[] }
		>();

		for (const restriction of dietarySummary.restrictions) {
			let item = grouped.get(restriction.food_item);
			if (!item) {
				item = { severities: new Map(), notes: [] };
				grouped.set(restriction.food_item, item);
			}
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
		<span class="sr-only">{m['dietarySummary.loadingDietaryInfo']()}</span>
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
					<h3 class="text-lg font-extrabold">{m['dietary.eventSummary_heading']()}</h3>
					<p class="text-sm text-muted-foreground">{m['dietary.eventSummary_description']()}</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve()-derived value; the $derived wrapper prevents the rule from tracing it to resolve() -->
				<a
					href={profileDietaryUrl}
					onclick={(e) => e.stopPropagation()}
					class="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
					aria-label={m['dietarySummary.addDietaryPreferencesAriaLabel']()}
				>
					<span>{m['dietary.profile_quickActionButton']()}</span>
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
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
								{#each dietarySummary.preferences as preference (preference.name)}
									<li class="rounded-md border bg-background p-3">
										<div class="flex items-baseline justify-between">
											<span class="font-medium">{preference.name}</span>
											{#if preference.attendee_count != null}
												<span class="text-sm text-muted-foreground">
													{getAttendeeCountText(preference.attendee_count)}
												</span>
											{/if}
										</div>
										{#if preference.comments && preference.comments.length > 0}
											<div class="mt-2 space-y-1">
												<p class="text-xs font-medium text-muted-foreground">
													{m['dietary.eventSummary_comments']()}
												</p>
												{#each preference.comments as comment, i (i)}
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
								{#each getRestrictionSummary() as { foodItem, severities, notes } (foodItem)}
									<li class="rounded-md border bg-background p-3">
										<div class="flex items-baseline justify-between">
											<div class="flex flex-wrap items-center gap-2">
												<span class="font-medium">{foodItem}</span>
												{#each severities as [severity, count] (severity)}
													{@const info = getSeverityInfo(severity)}
													{@const SeverityIcon = info.icon}
													<span
														class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium {info.color}"
													>
														<SeverityIcon class="h-3 w-3" aria-hidden="true" />
														<span>{count == null ? info.label : `${count} ${info.label}`}</span>
													</span>
												{/each}
											</div>
										</div>
										{#if notes && notes.length > 0}
											<div class="mt-2 space-y-1">
												<p class="text-xs font-medium text-muted-foreground">
													{m['dietary.eventSummary_notes']()}
												</p>
												{#each notes as note, i (i)}
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
		<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve()-derived value; the $derived wrapper prevents the rule from tracing it to resolve() -->
		<a
			href={profileDietaryUrl}
			class="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
		>
			<span>{m['dietary.profile_quickActionButton']()}</span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</div>
{/if}
