import { error, fail, redirect, isHttpError, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	eventadmininvitationrequestsListInvitationRequests,
	eventadmininvitationrequestsApproveInvitationRequest,
	eventadmininvitationrequestsRejectInvitationRequest,
	eventadmininvitationsListInvitations,
	eventadmininvitationsListPendingInvitations,
	eventadmininvitationsCreateInvitations,
	eventadmininvitationsDeleteInvitationEndpoint,
	eventpublicdetailsGetEvent,
	eventadminticketsListTicketTiers
} from '$lib/api/generated/sdk.gen';
import type {
	EventInvitationListSchema,
	EventInvitationRequestInternalSchema,
	InvitationRequestStatus,
	PendingEventInvitationListSchema,
	TicketTierDetailSchema
} from '$lib/api/generated/types.gen';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';
import { computePagination, defaultPagination } from './pagination';
import { parseInvitationOptions } from './invitation-form';

/**
 * Load invitation requests AND invitations for this event
 */
export const load: PageServerLoad = async ({ parent, params, url, cookies, fetch }) => {
	const { organization } = await parent();
	const accessToken = cookies.get('access_token');

	if (!accessToken) {
		throw redirect(302, `/login?redirect=${encodeURIComponent(url.pathname)}`);
	}

	// Load event to verify ownership
	let event;
	try {
		const eventResponse = await eventpublicdetailsGetEvent({
			fetch,
			path: { event_id: params.event_id },
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});

		if (!eventResponse.data) {
			throw error(404, 'Event not found');
		}

		event = eventResponse.data;
	} catch (err) {
		if (isHttpError(err)) throw err;
		// Unexpected failures (network, 5xx) are not a missing event — don't mask
		// outages as 404.
		log.error('event_load_failed', { error: err, eventId: params.event_id });
		throw error(500, 'Failed to load event');
	}

	// Verify event belongs to this organization
	if (event.organization?.slug !== organization.slug) {
		throw error(403, 'Event does not belong to this organization');
	}

	// Get query parameters. `status` is untrusted external input, so narrow it
	// against the allowed invitation-request statuses; anything else falls back
	// to undefined = "all statuses".
	const activeTab = url.searchParams.get('tab') || 'requests';
	const INVITATION_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;
	const rawStatus = url.searchParams.get('status') || undefined;
	const status: InvitationRequestStatus | undefined = INVITATION_REQUEST_STATUSES.find(
		(s) => s === rawStatus
	);
	const search = url.searchParams.get('search') || undefined;
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const pageSize = parseInt(url.searchParams.get('page_size') || '20', 10);

	const headers = {
		Authorization: `Bearer ${accessToken}`
	};

	// Load invitation requests
	let invitationRequests: EventInvitationRequestInternalSchema[] = [];
	let requestsPagination = defaultPagination();

	try {
		const response = await eventadmininvitationrequestsListInvitationRequests({
			fetch,
			path: { event_id: params.event_id },
			query: {
				status,
				search,
				page: activeTab === 'requests' ? page : 1,
				page_size: activeTab === 'requests' ? pageSize : 20
			},
			headers
		});

		if (response.data) {
			invitationRequests = response.data.results || [];
			const totalCount = response.data.count || 0;
			requestsPagination = computePagination(activeTab === 'requests', page, pageSize, totalCount);
		}
	} catch (err) {
		log.error('invitation_requests_load_failed', { error: err, eventId: params.event_id });
	}

	// Load registered invitations
	let registeredInvitations: EventInvitationListSchema[] = [];
	let registeredPagination = defaultPagination();

	try {
		const response = await eventadmininvitationsListInvitations({
			fetch,
			path: { event_id: params.event_id },
			query: {
				search,
				page: activeTab === 'invitations' ? page : 1,
				page_size: activeTab === 'invitations' ? pageSize : 20
			},
			headers
		});

		if (response.data) {
			registeredInvitations = response.data.results || [];
			const totalCount = response.data.count || 0;
			registeredPagination = computePagination(
				activeTab === 'invitations',
				page,
				pageSize,
				totalCount
			);
		}
	} catch (err) {
		log.error('registered_invitations_load_failed', { error: err, eventId: params.event_id });
	}

	// Load pending invitations
	let pendingInvitations: PendingEventInvitationListSchema[] = [];
	let pendingPagination = defaultPagination();

	try {
		const response = await eventadmininvitationsListPendingInvitations({
			fetch,
			path: { event_id: params.event_id },
			query: {
				search,
				page: activeTab === 'invitations' ? page : 1,
				page_size: activeTab === 'invitations' ? pageSize : 20
			},
			headers
		});

		if (response.data) {
			pendingInvitations = response.data.results || [];
			const totalCount = response.data.count || 0;
			pendingPagination = computePagination(
				activeTab === 'invitations',
				page,
				pageSize,
				totalCount
			);
		}
	} catch (err) {
		log.error('pending_invitations_load_failed', { error: err, eventId: params.event_id });
	}

	// Load ticket tiers for tier selection in invitation forms
	let ticketTiers: TicketTierDetailSchema[] = [];
	try {
		const tierResponse = await eventadminticketsListTicketTiers({
			fetch,
			path: { event_id: params.event_id },
			query: { page_size: 100 },
			headers
		});
		ticketTiers = tierResponse.data?.results || [];
	} catch {
		/* non-critical */
	}

	return {
		organization,
		event,
		activeTab,
		invitationRequests,
		requestsPagination,
		registeredInvitations,
		registeredPagination,
		pendingInvitations,
		pendingPagination,
		ticketTiers,
		filters: {
			status,
			search
		}
	};
};

/**
 * Form actions
 */
export const actions: Actions = {
	// Approve invitation request
	approveRequest: async ({ request, params, cookies, fetch }) => {
		const accessToken = cookies.get('access_token');
		if (!accessToken) {
			return fail(401, { errors: { form: 'You must be logged in' } });
		}

		const formData = await request.formData();
		const requestId = formData.get('request_id') as string;

		if (!requestId) {
			return fail(400, { errors: { form: 'Request ID is required' } });
		}

		try {
			const response = await eventadmininvitationrequestsApproveInvitationRequest({
				fetch,
				path: { event_id: params.event_id, request_id: requestId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				const errorMessage = extractErrorMessage(response.error, 'Failed to approve request');
				return fail(500, { errors: { form: errorMessage } });
			}

			return { success: true, action: 'approved' };
		} catch (err) {
			log.error('invitation_request_approve_failed', { error: err, eventId: params.event_id });
			const errorMessage = extractErrorMessage(err, 'An unexpected error occurred');
			return fail(500, { errors: { form: errorMessage } });
		}
	},

	// Reject invitation request
	rejectRequest: async ({ request, params, cookies, fetch }) => {
		const accessToken = cookies.get('access_token');
		if (!accessToken) {
			return fail(401, { errors: { form: 'You must be logged in' } });
		}

		const formData = await request.formData();
		const requestId = formData.get('request_id') as string;

		if (!requestId) {
			return fail(400, { errors: { form: 'Request ID is required' } });
		}

		try {
			const response = await eventadmininvitationrequestsRejectInvitationRequest({
				fetch,
				path: { event_id: params.event_id, request_id: requestId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				const errorMessage = extractErrorMessage(response.error, 'Failed to reject request');
				return fail(500, { errors: { form: errorMessage } });
			}

			return { success: true, action: 'rejected' };
		} catch (err) {
			log.error('invitation_request_reject_failed', { error: err, eventId: params.event_id });
			const errorMessage = extractErrorMessage(err, 'An unexpected error occurred');
			return fail(500, { errors: { form: errorMessage } });
		}
	},

	// Create invitations
	createInvitations: async ({ request, params, cookies, fetch }) => {
		const accessToken = cookies.get('access_token');
		if (!accessToken) {
			return fail(401, { errors: { form: 'You must be logged in' } });
		}

		const formData = await request.formData();
		const emailsRaw = formData.get('emails') as string | null;
		const invitationOptions = parseInvitationOptions(formData);

		if (!emailsRaw) {
			return fail(400, { errors: { form: 'Emails are required' } });
		}

		// Parse emails (comma or newline separated)
		const emails = emailsRaw
			.split(/[\n,]/)
			.map((e) => e.trim())
			.filter((e) => e.length > 0);

		if (emails.length === 0) {
			return fail(400, { errors: { form: 'At least one email is required' } });
		}

		try {
			const response = await eventadmininvitationsCreateInvitations({
				fetch,
				path: { event_id: params.event_id },
				body: {
					emails,
					...invitationOptions
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				const errorMessage = extractErrorMessage(response.error, 'Failed to create invitations');
				return fail(500, { errors: { form: errorMessage } });
			}

			return { success: true, action: 'created', data: response.data };
		} catch (err) {
			log.error('invitations_create_failed', { error: err, eventId: params.event_id });
			const errorMessage = extractErrorMessage(err, 'An unexpected error occurred');
			return fail(500, { errors: { form: errorMessage } });
		}
	},

	// Delete invitation
	deleteInvitation: async ({ request, params, cookies, fetch }) => {
		const accessToken = cookies.get('access_token');
		if (!accessToken) {
			return fail(401, { errors: { form: 'You must be logged in' } });
		}

		const formData = await request.formData();
		const invitationId = formData.get('invitation_id') as string;
		const invitationType = formData.get('invitation_type') as 'registered' | 'pending';

		if (!invitationId || !invitationType) {
			return fail(400, { errors: { form: 'Invitation ID and type are required' } });
		}

		try {
			const response = await eventadmininvitationsDeleteInvitationEndpoint({
				fetch,
				path: {
					event_id: params.event_id,
					invitation_type: invitationType,
					invitation_id: invitationId
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				const errorMessage = extractErrorMessage(response.error, 'Failed to delete invitation');
				return fail(500, { errors: { form: errorMessage } });
			}

			return { success: true, action: 'deleted' };
		} catch (err) {
			log.error('invitation_delete_failed', { error: err, eventId: params.event_id });
			const errorMessage = extractErrorMessage(err, 'An unexpected error occurred');
			return fail(500, { errors: { form: errorMessage } });
		}
	},

	// Update invitation (uses update_or_create endpoint)
	updateInvitation: async ({ request, params, cookies, fetch }) => {
		const accessToken = cookies.get('access_token');
		if (!accessToken) {
			return fail(401, { errors: { form: 'You must be logged in' } });
		}

		const formData = await request.formData();
		const email = formData.get('email') as string | null;
		const invitationOptions = parseInvitationOptions(formData);

		if (!email) {
			return fail(400, { errors: { form: 'Email is required' } });
		}

		try {
			const response = await eventadmininvitationsCreateInvitations({
				fetch,
				path: { event_id: params.event_id },
				body: {
					emails: [email],
					...invitationOptions
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				const errorMessage = extractErrorMessage(response.error, 'Failed to update invitation');
				return fail(500, { errors: { form: errorMessage } });
			}

			return { success: true, action: 'updated' };
		} catch (err) {
			log.error('invitation_update_failed', { error: err, eventId: params.event_id });
			const errorMessage = extractErrorMessage(err, 'An unexpected error occurred');
			return fail(500, { errors: { form: errorMessage } });
		}
	},

	// Bulk update invitations
	bulkUpdateInvitations: async ({ request, params, cookies, fetch }) => {
		const accessToken = cookies.get('access_token');
		if (!accessToken) {
			return fail(401, { errors: { form: 'You must be logged in' } });
		}

		const formData = await request.formData();
		const emailsRaw = formData.get('emails') as string | null;
		const invitationOptions = parseInvitationOptions(formData);

		if (!emailsRaw) {
			return fail(400, { errors: { form: 'Emails are required' } });
		}

		// Parse emails
		const emails = JSON.parse(emailsRaw) as string[];

		if (emails.length === 0) {
			return fail(400, { errors: { form: 'At least one email is required' } });
		}

		try {
			const response = await eventadmininvitationsCreateInvitations({
				fetch,
				path: { event_id: params.event_id },
				body: {
					emails,
					...invitationOptions
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				const errorMessage = extractErrorMessage(response.error, 'Failed to update invitations');
				return fail(500, { errors: { form: errorMessage } });
			}

			return { success: true, action: 'bulk_updated', count: emails.length };
		} catch (err) {
			log.error('invitations_bulk_update_failed', { error: err, eventId: params.event_id });
			const errorMessage = extractErrorMessage(err, 'An unexpected error occurred');
			return fail(500, { errors: { form: errorMessage } });
		}
	}
};
