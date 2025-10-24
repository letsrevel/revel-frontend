import { error } from '@sveltejs/kit';
import {
	eventGetEventBySlugs,
	eventGetMyEventStatus,
	potluckListPotluckItems,
	permissionMyPermissions,
	eventListResources,
	eventListTiers
} from '$lib/api';
import type { PageServerLoad } from './$types';
import type { UserEventStatus } from '$lib/utils/eligibility';
import type {
	PotluckItemRetrieveSchema,
	OrganizationPermissionsSchema,
	AdditionalResourceSchema,
	TierSchema
} from '$lib/api/generated/types.gen';

export const load: PageServerLoad = async ({ params, locals, fetch }) => {
	const { org_slug, event_slug } = params;

	try {
		// Prepare headers with authentication if user is logged in
		const headers: HeadersInit = {};
		if (locals.user?.accessToken) {
			headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
		}

		// Fetch event details (pass auth to see private events)
		const eventResponse = await eventGetEventBySlugs({
			fetch,
			path: { org_slug, event_slug },
			headers
		});

		if (!eventResponse.data) {
			throw error(404, 'Event not found');
		}

		const event = eventResponse.data;

		// If user is authenticated, fetch their status
		let userStatus: UserEventStatus | null = null;

		if (locals.user) {
			try {
				const statusResponse = await eventGetMyEventStatus({
					fetch,
					path: { event_id: event.id },
					headers
				});

				if (statusResponse.data) {
					userStatus = statusResponse.data;
				}
			} catch (err) {
				// If user status fails, continue without it
				// This is not critical - user can still view the event
				console.error('Failed to fetch user event status:', err);
			}
		}

		// Fetch potluck items (requires authentication)
		let potluckItems: PotluckItemRetrieveSchema[] = [];
		if (locals.user) {
			try {
				const potluckResponse = await potluckListPotluckItems({
					fetch,
					path: { event_id: event.id },
					headers
				});

				if (potluckResponse.data) {
					potluckItems = potluckResponse.data;
				}
			} catch (err) {
				// If potluck items fail to load, continue without them
				// User will see empty state in the UI
				console.error('Failed to fetch potluck items:', err);
			}
		}

		// Fetch user permissions (requires authentication)
		let userPermissions: OrganizationPermissionsSchema | null = null;
		if (locals.user) {
			try {
				const permissionsResponse = await permissionMyPermissions({
					fetch,
					headers
				});

				if (permissionsResponse.data) {
					userPermissions = permissionsResponse.data;
				}
			} catch (err) {
				// If permissions fail to load, continue without them
				// User will have limited permissions by default
				console.error('Failed to fetch user permissions:', err);
			}
		}

		// Fetch event resources (public endpoint)
		let resources: AdditionalResourceSchema[] = [];
		try {
			const resourcesResponse = await eventListResources({
				fetch,
				path: { event_id: event.id }
			});

			if (resourcesResponse.data) {
				resources = resourcesResponse.data.results || [];
			}
		} catch (err) {
			// If resources fail to load, continue without them
			console.error('Failed to fetch event resources:', err);
		}

		// Fetch ticket tiers (public endpoint, filtered by eligibility)
		let ticketTiers: TierSchema[] = [];
		if (event.requires_ticket) {
			try {
				const tiersResponse = await eventListTiers({
					fetch,
					path: { event_id: event.id },
					headers
				});

				if (tiersResponse.data) {
					ticketTiers = tiersResponse.data;
				}
			} catch (err) {
				// If tiers fail to load, continue without them
				console.error('Failed to fetch ticket tiers:', err);
			}
		}

		return {
			event,
			userStatus,
			potluckItems,
			userPermissions,
			resources,
			ticketTiers,
			// Explicitly pass authentication state to the page
			isAuthenticated: !!locals.user
		};
	} catch (err) {
		// Handle different error types
		if (typeof err === 'object' && err !== null && 'status' in err) {
			const status = (err as { status: number }).status;

			if (status === 404) {
				throw error(404, 'Event not found');
			}

			if (status === 403) {
				throw error(403, 'You do not have permission to view this event');
			}
		}

		// Generic error
		console.error('Error loading event:', err);
		throw error(500, 'Failed to load event details');
	}
};
