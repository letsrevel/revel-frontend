<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Badge } from '$lib/components/ui/badge';
	import { Search, MapPin, Loader2, Calendar, Repeat, Info } from 'lucide-svelte';
	import {
		eventpublicdiscoveryListEvents,
		eventseriesListEventSeries,
		questionnaireReplaceEvents,
		questionnaireReplaceEventSeries,
		type EventInListSchema,
		type EventSeriesRetrieveSchema,
		type OrganizationQuestionnaireSchema
	} from '$lib/api/generated';
	import { invalidateAll } from '$app/navigation';

	interface Props {
		open: boolean;
		questionnaire: OrganizationQuestionnaireSchema;
		organizationId: string;
		accessToken: string;
		onClose: () => void;
	}

	let { open = $bindable(), questionnaire, organizationId, accessToken, onClose }: Props = $props();

	// Tab state
	let activeTab = $state('events');

	// Events state
	let searchQueryEvents = $state('');
	let isLoadingEvents = $state(true);
	let allEvents = $state<EventInListSchema[]>([]);
	let selectedEventIds = $state<Set<string>>(new Set());
	let includePastEvents = $state(false);

	// Series state
	let searchQuerySeries = $state('');
	let isLoadingSeries = $state(true);
	let allSeries = $state<EventSeriesRetrieveSchema[]>([]);
	let selectedSeriesIds = $state<Set<string>>(new Set());

	// Saving state
	let isSaving = $state(false);

	// Initialize selected events and series from questionnaire
	$effect(() => {
		if (open && questionnaire) {
			// Pre-select already assigned events
			const assignedEventIds = (questionnaire.events || []).map((e) => e.id);
			selectedEventIds = new Set(assignedEventIds);

			// Pre-select already assigned series
			const assignedSeriesIds = (questionnaire.event_series || []).map((s) => s.id);
			selectedSeriesIds = new Set(assignedSeriesIds);

			// Fetch organization events and series
			loadEvents();
			loadSeries();
		}
	});

	// Re-fetch events when includePastEvents changes (called from checkbox handler)
	function onIncludePastEventsChange(checked: boolean) {
		includePastEvents = checked;
		if (open) {
			loadEvents();
		}
	}

	async function loadEvents() {
		isLoadingEvents = true;
		try {
			const response = await eventpublicdiscoveryListEvents({
				query: {
					organization: organizationId,
					page_size: 100, // Fetch all org events
					include_past: includePastEvents
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.data) {
				allEvents = response.data.results || [];
			}
		} catch (err) {
			console.error('Failed to load events:', err);
			alert('Failed to load events. Please try again.');
		} finally {
			isLoadingEvents = false;
		}
	}

	async function loadSeries() {
		isLoadingSeries = true;
		try {
			const response = await eventseriesListEventSeries({
				query: {
					organization: organizationId,
					page_size: 100 // Fetch all org series
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.data) {
				allSeries = response.data.results || [];
			}
		} catch (err) {
			console.error('Failed to load event series:', err);
			alert('Failed to load event series. Please try again.');
		} finally {
			isLoadingSeries = false;
		}
	}

	// Filtered events based on search query
	// Note: EventInListSchema doesn't include city/address, so we filter by name and description only
	const filteredEvents = $derived(
		allEvents.filter((event) => {
			const query = searchQueryEvents.toLowerCase().trim();
			if (!query) return true;

			return (
				event.name.toLowerCase().includes(query) || event.description?.toLowerCase().includes(query)
			);
		})
	);

	// Filtered series based on search query
	const filteredSeries = $derived(
		allSeries.filter((series) => {
			const query = searchQuerySeries.toLowerCase().trim();
			if (!query) return true;

			return (
				series.name.toLowerCase().includes(query) ||
				series.organization.name.toLowerCase().includes(query) ||
				series.description?.toLowerCase().includes(query)
			);
		})
	);

	// Toggle event selection
	function toggleEvent(eventId: string) {
		const newSet = new Set(selectedEventIds);
		if (newSet.has(eventId)) {
			newSet.delete(eventId);
		} else {
			newSet.add(eventId);
		}
		selectedEventIds = newSet;
	}

	// Toggle series selection
	function toggleSeries(seriesId: string) {
		const newSet = new Set(selectedSeriesIds);
		if (newSet.has(seriesId)) {
			newSet.delete(seriesId);
		} else {
			newSet.add(seriesId);
		}
		selectedSeriesIds = newSet;
	}

	// Save assignments
	async function saveAssignments() {
		isSaving = true;

		try {
			// Save event assignments
			const eventsResponse = await questionnaireReplaceEvents({
				path: { org_questionnaire_id: questionnaire.id },
				body: { event_ids: Array.from(selectedEventIds) },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (eventsResponse.error) {
				throw new Error('Failed to update event assignments');
			}

			// Save series assignments
			const seriesResponse = await questionnaireReplaceEventSeries({
				path: { org_questionnaire_id: questionnaire.id },
				body: { event_series_ids: Array.from(selectedSeriesIds) },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (seriesResponse.error) {
				throw new Error('Failed to update series assignments');
			}

			// Refresh data and close modal
			await invalidateAll();
			onClose();
		} catch (err) {
			console.error('Failed to save assignments:', err);
			alert('Failed to save assignments. Please try again.');
		} finally {
			isSaving = false;
		}
	}

	// Count of changes
	const selectedEventsCount = $derived(selectedEventIds.size);
	const selectedSeriesCount = $derived(selectedSeriesIds.size);

	// Check for changes by comparing selected IDs with original assignments
	const hasChanges = $derived.by(() => {
		// Get original event and series IDs
		const originalEventIds = new Set((questionnaire.events || []).map((e) => e.id));
		const originalSeriesIds = new Set((questionnaire.event_series || []).map((s) => s.id));

		// Check if counts differ
		if (originalEventIds.size !== selectedEventIds.size) return true;
		if (originalSeriesIds.size !== selectedSeriesIds.size) return true;

		// Check if any selected events are new (not in original)
		for (const id of selectedEventIds) {
			if (!originalEventIds.has(id)) return true;
		}

		// Check if any original events are removed (not in selected)
		for (const id of originalEventIds) {
			if (!selectedEventIds.has(id)) return true;
		}

		// Check if any selected series are new (not in original)
		for (const id of selectedSeriesIds) {
			if (!originalSeriesIds.has(id)) return true;
		}

		// Check if any original series are removed (not in selected)
		for (const id of originalSeriesIds) {
			if (!selectedSeriesIds.has(id)) return true;
		}

		return false;
	});
</script>

<Dialog bind:open>
	<DialogContent class="max-h-[90vh] max-w-3xl overflow-hidden p-0">
		<DialogHeader class="border-b p-6 pb-4">
			<DialogTitle>{m['questionnaireAssignmentModal.assignQuestionnaire']()}</DialogTitle>
			<p class="mt-1 text-sm text-muted-foreground">
				Select which events or event series require completion of "{questionnaire.questionnaire
					.name}"
			</p>
		</DialogHeader>

		<Tabs value={activeTab} onValueChange={(v) => (activeTab = v)}>
			<TabsList class="mx-6 mt-4 grid w-auto grid-cols-2">
				<TabsTrigger value="events" class="gap-2">
					<Calendar class="h-4 w-4" aria-hidden="true" />
					Events ({selectedEventsCount})
				</TabsTrigger>
				<TabsTrigger value="series" class="gap-2">
					<Repeat class="h-4 w-4" aria-hidden="true" />
					Series ({selectedSeriesCount})
				</TabsTrigger>
			</TabsList>

			<!-- Events Tab -->
			<TabsContent value="events">
				<!-- Include past events checkbox -->
				<div class="mx-6 mt-4 flex items-center gap-2">
					<Checkbox
						id="include-past-events"
						checked={includePastEvents}
						onCheckedChange={(checked) => onIncludePastEventsChange(!!checked)}
					/>
					<label for="include-past-events" class="cursor-pointer text-sm text-muted-foreground">
						{m['questionnaireAssignmentModal.includePastEvents']()}
					</label>
				</div>

				<!-- Search Bar -->
				<div class="border-b px-6 py-4">
					<div class="relative">
						<Search
							class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<Input
							type="text"
							placeholder="Search events by name or location..."
							bind:value={searchQueryEvents}
							class="pl-10"
							aria-label="Search events"
						/>
					</div>
				</div>

				<!-- Events List -->
				<div class="max-h-96 overflow-y-auto px-6 py-4">
					{#if isLoadingEvents}
						<div class="flex items-center justify-center py-12">
							<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
							<span class="ml-2 text-sm text-muted-foreground"
								>{m['questionnaireAssignmentModal.loadingEvents']()}</span
							>
						</div>
					{:else if filteredEvents.length === 0}
						<div class="py-12 text-center">
							<p class="text-sm text-muted-foreground">
								{searchQueryEvents ? 'No events match your search' : 'No events available'}
							</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each filteredEvents as event (event.id)}
								<button
									type="button"
									onclick={() => toggleEvent(event.id)}
									class="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
									class:border-primary={selectedEventIds.has(event.id)}
									class:bg-accent={selectedEventIds.has(event.id)}
								>
									<div
										onclick={(e) => e.stopPropagation()}
										onkeydown={(e) => e.stopPropagation()}
										role="presentation"
									>
										<Checkbox
											checked={selectedEventIds.has(event.id)}
											onCheckedChange={() => toggleEvent(event.id)}
											aria-label={`Select ${event.name}`}
											class="mt-1"
										/>
									</div>
									<div class="min-w-0 flex-1">
										<div class="flex items-start justify-between gap-2">
											<h3 class="line-clamp-1 font-medium">{event.name}</h3>
											<Badge variant="outline" class="flex-shrink-0 text-xs">
												{event.event_type}
											</Badge>
										</div>
										<div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
											{#if event.city}
												{@const cityName =
													typeof event.city === 'object' && event.city !== null
														? event.city.name
														: event.city}
												<div class="flex items-center gap-1">
													<MapPin class="h-3 w-3" aria-hidden="true" />
													<span>{cityName}</span>
												</div>
											{/if}
										</div>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</TabsContent>

			<!-- Series Tab -->
			<TabsContent value="series">
				<!-- Info banner -->
				<div class="mx-6 mt-4 flex gap-2 rounded-md bg-blue-50 p-3 text-sm dark:bg-blue-950">
					<Info class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
					<p class="text-blue-900 dark:text-blue-100">
						{m['questionnaireAssignmentModal.assigningToSeries']()}
						<strong>{m['questionnaireAssignmentModal.allEvents']()}</strong> in that series.
					</p>
				</div>

				<!-- Search Bar -->
				<div class="border-b px-6 py-4">
					<div class="relative">
						<Search
							class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<Input
							type="text"
							placeholder="Search series by name..."
							bind:value={searchQuerySeries}
							class="pl-10"
							aria-label="Search event series"
						/>
					</div>
				</div>

				<!-- Series List -->
				<div class="max-h-96 overflow-y-auto px-6 py-4">
					{#if isLoadingSeries}
						<div class="flex items-center justify-center py-12">
							<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
							<span class="ml-2 text-sm text-muted-foreground"
								>{m['questionnaireAssignmentModal.loadingEventSeries']()}</span
							>
						</div>
					{:else if filteredSeries.length === 0}
						<div class="py-12 text-center">
							<p class="text-sm text-muted-foreground">
								{searchQuerySeries ? 'No series match your search' : 'No event series available'}
							</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each filteredSeries as series (series.id)}
								<button
									type="button"
									onclick={() => toggleSeries(series.id)}
									class="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
									class:border-primary={selectedSeriesIds.has(series.id)}
									class:bg-accent={selectedSeriesIds.has(series.id)}
								>
									<div
										onclick={(e) => e.stopPropagation()}
										onkeydown={(e) => e.stopPropagation()}
										role="presentation"
									>
										<Checkbox
											checked={selectedSeriesIds.has(series.id)}
											onCheckedChange={() => toggleSeries(series.id)}
											aria-label={`Select ${series.name}`}
											class="mt-1"
										/>
									</div>
									<div class="min-w-0 flex-1">
										<div class="flex items-start justify-between gap-2">
											<h3 class="line-clamp-1 font-medium">{series.name}</h3>
											<Badge variant="secondary" class="flex gap-1 text-xs">
												<Repeat class="h-3 w-3" aria-hidden="true" />
												Series
											</Badge>
										</div>
										{#if series.description}
											<p class="mt-1 line-clamp-2 text-sm text-muted-foreground">
												{series.description}
											</p>
										{/if}
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</TabsContent>
		</Tabs>

		<!-- Footer -->
		<div class="border-t bg-muted/30 px-6 py-4">
			<div class="flex items-center justify-between">
				<div class="text-sm text-muted-foreground">
					<span class="font-medium text-foreground">{selectedEventsCount}</span>
					{selectedEventsCount === 1 ? 'event' : 'events'},
					<span class="font-medium text-foreground">{selectedSeriesCount}</span>
					{selectedSeriesCount === 1 ? 'series' : 'series'} selected
				</div>
				<div class="flex gap-2">
					<Button variant="outline" onclick={onClose} disabled={isSaving}
						>{m['questionnaireAssignmentModal.cancel']()}</Button
					>
					<Button onclick={saveAssignments} disabled={!hasChanges || isSaving}>
						{#if isSaving}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							Saving...
						{:else}
							Save Assignments
						{/if}
					</Button>
				</div>
			</div>
		</div>
	</DialogContent>
</Dialog>
