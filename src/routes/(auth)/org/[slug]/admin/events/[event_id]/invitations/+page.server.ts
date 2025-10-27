import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	eventadminListInvitationRequests,
	eventadminApproveInvitationRequest,
	eventadminRejectInvitationRequest,
	eventadminListInvitations,
	eventadminListPendingInvitations,
	eventadminCreateInvitations,
	eventadminDeleteInvitation,
	eventGetEvent
} from '$lib/api/generated/sdk.gen';

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
		const eventResponse = await eventGetEvent({
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
		console.error('Error loading event:', err);
		throw error(404, 'Event not found');
	}

	// Verify event belongs to this organization
	if (event.organization?.slug !== organization.slug) {
		throw error(403, 'Event does not belong to this organization');
	}

	// Get query parameters
	const activeTab = url.searchParams.get('tab') || 'requests';
	const status = url.searchParams.get('status') || undefined;
	const search = url.searchParams.get('search') || undefined;
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const pageSize = parseInt(url.searchParams.get('page_size') || '20', 10);

	const headers = {
		Authorization: `Bearer ${accessToken}`
	};

	// Load invitation requests
	let invitationRequests: any[] = [];
	let requestsPagination = {
		page: 1,
		pageSize: 20,
		totalCount: 0,
		totalPages: 0,
		hasNext: false,
		hasPrev: false
	};

	try {
		const response = await eventadminListInvitationRequests({
			fetch,
			path: { event_id: params.event_id },
			query: {
				status: status as 'pending' | 'approved' | 'rejected' | undefined,
				search,
				page: activeTab === 'requests' ? page : 1,
				page_size: activeTab === 'requests' ? pageSize : 20
			},
			headers
		});

		if (response.data) {
			invitationRequests = response.data.results || [];
			const totalCount = response.data.count || 0;
			const totalPages = Math.ceil(totalCount / (activeTab === 'requests' ? pageSize : 20));
			requestsPagination = {
				page: activeTab === 'requests' ? page : 1,
				pageSize: activeTab === 'requests' ? pageSize : 20,
				totalCount,
				totalPages,
				hasNext: (activeTab === 'requests' ? page : 1) < totalPages,
				hasPrev: (activeTab === 'requests' ? page : 1) > 1
			};
		}
	} catch (err) {
		console.error('Error loading invitation requests:', err);
	}

	// Load registered invitations
	let registeredInvitations: any[] = [];
	let registeredPagination = {
		page: 1,
		pageSize: 20,
		totalCount: 0,
		totalPages: 0,
		hasNext: false,
		hasPrev: false
	};

	try {
		const response = await eventadminListInvitations({
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
			const totalPages = Math.ceil(totalCount / (activeTab === 'invitations' ? pageSize : 20));
			registeredPagination = {
				page: activeTab === 'invitations' ? page : 1,
				pageSize: activeTab === 'invitations' ? pageSize : 20,
				totalCount,
				totalPages,
				hasNext: (activeTab === 'invitations' ? page : 1) < totalPages,
				hasPrev: (activeTab === 'invitations' ? page : 1) > 1
			};
		}
	} catch (err) {
		console.error('Error loading registered invitations:', err);
	}

	// Load pending invitations
	let pendingInvitations: any[] = [];
	let pendingPagination = {
		page: 1,
		pageSize: 20,
		totalCount: 0,
		totalPages: 0,
		hasNext: false,
		hasPrev: false
	};

	try {
		const response = await eventadminListPendingInvitations({
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
			const totalPages = Math.ceil(totalCount / (activeTab === 'invitations' ? pageSize : 20));
			pendingPagination = {
				page: activeTab === 'invitations' ? page : 1,
				pageSize: activeTab === 'invitations' ? pageSize : 20,
				totalCount,
				totalPages,
				hasNext: (activeTab === 'invitations' ? page : 1) < totalPages,
				hasPrev: (activeTab === 'invitations' ? page : 1) > 1
			};
		}
	} catch (err) {
		console.error('Error loading pending invitations:', err);
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
			const response = await eventadminApproveInvitationRequest({
				fetch,
				path: { event_id: params.event_id, request_id: requestId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				return fail(500, { errors: { form: 'Failed to approve request' } });
			}

			return { success: true, action: 'approved' };
		} catch (err) {
			console.error('Error approving invitation request:', err);
			return fail(500, { errors: { form: 'An unexpected error occurred' } });
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
			const response = await eventadminRejectInvitationRequest({
				fetch,
				path: { event_id: params.event_id, request_id: requestId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				return fail(500, { errors: { form: 'Failed to reject request' } });
			}

			return { success: true, action: 'rejected' };
		} catch (err) {
			console.error('Error rejecting invitation request:', err);
			return fail(500, { errors: { form: 'An unexpected error occurred' } });
		}
	},

	// Create invitations
	createInvitations: async ({ request, params, cookies, fetch }) => {
		const accessToken = cookies.get('access_token');
		if (!accessToken) {
			return fail(401, { errors: { form: 'You must be logged in' } });
		}

		const formData = await request.formData();
		const emailsRaw = formData.get('emails') as string;
		const tierId = formData.get('tier_id') as string;
		const customMessage = formData.get('custom_message') as string;
		const waivesQuestionnaire = formData.get('waives_questionnaire') === 'true';
		const waivesPurchase = formData.get('waives_purchase') === 'true';
		const waivesMembershipRequired = formData.get('waives_membership_required') === 'true';
		const waivesRsvpDeadline = formData.get('waives_rsvp_deadline') === 'true';
		const overridesMaxAttendees = formData.get('overrides_max_attendees') === 'true';

		if (!emailsRaw) {
			return fail(400, { errors: { form: 'Emails are required' } });
		}

		// Validate that tier is provided if waiving purchase
		if (waivesPurchase && !tierId) {
			return fail(400, {
				errors: { form: 'Tier is required when waiving purchase requirement' }
			});
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
			const response = await eventadminCreateInvitations({
				fetch,
				path: { event_id: params.event_id },
				body: {
					emails,
					tier_id: tierId || undefined,
					custom_message: customMessage || undefined,
					send_notification: true,
					waives_questionnaire: waivesQuestionnaire,
					waives_purchase: waivesPurchase,
					overrides_max_attendees: overridesMaxAttendees,
					waives_membership_required: waivesMembershipRequired,
					waives_rsvp_deadline: waivesRsvpDeadline
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				const errorMessage =
					typeof response.error === 'object' && response.error && 'detail' in response.error
						? String(response.error.detail)
						: 'Failed to create invitations';
				return fail(500, { errors: { form: errorMessage } });
			}

			return { success: true, action: 'created', data: response.data };
		} catch (err) {
			console.error('Error creating invitations:', err);
			return fail(500, { errors: { form: 'An unexpected error occurred' } });
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
			const response = await eventadminDeleteInvitation({
				fetch,
				path: {
					event_id: params.event_id,
					invitation_type: invitationType,
					invitation_id: invitationId
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				return fail(500, { errors: { form: 'Failed to delete invitation' } });
			}

			return { success: true, action: 'deleted' };
		} catch (err) {
			console.error('Error deleting invitation:', err);
			return fail(500, { errors: { form: 'An unexpected error occurred' } });
		}
	},

	// Update invitation (uses update_or_create endpoint)
	updateInvitation: async ({ request, params, cookies, fetch }) => {
		const accessToken = cookies.get('access_token');
		if (!accessToken) {
			return fail(401, { errors: { form: 'You must be logged in' } });
		}

		const formData = await request.formData();
		const email = formData.get('email') as string;
		const tierId = formData.get('tier_id') as string;
		const customMessage = formData.get('custom_message') as string;
		const waivesQuestionnaire = formData.get('waives_questionnaire') === 'true';
		const waivesPurchase = formData.get('waives_purchase') === 'true';
		const waivesMembershipRequired = formData.get('waives_membership_required') === 'true';
		const waivesRsvpDeadline = formData.get('waives_rsvp_deadline') === 'true';
		const overridesMaxAttendees = formData.get('overrides_max_attendees') === 'true';

		if (!email) {
			return fail(400, { errors: { form: 'Email is required' } });
		}

		// Validate that tier is provided if waiving purchase
		if (waivesPurchase && !tierId) {
			return fail(400, {
				errors: { form: 'Tier is required when waiving purchase requirement' }
			});
		}

		try {
			const response = await eventadminCreateInvitations({
				fetch,
				path: { event_id: params.event_id },
				body: {
					emails: [email],
					tier_id: tierId || undefined,
					custom_message: customMessage || undefined,
					send_notification: false,
					waives_questionnaire: waivesQuestionnaire,
					waives_purchase: waivesPurchase,
					overrides_max_attendees: overridesMaxAttendees,
					waives_membership_required: waivesMembershipRequired,
					waives_rsvp_deadline: waivesRsvpDeadline
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				const errorMessage =
					typeof response.error === 'object' && response.error && 'detail' in response.error
						? String(response.error.detail)
						: 'Failed to update invitation';
				return fail(500, { errors: { form: errorMessage } });
			}

			return { success: true, action: 'updated' };
		} catch (err) {
			console.error('Error updating invitation:', err);
			return fail(500, { errors: { form: 'An unexpected error occurred' } });
		}
	},

	// Bulk update invitations
	bulkUpdateInvitations: async ({ request, params, cookies, fetch }) => {
		const accessToken = cookies.get('access_token');
		if (!accessToken) {
			return fail(401, { errors: { form: 'You must be logged in' } });
		}

		const formData = await request.formData();
		const emailsRaw = formData.get('emails') as string;
		const tierId = formData.get('tier_id') as string;
		const customMessage = formData.get('custom_message') as string;
		const waivesQuestionnaire = formData.get('waives_questionnaire') === 'true';
		const waivesPurchase = formData.get('waives_purchase') === 'true';
		const waivesMembershipRequired = formData.get('waives_membership_required') === 'true';
		const waivesRsvpDeadline = formData.get('waives_rsvp_deadline') === 'true';
		const overridesMaxAttendees = formData.get('overrides_max_attendees') === 'true';

		if (!emailsRaw) {
			return fail(400, { errors: { form: 'Emails are required' } });
		}

		// Validate that tier is provided if waiving purchase
		if (waivesPurchase && !tierId) {
			return fail(400, {
				errors: { form: 'Tier is required when waiving purchase requirement' }
			});
		}

		// Parse emails
		const emails = JSON.parse(emailsRaw) as string[];

		if (emails.length === 0) {
			return fail(400, { errors: { form: 'At least one email is required' } });
		}

		try {
			const response = await eventadminCreateInvitations({
				fetch,
				path: { event_id: params.event_id },
				body: {
					emails,
					tier_id: tierId || undefined,
					custom_message: customMessage || undefined,
					send_notification: false,
					waives_questionnaire: waivesQuestionnaire,
					waives_purchase: waivesPurchase,
					overrides_max_attendees: overridesMaxAttendees,
					waives_membership_required: waivesMembershipRequired,
					waives_rsvp_deadline: waivesRsvpDeadline
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				const errorMessage =
					typeof response.error === 'object' && response.error && 'detail' in response.error
						? String(response.error.detail)
						: 'Failed to update invitations';
				return fail(500, { errors: { form: errorMessage } });
			}

			return { success: true, action: 'bulk_updated', count: emails.length };
		} catch (err) {
			console.error('Error bulk updating invitations:', err);
			return fail(500, { errors: { form: 'An unexpected error occurred' } });
		}
	}
};
