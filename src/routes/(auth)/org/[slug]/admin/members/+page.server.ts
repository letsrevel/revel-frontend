import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { canPerformAction } from '$lib/utils/permissions';
import { legacyTabRedirect } from '$lib/member-register/redirects';

export const load: PageServerLoad = async ({ parent, url }) => {
	// Tabs were renamed when the Members area was unified (members -> people,
	// requests -> applications, tokens -> invite-links). Only `tab` is read on the
	// common path, so in-page filter navigation does not re-run this load.
	if (url.searchParams.get('tab')) {
		const query = legacyTabRedirect(url.searchParams);
		if (query) throw redirect(301, `${url.pathname}?${query}`);
	}

	// Get organization data and permissions from parent layout
	const { organization, isOwner, isStaff, permissions } = await parent();

	const canManageMembers =
		isOwner || canPerformAction(permissions, organization.id, 'manage_members');
	const canManageSubscriptions =
		isOwner || canPerformAction(permissions, organization.id, 'manage_subscriptions');
	// Door verification is gated on `check_in_attendees`, NOT `manage_members`:
	// reading a membership card at a door is not editing the roster, and the
	// backend's verify endpoint draws the line in the same place.
	const canVerifyMembers =
		isOwner || canPerformAction(permissions, organization.id, 'check_in_attendees');

	// `manage_subscriptions` is a standalone role: a billing staffer who cannot
	// touch the roster still needs this page for the Subscriptions tab. Each tab
	// is gated on its own flag below.
	if (!canManageMembers && !canManageSubscriptions) {
		throw error(403, 'You do not have permission to manage members');
	}

	return {
		organization,
		isOwner,
		isStaff,
		permissions,
		canManageMembers,
		canManageSubscriptions,
		canVerifyMembers
	};
};
