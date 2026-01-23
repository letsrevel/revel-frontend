<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { browser } from '$app/environment';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		eventpublicdetailsGetEventAttendees,
		eventpublicdetailsGetPronounDistribution
	} from '$lib/api';
	import type { VisibilityPreference } from '$lib/api/generated/types.gen';
	import { Users, ChevronDown, ChevronUp, Loader2, Settings, BarChart3 } from 'lucide-svelte';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import { slide } from 'svelte/transition';

	interface Props {
		eventId: string;
		totalAttendees: number;
		isAuthenticated: boolean;
		userVisibility?: VisibilityPreference | null;
	}

	let { eventId, totalAttendees, isAuthenticated, userVisibility = null }: Props = $props();

	// Build settings URL with redirect back to current page
	let settingsUrl = $derived.by(() => {
		if (browser) {
			return `/account/settings?redirect=${encodeURIComponent(window.location.pathname)}`;
		}
		return '/account/settings';
	});

	// Map visibility preference to translation key
	function getVisibilityLabel(visibility: VisibilityPreference): string {
		switch (visibility) {
			case 'always':
				return m['attendeeList.visibilityAlways']();
			case 'never':
				return m['attendeeList.visibilityNever']();
			case 'to_members':
				return m['attendeeList.visibilityToMembers']();
			case 'to_invitees':
				return m['attendeeList.visibilityToInvitees']();
			case 'to_both':
				return m['attendeeList.visibilityToBoth']();
			default:
				return m['attendeeList.visibilityNever']();
		}
	}

	// Fetch attendees with a large page size to cover most cases
	const PAGE_SIZE = 100;
	let currentPage = $state(1);
	let showAll = $state(false);
	let showPronounDistribution = $state(false);

	// Query for attendee list
	let attendeesQuery = createQuery(() => ({
		queryKey: ['event-attendees', eventId, currentPage],
		queryFn: async () => {
			const response = await eventpublicdetailsGetEventAttendees({
				path: { event_id: eventId },
				query: { page: currentPage, page_size: PAGE_SIZE }
			});

			if (!response.data) {
				throw new Error('Failed to load attendees');
			}

			return response.data;
		},
		enabled: isAuthenticated
	}));

	// Query for pronoun distribution (only fetched when expanded)
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
		enabled: isAuthenticated && showPronounDistribution
	}));

	// Derived state for attendees
	let attendees = $derived(attendeesQuery.data?.results ?? []);
	let visibleCount = $derived(attendees.length);
	let hasMore = $derived(!!attendeesQuery.data?.next);
	let hiddenCount = $derived(totalAttendees - visibleCount);

	// Derived state for pronouns
	let distribution = $derived(pronounQuery.data?.distribution ?? []);
	let pronounTotalAttendees = $derived(pronounQuery.data?.total_attendees ?? 0);
	let totalWithPronouns = $derived(pronounQuery.data?.total_with_pronouns ?? 0);
	let totalWithoutPronouns = $derived(pronounQuery.data?.total_without_pronouns ?? 0);

	// Calculate percentage for bar width
	function getPercentage(count: number): number {
		if (pronounTotalAttendees === 0) return 0;
		return (count / pronounTotalAttendees) * 100;
	}

	// Get color class for pronoun bars - cycle through colors
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

	// Load next page
	function loadMore() {
		if (hasMore) {
			currentPage++;
		}
	}
</script>

{#if isAuthenticated && totalAttendees > 0}
	<section class="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
		<div class="mb-4 flex items-center gap-2">
			<Users class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
			<h2 class="text-lg font-semibold">{m['attendeeList.whosComing']()}</h2>
			<span class="text-sm text-muted-foreground">({totalAttendees})</span>
		</div>

		{#if attendeesQuery.isLoading}
			<div class="flex items-center justify-center py-8">
				<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
				<span class="sr-only">{m['attendeeList.loadingAttendees']()}</span>
			</div>
		{:else if attendeesQuery.isError}
			<div class="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
				<p>{m['attendeeList.failedToLoad']()}</p>
			</div>
		{:else if attendees.length === 0}
			<p class="text-sm text-muted-foreground">
				{m['attendeeList.listHidden']()}
			</p>
		{:else}
			<!-- Attendee list -->
			<div class="space-y-3">
				{#if !showAll}
					<!-- Show first 10 attendees -->
					{#each attendees.slice(0, 10) as attendee, index (index)}
						<div class="flex items-start gap-3">
							<UserAvatar
								profilePictureUrl={attendee.profile_picture_url}
								previewUrl={attendee.profile_picture_preview_url}
								thumbnailUrl={attendee.profile_picture_thumbnail_url}
								displayName={attendee.display_name}
								size="md"
								class="shrink-0"
								clickable={true}
							/>

							<!-- Attendee info -->
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium">{attendee.display_name}</p>
								{#if attendee.pronouns}
									<p class="truncate text-sm text-muted-foreground">({attendee.pronouns})</p>
								{/if}
							</div>
						</div>
					{/each}
				{:else}
					<!-- Show all attendees -->
					{#each attendees as attendee, index (index)}
						<div class="flex items-start gap-3">
							<UserAvatar
								profilePictureUrl={attendee.profile_picture_url}
								previewUrl={attendee.profile_picture_preview_url}
								thumbnailUrl={attendee.profile_picture_thumbnail_url}
								displayName={attendee.display_name}
								size="md"
								class="shrink-0"
								clickable={true}
							/>

							<!-- Attendee info -->
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium">{attendee.display_name}</p>
								{#if attendee.pronouns}
									<p class="truncate text-sm text-muted-foreground">({attendee.pronouns})</p>
								{/if}
							</div>
						</div>
					{/each}
				{/if}

				<!-- Show more button -->
				{#if !showAll && (attendees.length > 10 || hasMore)}
					<button
						type="button"
						class="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
						onclick={() => (showAll = true)}
					>
						<span>
							{#if hiddenCount > 0}
								{m['attendeeList.showAllWithCount']({ count: hiddenCount })}
							{:else}
								{m['attendeeList.showAll']()}
							{/if}
						</span>
						<ChevronDown class="h-4 w-4" aria-hidden="true" />
					</button>
				{/if}

				<!-- Load more button (for pagination) -->
				{#if showAll && hasMore}
					<button
						type="button"
						class="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
						onclick={loadMore}
						disabled={attendeesQuery.isFetching}
					>
						{#if attendeesQuery.isFetching}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							<span>{m['attendeeList.loading']()}</span>
						{:else}
							<span>{m['attendeeList.loadMore']()}</span>
						{/if}
					</button>
				{/if}

				<!-- Hidden attendees note -->
				{#if !hasMore && hiddenCount > 0}
					<p class="pt-2 text-center text-sm text-muted-foreground">
						{hiddenCount === 1
							? m['attendeeList.notShownSingular']({ count: hiddenCount })
							: m['attendeeList.notShownPlural']({ count: hiddenCount })}
					</p>
				{/if}
			</div>
		{/if}

		<!-- Pronoun Distribution Toggle -->
		<div class="mt-4 border-t pt-4">
			<button
				type="button"
				class="flex w-full items-center justify-between gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
				onclick={() => (showPronounDistribution = !showPronounDistribution)}
				aria-expanded={showPronounDistribution}
				aria-controls="pronoun-distribution"
			>
				<span class="flex items-center gap-2">
					<BarChart3 class="h-4 w-4" aria-hidden="true" />
					{m['pronounDistribution.title']()}
				</span>
				{#if showPronounDistribution}
					<ChevronUp class="h-4 w-4" aria-hidden="true" />
				{:else}
					<ChevronDown class="h-4 w-4" aria-hidden="true" />
				{/if}
			</button>

			<!-- Pronoun Distribution Content -->
			{#if showPronounDistribution}
				<div id="pronoun-distribution" class="mt-3" transition:slide={{ duration: 200 }}>
					{#if pronounQuery.isLoading}
						<div class="flex items-center justify-center py-4">
							<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
							<span class="sr-only">{m['pronounDistribution.loading']()}</span>
						</div>
					{:else if pronounQuery.isError}
						<p class="text-sm text-destructive">{m['pronounDistribution.error']()}</p>
					{:else if pronounTotalAttendees === 0}
						<p class="text-sm text-muted-foreground">{m['pronounDistribution.noAttendees']()}</p>
					{:else}
						<!-- Distribution bars -->
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
											aria-valuemax={pronounTotalAttendees}
											aria-label="{item.pronouns}: {item.count}"
										></div>
									</div>
								</div>
							{/each}

							<!-- Not specified bar -->
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
											aria-valuemax={pronounTotalAttendees}
											aria-label="{m['pronounDistribution.notSpecified']()}: {totalWithoutPronouns}"
										></div>
									</div>
								</div>
							{/if}
						</div>

						<!-- Summary -->
						<p class="mt-3 text-xs text-muted-foreground">
							{m['pronounDistribution.summary']({
								withPronouns: totalWithPronouns,
								total: pronounTotalAttendees
							})}
						</p>
					{/if}
				</div>
			{/if}
		</div>

		<!-- User visibility settings info -->
		{#if userVisibility}
			<div class="mt-4 border-t pt-4">
				<div class="flex items-center justify-between gap-2 text-sm">
					<div class="flex items-center gap-2 text-muted-foreground">
						<Settings class="h-4 w-4" aria-hidden="true" />
						<span>
							{m['attendeeList.yourVisibility']()}:
							<span class="font-medium text-foreground">{getVisibilityLabel(userVisibility)}</span>
						</span>
					</div>
					<a
						href={settingsUrl}
						class="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						{m['attendeeList.manageVisibility']()}
					</a>
				</div>
			</div>
		{/if}
	</section>
{/if}
