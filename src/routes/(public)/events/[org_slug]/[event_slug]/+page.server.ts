import { error, isHttpError } from '@sveltejs/kit';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import { log } from '$lib/server/logger';
import {
	eventpublicdetailsGetEventBySlugs,
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

export const load: PageServerLoad = async ({ params, locals, fetch, url, request, setHeaders }) => {
	const { org_slug, event_slug } = params;

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

		// Fetch event details (pass auth to see private events)
		const eventResponse = await eventpublicdetailsGetEventBySlugs({
			fetch,
			path: { org_slug, event_slug },
			headers
		});

		if (!eventResponse.data) {
			if (eventResponse.response?.status === 410) {
				throw error(410, 'This invitation link is no longer valid');
			}
			throw error(404, 'Event not found');
		}

		const event = eventResponse.data;

		// Compute SEO and soft-404 for past/cancelled events
		const lang = resolveLang(request);
		const eventStart = event.start ? new Date(event.start) : null;
		const isCancelled = event.status === 'cancelled';
		const isPast = eventStart != null && eventStart.getTime() < Date.now();
		const indexable = !isCancelled && !isPast;
		if (!indexable) {
			setHeaders({ 'X-Robots-Tag': 'noindex,follow' });
		}
		const seo = buildSeo({ kind: 'event', url, lang, event, indexable });

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
				log.error('user_event_status_fetch_failed', { error: err, eventId: event.id });
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
				log.error('potluck_items_fetch_failed', { error: err, eventId: event.id });
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
					// memberships is now a dict of { [org_id]: MinimalOrganizationMemberSchema }
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
				log.error('user_permissions_fetch_failed', { error: err });
			}
		}

		// Fetch event resources (authenticated endpoint for visibility filtering)
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
			log.debug('event_resources_fetched', { eventId: event.id, count: resources.length });
		} catch (err) {
			// If resources fail to load, continue without them
			log.error('event_resources_fetch_failed', { error: err, eventId: event.id });
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
				log.error('ticket_tiers_fetch_failed', { error: err, eventId: event.id });
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
					log.debug('event_token_details_fetched', {
						tokenId: eventTokenDetails.id,
						grantsInvitation: eventTokenDetails.grants_invitation
					});
				}
			} catch (err) {
				// If token is invalid or expired, continue without it
				log.error('event_token_details_fetch_failed', { error: err });
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
				log.error('user_preferences_fetch_failed', { error: err });
			}
		}

		const returnData = {
			seo,
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
			// Explicitly pass authentication state to the page. The token
			// itself is NOT shipped — the client reads it from authStore to
			// avoid serializing the JWT into the SSR HTML.
			isAuthenticated: !!locals.user
		};

		log.debug('event_page_data_ready', {
			eventId: returnData.event.id,
			potluckItemsCount: returnData.potluckItems.length,
			resourcesCount: returnData.resources.length,
			ticketTiersCount: returnData.ticketTiers.length,
			hasEventTokenDetails: !!returnData.eventTokenDetails
		});

		return returnData;
	} catch (err) {
		// Re-throw SvelteKit errors (e.g. our own throw error() calls above)
		if (isHttpError(err)) throw err;

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
		log.error('event_load_error', { error: err, orgSlug: org_slug, eventSlug: event_slug });
		throw error(500, 'Failed to load event details');
	}
};
