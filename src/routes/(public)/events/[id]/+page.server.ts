import { error } from '@sveltejs/kit';
import {
	eventpublicdetailsGetEvent,
	eventpublicattendanceGetMyEventStatus,
	potluckListPotluckItems,
	permissionMyPermissions,
	eventpublicdetailsListResources,
	eventpublicticketsListTiers,
	eventpublicdiscoveryGetEventTokenDetails,
	userpreferencesGetGeneralPreferences
} from '$lib/api';
import type { PageServerLoad } from './$types';
import type { UserEventStatus } from '$lib/utils/eligibility';
import type {
	PotluckItemRetrieveSchema,
	OrganizationPermissionsSchema,
	AdditionalResourceSchema,
	TicketTierSchema,
	EventTokenSchema,
	MembershipTierSchema,
	MembershipStatus,
	VisibilityPreference
} from '$lib/api/generated/types.gen';

export const load: PageServerLoad = async ({ params, locals, fetch, url }) => {
	const { id } = params;

	try {
		// Prepare headers with authentication if user is logged in
		const headers: HeadersInit = {};
		if (locals.user?.accessToken) {
			headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
		}

		// Check for event token (?et=) for visibility
		const eventToken = url.searchParams.get('et');
		if (eventToken) {
			headers['X-Event-Token'] = eventToken;
		}

		// Fetch event details by ID (pass auth to see private events)
		const eventResponse = await eventpublicdetailsGetEvent({
			fetch,
			path: { event_id: id },
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
				const statusResponse = await eventpublicattendanceGetMyEventStatus({
					fetch,
					path: { event_id: event.id },
					headers
				});

				if (statusResponse.data) {
					// Backend returns EventRsvpSchema/EventTicketSchema with correct status types at runtime
					// but generated types are incorrect, so we need to cast
					userStatus = statusResponse.data as unknown as UserEventStatus;
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
		let isMember = false;
		let membershipTier: MembershipTierSchema | null = null;
		let membershipStatus: MembershipStatus | null = null;
		let isOwner = false;
		let isStaff = false;
		if (locals.user) {
			try {
				const permissionsResponse = await permissionMyPermissions({
					fetch,
					headers
				});

				if (permissionsResponse.data) {
					userPermissions = permissionsResponse.data;

					// Check if user is a member using the memberships dict
					const membership = userPermissions.memberships?.[event.organization.id];
					if (membership) {
						isMember = true;
						// Extract tier and status from MinimalOrganizationMemberSchema
						membershipTier = membership.tier || null;
						membershipStatus = (membership.status as MembershipStatus) || null;
					}

					// Check if user is owner or staff
					const orgPermissions = userPermissions.organization_permissions?.[event.organization.id];
					if (orgPermissions === 'owner') {
						isOwner = true;
					} else if (orgPermissions && typeof orgPermissions === 'object') {
						// If orgPermissions is an object with permission keys, user is staff
						isStaff = true;
					}
				}
			} catch (err) {
				// If permissions fail to load, continue without them
				// User will have limited permissions by default
				console.error('Failed to fetch user permissions:', err);
			}
		}

		// Fetch event resources (pass auth to see restricted resources)
		let resources: AdditionalResourceSchema[] = [];
		try {
			const resourcesResponse = await eventpublicdetailsListResources({
				fetch,
				path: { event_id: event.id },
				headers
			});

			if (resourcesResponse.data) {
				resources = resourcesResponse.data.results || [];
			}
		} catch (err) {
			// If resources fail to load, continue without them
			console.error('Failed to fetch event resources:', err);
		}

		// Fetch ticket tiers (public endpoint, filtered by eligibility)
		let ticketTiers: TicketTierSchema[] = [];
		if (event.requires_ticket) {
			try {
				const tiersResponse = await eventpublicticketsListTiers({
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

		// Fetch event token details if token parameter is present
		let eventTokenDetails: EventTokenSchema | null = null;
		if (eventToken) {
			try {
				const tokenResponse = await eventpublicdiscoveryGetEventTokenDetails({
					fetch,
					path: { token_id: eventToken },
					headers
				});

				if (tokenResponse.data) {
					eventTokenDetails = tokenResponse.data;
					console.log('[EVENT PAGE SERVER] Token details fetched:', {
						tokenId: eventTokenDetails.id,
						grantsInvitation: eventTokenDetails.grants_invitation,
						hasAllFields: {
							id: !!eventTokenDetails.id,
							grants_invitation: eventTokenDetails.grants_invitation !== undefined
						}
					});
				}
			} catch (err) {
				// If token is invalid or expired, continue without it
				console.error('Failed to fetch event token details:', err);
			}
		}

		// Fetch user's visibility preferences (for attendee list display)
		let userVisibility: VisibilityPreference | null = null;
		if (locals.user?.accessToken) {
			try {
				const prefsResponse = await userpreferencesGetGeneralPreferences({
					fetch,
					headers
				});

				if (prefsResponse.data?.show_me_on_attendee_list) {
					userVisibility = prefsResponse.data.show_me_on_attendee_list;
				}
			} catch (err) {
				// If preferences fail to load, continue without them
				console.error('Failed to fetch user preferences:', err);
			}
		}

		return {
			event,
			userStatus,
			potluckItems,
			userPermissions,
			resources,
			ticketTiers,
			isMember,
			membershipTier,
			membershipStatus,
			isOwner,
			isStaff,
			eventTokenDetails,
			userVisibility,
			// Explicitly pass authentication state to the page
			isAuthenticated: !!locals.user,
			accessToken: locals.user?.accessToken ?? null
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
