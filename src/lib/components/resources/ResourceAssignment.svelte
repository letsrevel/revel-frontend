<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { eventListEvents } from '$lib/api/generated/sdk.gen';
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Check, Search } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		organizationId: string;
		selectedEventIds?: string[];
		onSelectionChange?: (eventIds: string[]) => void;
		disabled?: boolean;
	}

	let {
		organizationId,
		selectedEventIds = [],
		onSelectionChange,
		disabled = false
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	let searchQuery = $state('');

	// Fetch organization events
	const eventsQuery = createQuery<EventInListSchema[]>(() => ({
		queryKey: ['organization-events', organizationId],
		queryFn: async () => {
			const response = await eventListEvents({
				query: {
					organization: organizationId,
					page_size: 100 // Get a large number of events for assignment
				},
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to load events');
			}

			return response.data?.results || [];
		}
	}));

	// Filter events based on search
	const filteredEvents = $derived.by(() => {
		const events = eventsQuery.data || [];
		if (!searchQuery.trim()) return events;

		const query = searchQuery.toLowerCase();
		return events.filter(
			(event) =>
				event.name.toLowerCase().includes(query) || event.slug?.toLowerCase().includes(query)
		);
	});

	// Local selected set for better performance
	let selectedSet = $state(new Set(selectedEventIds));

	// Sync with prop changes
	$effect(() => {
		selectedSet = new Set(selectedEventIds);
	});

	function toggleEvent(eventId: string) {
		if (disabled) return;

		const newSet = new Set(selectedSet);
		if (newSet.has(eventId)) {
			newSet.delete(eventId);
		} else {
			newSet.add(eventId);
		}

		selectedSet = newSet;
		onSelectionChange?.(Array.from(newSet));
	}

	function isSelected(eventId: string): boolean {
		return selectedSet.has(eventId);
	}

	const isLoading = $derived(eventsQuery.isLoading);
	const error = $derived(eventsQuery.error);
</script>

<div class="space-y-4">
	<!-- Header -->
	<div>
		<h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">{m['resourceAssignment.assignToEvents']()}</h3>
		<p class="mt-1 text-xs text-muted-foreground">
			Select events where this resource should be available
		</p>
	</div>

	<!-- Search -->
	<div class="relative">
		<Search
			class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			aria-hidden="true"
		/>
		<input
			type="search"
			bind:value={searchQuery}
			placeholder="Search events..."
			disabled={disabled || isLoading}
			class="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			aria-label="Search events"
		/>
	</div>

	<!-- Event List -->
	<div
		class="max-h-64 overflow-y-auto rounded-md border"
		role="listbox"
		aria-label="Available events"
		aria-multiselectable="true"
	>
		{#if error}
			<div class="p-4 text-center text-sm text-destructive">{m['resourceAssignment.failedToLoadEvents']()}</div>
		{:else if isLoading}
			<div class="flex items-center justify-center p-8">
				<div
					class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
					aria-label="Loading events"
				></div>
			</div>
		{:else if filteredEvents.length === 0}
			<div class="p-4 text-center text-sm text-muted-foreground">
				{searchQuery ? 'No events found' : 'No events available'}
			</div>
		{:else}
			<ul class="divide-y">
				{#each filteredEvents as event (event.id)}
					<li>
						<button
							type="button"
							onclick={() => event.id && toggleEvent(event.id)}
							{disabled}
							class={cn(
								'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
								isSelected(event.id || '') && 'bg-primary/5'
							)}
							role="option"
							aria-selected={isSelected(event.id || '')}
						>
							<!-- Checkbox -->
							<div
								class={cn(
									'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
									isSelected(event.id || '') ? 'border-primary bg-primary' : 'border-input'
								)}
							>
								{#if isSelected(event.id || '')}
									<Check class="h-3.5 w-3.5 text-primary-foreground" aria-hidden="true" />
								{/if}
							</div>

							<!-- Event Info -->
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium">
									{event.name}
								</p>
								{#if event.start}
									<p class="text-xs text-muted-foreground">
										{new Date(event.start).toLocaleDateString('en-US', {
											year: 'numeric',
											month: 'short',
											day: 'numeric'
										})}
									</p>
								{/if}
							</div>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- Selection Summary -->
	{#if selectedSet.size > 0}
		<p class="text-xs text-muted-foreground">
			{selectedSet.size}
			{selectedSet.size === 1 ? 'event' : 'events'} selected
		</p>
	{/if}
</div>
