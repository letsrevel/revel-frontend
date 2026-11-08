import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DayMemberBadge from './DayMemberBadge.svelte';
import TicketTable from './TicketTable.svelte';
import TicketCardList from './TicketCardList.svelte';
import { formatDateTime } from '$lib/utils/date';
import type { AdminTicketSchema, TicketMembershipRecordSchema } from '$lib/api/generated/types.gen';

const VALID_UNTIL = '2026-12-01T23:00:00Z';

function record(
	overrides: Partial<TicketMembershipRecordSchema> = {}
): TicketMembershipRecordSchema {
	return {
		id: 'r1',
		kind: 'temporary',
		tier_name: 'Day pass',
		valid_until: VALID_UNTIL,
		ended_reason: null,
		...overrides
	};
}

function ticket(overrides: Partial<AdminTicketSchema> = {}): AdminTicketSchema {
	return {
		id: 't1',
		user: { id: 'u1', email: 'alice@example.com', first_name: 'Alice', last_name: 'Anderson' },
		tier: { name: 'General', payment_method: 'free', currency: 'EUR' },
		guest_name: '',
		created_at: '2026-01-01T00:00:00Z',
		status: 'active',
		...overrides
	} as AdminTicketSchema;
}

const noop = vi.fn();
const listProps = {
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
};

describe('DayMemberBadge', () => {
	it('shows for a temporary record, with the date in the screen-reader label', () => {
		render(DayMemberBadge, { props: { record: record() } });
		const badge = screen.getByTestId('day-member-badge');
		expect(badge).toHaveTextContent('Day member');
		expect(badge).toHaveTextContent(`Day member until ${formatDateTime(VALID_UNTIL)}`);
	});

	it('shows without a date when valid_until is null', () => {
		render(DayMemberBadge, { props: { record: record({ valid_until: null }) } });
		expect(screen.getByTestId('day-member-badge')).toHaveTextContent('Day member');
		expect(screen.getByTestId('day-member-badge').textContent).not.toContain('until');
	});

	it('shows for an ended (non-revoked) record', () => {
		render(DayMemberBadge, { props: { record: record({ ended_reason: 'expired' as never }) } });
		expect(screen.getByTestId('day-member-badge')).toBeInTheDocument();
	});

	it('is hidden for a revoked record', () => {
		render(DayMemberBadge, { props: { record: record({ ended_reason: 'revoked' }) } });
		expect(screen.queryByTestId('day-member-badge')).not.toBeInTheDocument();
	});

	it('is hidden for a standard record', () => {
		render(DayMemberBadge, { props: { record: record({ kind: 'standard' }) } });
		expect(screen.queryByTestId('day-member-badge')).not.toBeInTheDocument();
	});

	it('is hidden for null and undefined', () => {
		render(DayMemberBadge, { props: { record: null } });
		render(DayMemberBadge, { props: { record: undefined } });
		expect(screen.queryByTestId('day-member-badge')).not.toBeInTheDocument();
	});
});

describe.each([
	['TicketTable', TicketTable],
	['TicketCardList', TicketCardList]
])('%s day-member badge', (_name, Component) => {
	it('renders only on rows with a live temporary record', () => {
		render(Component, {
			props: {
				...listProps,
				tickets: [
					ticket({ id: 'a', membership_record: record() }),
					ticket({ id: 'b', membership_record: record({ ended_reason: 'revoked' }) }),
					ticket({ id: 'c', membership_record: null }),
					ticket({ id: 'd' })
				]
			}
		});
		expect(screen.getAllByTestId('day-member-badge')).toHaveLength(1);
	});
});
