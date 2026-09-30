import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/logger', () => ({
	log: { debug: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() }
}));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventadmininvitationsCreateInvitations: vi.fn(),
	eventadmininvitationsDeleteInvitationEndpoint: vi.fn(),
	eventadmininvitationsListInvitations: vi.fn(),
	eventadmininvitationsListPendingInvitations: vi.fn(),
	eventadminGetEvent: vi.fn(),
	eventadminticketsListTicketTiers: vi.fn()
}));

import { actions } from './+page.server';
import { eventadmininvitationsCreateInvitations } from '$lib/api/generated/sdk.gen';

const CAP_DETAIL = 'This would exceed your organization’s daily limit of invitations.';

function event(fields: Record<string, string>) {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) body.set(k, v);
	return {
		request: new Request('http://localhost/x', { method: 'POST', body }),
		params: { slug: 'acme', event_id: 'ev-1' },
		cookies: { get: () => 'tok' },
		fetch
	} as unknown as Parameters<NonNullable<typeof actions.createInvitations>>[0];
}

// Backend #1035: the daily budget of invitations to non-users is a 400 with a
// translated `detail`; the organizer must see it verbatim (#987).
describe('invitation actions surface the invitation-cap 400 verbatim', () => {
	beforeEach(() => {
		vi.mocked(eventadmininvitationsCreateInvitations).mockResolvedValue({
			data: undefined,
			error: { detail: CAP_DETAIL },
			response: { status: 400 }
		} as never);
	});

	it('createInvitations', async () => {
		const result = await actions.createInvitations(
			event({ emails: 'a@example.com\nb@example.com' })
		);
		expect(result).toMatchObject({ status: 400, data: { errors: { form: CAP_DETAIL } } });
	});

	it('bulkUpdateInvitations', async () => {
		const result = await actions.bulkUpdateInvitations(
			event({ emails: JSON.stringify(['a@example.com']) })
		);
		expect(result).toMatchObject({ status: 400, data: { errors: { form: CAP_DETAIL } } });
	});

	it('updateInvitation', async () => {
		const result = await actions.updateInvitation(event({ email: 'a@example.com' }));
		expect(result).toMatchObject({ status: 400, data: { errors: { form: CAP_DETAIL } } });
	});
});
