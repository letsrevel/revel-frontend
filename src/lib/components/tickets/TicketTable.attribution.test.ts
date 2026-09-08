import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import TicketTable from './TicketTable.svelte';
import type { AdminTicketSchema } from '$lib/api/generated/types.gen';

/**
 * Attribution line on admin ticket rows (#880 follow-up). Only the two
 * per-row bits this suite cares about are exercised in depth (user + tier);
 * every other field is filled with the minimum the row renderer touches.
 */
function ticket(overrides: Partial<AdminTicketSchema> = {}): AdminTicketSchema {
	return {
		user: { id: 'u1', email: 'alice@example.com', first_name: 'Alice', last_name: 'Anderson' },
		tier: { name: 'General', payment_method: 'free', currency: 'EUR' },
		guest_name: '',
		created_at: '2026-01-01T00:00:00Z',
		status: 'active',
		...overrides
	} as AdminTicketSchema;
}

const noop = vi.fn();

function renderTable(tickets: AdminTicketSchema[]) {
	return render(TicketTable, {
		props: {
			tickets,
			checkInPending: false,
			confirmPaymentPending: false,
			cancelTicketPending: false,
			addMemberPending: false,
			unconfirmPaymentPending: false,
			tiersLoading: false,
			onCheckIn: noop,
			onConfirmPayment: noop,
			onMakeMember: noop,
			onCancelTicket: noop,
			onBlacklist: noop,
			onUnconfirmPayment: noop
		}
	});
}

describe('TicketTable attribution line', () => {
	it('renders "source · campaign" when both are present', () => {
		renderTable([ticket({ attribution: { utm_source: 'instagram', utm_campaign: 'launch' } })]);
		expect(screen.getByText('instagram · launch')).toBeInTheDocument();
	});

	it('falls back to "medium · content" when neither source nor campaign is present', () => {
		renderTable([ticket({ attribution: { utm_medium: 'social', utm_content: 'story' } })]);
		expect(screen.getByText('social · story')).toBeInTheDocument();
	});

	it('renders nothing extra when the ticket has no attribution', () => {
		renderTable([ticket({ attribution: null })]);
		expect(screen.queryByText(/·/)).not.toBeInTheDocument();
	});
});
