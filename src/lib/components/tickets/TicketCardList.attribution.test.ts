import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import TicketCardList from './TicketCardList.svelte';
import type { AdminTicketSchema } from '$lib/api/generated/types.gen';

/**
 * Attribution line on the mobile ticket cards (#880 follow-up), mirroring
 * TicketTable.attribution.test.ts for the desktop table.
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

function renderCards(tickets: AdminTicketSchema[]) {
	return render(TicketCardList, {
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

describe('TicketCardList attribution line', () => {
	it('renders "source · campaign" when both are present', () => {
		renderCards([ticket({ attribution: { utm_source: 'instagram', utm_campaign: 'launch' } })]);
		expect(screen.getByText('instagram · launch')).toBeInTheDocument();
	});

	it('falls back to "medium · content" when neither source nor campaign is present', () => {
		renderCards([ticket({ attribution: { utm_medium: 'social', utm_content: 'story' } })]);
		expect(screen.getByText('social · story')).toBeInTheDocument();
	});

	it('renders nothing extra when the ticket has no attribution', () => {
		renderCards([ticket({ attribution: undefined })]);
		expect(screen.queryByText(/·/)).not.toBeInTheDocument();
	});
});
