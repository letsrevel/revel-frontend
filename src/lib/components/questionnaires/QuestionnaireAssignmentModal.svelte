<script lang="ts">
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Badge } from '$lib/components/ui/badge';
	import { Search, MapPin, Loader2 } from 'lucide-svelte';
	import {
		eventListEvents,
		questionnaireReplaceEvents,
		type EventInListSchema,
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

	// State
	let searchQuery = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let allEvents = $state<EventInListSchema[]>([]);
	let selectedEventIds = $state<Set<string>>(new Set());

	// Initialize selected events from questionnaire
	$effect(() => {
		if (open && questionnaire) {
			// Pre-select already assigned events
			const assignedIds = (questionnaire.events || []).map((e) => e.id);
			selectedEventIds = new Set(assignedIds);

			// Fetch organization events
			loadEvents();
		}
	});

	async function loadEvents() {
		isLoading = true;
		try {
			const response = await eventListEvents({
				query: {
					organization: organizationId,
					page_size: 100 // Fetch all org events
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
			isLoading = false;
		}
	}

	// Filtered events based on search query
	const filteredEvents = $derived(
		allEvents.filter((event) => {
			const query = searchQuery.toLowerCase().trim();
			if (!query) return true;

			const cityName =
				typeof event.city === 'object' && event.city !== null ? event.city.name : event.city;

			return (
				event.name.toLowerCase().includes(query) ||
				cityName?.toLowerCase().includes(query) ||
				event.address?.toLowerCase().includes(query)
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

	// Save assignments
	async function saveAssignments() {
		isSaving = true;

		try {
			const response = await questionnaireReplaceEvents({
				path: { org_questionnaire_id: questionnaire.id },
				body: { event_ids: Array.from(selectedEventIds) },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to update assignments');
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
	const originalCount = $derived((questionnaire.events || []).length);
	const selectedCount = $derived(selectedEventIds.size);
	const hasChanges = $derived(
		originalCount !== selectedCount ||
			![...(questionnaire.events || [])].every((e) => selectedEventIds.has(e.id))
	);
</script>

<Dialog bind:open>
	<DialogContent class="max-h-[90vh] max-w-2xl overflow-hidden p-0">
		<DialogHeader class="border-b p-6 pb-4">
			<DialogTitle>Assign Questionnaire to Events</DialogTitle>
			<p class="mt-1 text-sm text-muted-foreground">
				Select which events require completion of "{questionnaire.questionnaire.name}"
			</p>
		</DialogHeader>

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
					bind:value={searchQuery}
					class="pl-10"
					aria-label="Search events"
				/>
			</div>
		</div>

		<!-- Events List -->
		<div class="max-h-96 overflow-y-auto px-6 py-4">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
					<span class="ml-2 text-sm text-muted-foreground">Loading events...</span>
				</div>
			{:else if filteredEvents.length === 0}
				<div class="py-12 text-center">
					<p class="text-sm text-muted-foreground">
						{searchQuery ? 'No events match your search' : 'No events available'}
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
							<Checkbox
								checked={selectedEventIds.has(event.id)}
								onCheckedChange={() => toggleEvent(event.id)}
								aria-label={`Select ${event.name}`}
								class="mt-1"
							/>
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

		<!-- Footer -->
		<div class="border-t bg-muted/30 px-6 py-4">
			<div class="flex items-center justify-between">
				<div class="text-sm text-muted-foreground">
					<span class="font-medium text-foreground">{selectedCount}</span>
					{selectedCount === 1 ? 'event' : 'events'} selected
				</div>
				<div class="flex gap-2">
					<Button variant="outline" onclick={onClose} disabled={isSaving}>Cancel</Button>
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
