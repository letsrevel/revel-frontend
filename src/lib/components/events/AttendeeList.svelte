<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { eventGetEventAttendees } from '$lib/api';
	import type { MinimalRevelUserSchema } from '$lib/api/generated/types.gen';
	import { Users, ChevronDown, Loader2 } from 'lucide-svelte';

	interface Props {
		eventId: string;
		totalAttendees: number;
		isAuthenticated: boolean;
	}

	let { eventId, totalAttendees, isAuthenticated }: Props = $props();

	// Fetch attendees with a large page size to cover most cases
	const PAGE_SIZE = 100;
	let currentPage = $state(1);
	let showAll = $state(false);

	// Query for attendee list
	let attendeesQuery = createQuery(() => ({
		queryKey: ['event-attendees', eventId, currentPage],
		queryFn: async () => {
			const response = await eventGetEventAttendees({
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

	// Derived state
	let attendees = $derived(attendeesQuery.data?.results ?? []);
	let visibleCount = $derived(attendees.length);
	let hasMore = $derived(!!attendeesQuery.data?.next);
	let hiddenCount = $derived(totalAttendees - visibleCount);

	// Format attendee name
	function formatAttendeeName(attendee: MinimalRevelUserSchema): string {
		if (attendee.preferred_name) {
			return attendee.preferred_name;
		}

		const parts: string[] = [];
		if (attendee.first_name) parts.push(attendee.first_name);
		if (attendee.last_name) parts.push(attendee.last_name);

		return parts.length > 0 ? parts.join(' ') : m['attendeeList.anonymous']();
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
							<!-- Avatar placeholder -->
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary"
								aria-hidden="true"
							>
								{formatAttendeeName(attendee).charAt(0).toUpperCase()}
							</div>

							<!-- Attendee info -->
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium">{formatAttendeeName(attendee)}</p>
								{#if attendee.pronouns}
									<p class="truncate text-sm text-muted-foreground">{attendee.pronouns}</p>
								{/if}
							</div>
						</div>
					{/each}
				{:else}
					<!-- Show all attendees -->
					{#each attendees as attendee, index (index)}
						<div class="flex items-start gap-3">
							<!-- Avatar placeholder -->
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary"
								aria-hidden="true"
							>
								{formatAttendeeName(attendee).charAt(0).toUpperCase()}
							</div>

							<!-- Attendee info -->
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium">{formatAttendeeName(attendee)}</p>
								{#if attendee.pronouns}
									<p class="truncate text-sm text-muted-foreground">{attendee.pronouns}</p>
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
	</section>
{/if}
