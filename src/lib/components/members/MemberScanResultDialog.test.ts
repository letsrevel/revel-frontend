import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MemberScanResultDialog from './MemberScanResultDialog.svelte';
import type { MemberScanResponseSchema } from '$lib/api/generated/types.gen';

const USER = {
	preferred_name: 'Bella Distefano',
	pronouns: 'they/them',
	first_name: 'Bella',
	last_name: 'Distefano',
	email: 'bella@example.com',
	display_name: 'Bella Distefano',
	bio: '',
	profile_picture_thumbnail_url: null,
	profile_picture_url: null,
	profile_picture_preview_url: null
};

function report(overrides: Partial<MemberScanResponseSchema> = {}): MemberScanResponseSchema {
	return {
		kind: 'member',
		member: {
			member_id: '3f1b8b9a-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
			status: 'active',
			member_since: '2025-03-14T10:00:00Z',
			tier: null,
			user: USER
		},
		tickets: [],
		detail: 'This member has no ticket for this event.',
		...overrides
	};
}

const TICKETS = [
	{ id: 'ticket-active', tier_name: 'General Admission', status: 'active' as const },
	{ id: 'ticket-done', tier_name: 'VIP', status: 'checked_in' as const }
];

describe('MemberScanResultDialog', () => {
	it('stays closed when there is no report', () => {
		render(MemberScanResultDialog, {
			props: { report: null, onCheckInTicket: vi.fn(), onClose: vi.fn() }
		});
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('identifies the member', () => {
		render(MemberScanResultDialog, {
			props: { report: report(), onCheckInTicket: vi.fn(), onClose: vi.fn() }
		});
		expect(screen.getByText('Bella Distefano')).toBeInTheDocument();
	});

	/**
	 * The backend's `detail` is the only thing that knows WHY nothing was checked
	 * in. Reconstructing it client-side from `tickets.length` would drift the
	 * moment that rule changes, so the string is rendered verbatim.
	 */
	it('renders the backend detail string verbatim', () => {
		render(MemberScanResultDialog, {
			props: {
				report: report({ detail: 'Several tickets — scan the ticket QR instead.' }),
				onCheckInTicket: vi.fn(),
				onClose: vi.fn()
			}
		});
		expect(screen.getByText('Several tickets — scan the ticket QR instead.')).toBeInTheDocument();
	});

	it('lists no ticket section when the member holds none for this event', () => {
		render(MemberScanResultDialog, {
			props: { report: report(), onCheckInTicket: vi.fn(), onClose: vi.fn() }
		});
		expect(screen.queryByText('Tickets for this event')).not.toBeInTheDocument();
	});

	it('lists every ticket the member holds', () => {
		render(MemberScanResultDialog, {
			props: { report: report({ tickets: TICKETS }), onCheckInTicket: vi.fn(), onClose: vi.fn() }
		});
		expect(screen.getByText('General Admission')).toBeInTheDocument();
		expect(screen.getByText('VIP')).toBeInTheDocument();
	});

	it('checks in the specific ticket the organizer picked', async () => {
		const onCheckInTicket = vi.fn();
		const user = userEvent.setup();
		render(MemberScanResultDialog, {
			props: { report: report({ tickets: TICKETS }), onCheckInTicket, onClose: vi.fn() }
		});

		await user.click(screen.getByRole('button', { name: 'Check in' }));

		expect(onCheckInTicket).toHaveBeenCalledExactlyOnceWith('ticket-active');
	});

	/**
	 * An already-checked-in ticket would only earn a 400. Showing its status and
	 * no button says that without a round trip.
	 */
	it('offers no check-in button for an already-checked-in ticket', () => {
		render(MemberScanResultDialog, {
			props: { report: report({ tickets: TICKETS }), onCheckInTicket: vi.fn(), onClose: vi.fn() }
		});
		expect(screen.getAllByRole('button', { name: 'Check in' })).toHaveLength(1);
	});

	it('offers a check-in button for a pending ticket (payment may be taken at the door)', () => {
		render(MemberScanResultDialog, {
			props: {
				report: report({
					tickets: [{ id: 'ticket-pending', tier_name: 'Door', status: 'pending' }]
				}),
				onCheckInTicket: vi.fn(),
				onClose: vi.fn()
			}
		});
		expect(screen.getByRole('button', { name: 'Check in' })).toBeInTheDocument();
	});

	it('disables every row while one is in flight', () => {
		render(MemberScanResultDialog, {
			props: {
				report: report({
					tickets: [
						{ id: 'a', tier_name: 'One', status: 'active' },
						{ id: 'b', tier_name: 'Two', status: 'active' }
					]
				}),
				pendingTicketId: 'a',
				onCheckInTicket: vi.fn(),
				onClose: vi.fn()
			}
		});
		const buttons = screen.getAllByRole('button', { name: 'Check in' });
		expect(buttons).toHaveLength(2);
		for (const button of buttons) expect(button).toBeDisabled();
	});

	it('falls back to a generic label for a ticket with no tier name', () => {
		render(MemberScanResultDialog, {
			props: {
				report: report({ tickets: [{ id: 'x', tier_name: null, status: 'active' }] }),
				onCheckInTicket: vi.fn(),
				onClose: vi.fn()
			}
		});
		expect(screen.getByText('Ticket')).toBeInTheDocument();
	});
});
