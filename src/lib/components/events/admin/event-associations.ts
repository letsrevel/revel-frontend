import {
	organizationadminresourcesGetResource,
	organizationadminresourcesUpdateResource,
	eventadmincoreAddTags,
	eventadmincoreRemoveTags
} from '$lib/api/generated/sdk.gen';

/**
 * Save resource associations for an event.
 *
 * Diffs the currently-selected resource ids against the initial set and
 * updates each affected resource so its `event_ids` array gains/loses this
 * event. Shared verbatim between EventWizard and EventEditor (identical logic).
 */
export async function saveResourceAssociations(params: {
	organizationSlug: string;
	selectedResourceIds: string[];
	initialResourceIds: string[];
	eventId: string;
}): Promise<void> {
	const { organizationSlug, selectedResourceIds, initialResourceIds, eventId } = params;

	// Determine which resources were added and removed
	const addedResourceIds = selectedResourceIds.filter((id) => !initialResourceIds.includes(id));
	const removedResourceIds = initialResourceIds.filter((id) => !selectedResourceIds.includes(id));

	// Update all affected resources
	const updatePromises: Promise<unknown>[] = [];

	// Add event to newly selected resources
	for (const resourceId of addedResourceIds) {
		const promise = (async () => {
			// Fetch current resource state
			const resourceResponse = await organizationadminresourcesGetResource({
				path: {
					slug: organizationSlug,
					resource_id: resourceId
				}
			});

			if (resourceResponse.data) {
				const currentEventIds = resourceResponse.data.event_ids || [];
				// Add this event if not already present
				if (!currentEventIds.includes(eventId)) {
					await organizationadminresourcesUpdateResource({
						path: {
							slug: organizationSlug,
							resource_id: resourceId
						},
						body: {
							event_ids: [...currentEventIds, eventId]
						}
					});
				}
			}
		})();
		updatePromises.push(promise);
	}

	// Remove event from deselected resources
	for (const resourceId of removedResourceIds) {
		const promise = (async () => {
			// Fetch current resource state
			const resourceResponse = await organizationadminresourcesGetResource({
				path: {
					slug: organizationSlug,
					resource_id: resourceId
				}
			});

			if (resourceResponse.data) {
				const currentEventIds = resourceResponse.data.event_ids || [];
				// Remove this event
				await organizationadminresourcesUpdateResource({
					path: {
						slug: organizationSlug,
						resource_id: resourceId
					},
					body: {
						event_ids: currentEventIds.filter((id) => id !== eventId)
					}
				});
			}
		})();
		updatePromises.push(promise);
	}

	// Wait for all updates to complete
	await Promise.all(updatePromises);
}

/**
 * Save tag associations (add/remove tags) for an event.
 *
 * Diffs the current tags against the initial set and calls the add/remove tag
 * endpoints. Returns the new "initial tags" snapshot (`[...currentTags]`) that
 * the caller assigns back to its tracking state for future comparisons — this
 * keeps the reassignment side effect in the component while sharing the diff
 * logic verbatim between EventWizard and EventEditor.
 */
export async function saveTagAssociations(params: {
	eventId: string;
	currentTags: string[];
	initialTags: string[];
}): Promise<string[]> {
	const { eventId, currentTags, initialTags } = params;

	// Determine which tags were added and removed
	const addedTags = currentTags.filter((tag) => !initialTags.includes(tag));
	const removedTags = initialTags.filter((tag) => !currentTags.includes(tag));

	// Add new tags
	if (addedTags.length > 0) {
		await eventadmincoreAddTags({
			path: { event_id: eventId },
			body: { tags: addedTags }
		});
	}

	// Remove deleted tags
	if (removedTags.length > 0) {
		await eventadmincoreRemoveTags({
			path: { event_id: eventId },
			body: { tags: removedTags }
		});
	}

	// Return the new initial-tags snapshot for the caller to persist
	return [...currentTags];
}
