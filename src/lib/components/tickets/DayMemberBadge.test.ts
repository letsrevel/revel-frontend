import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DayMemberBadge from './DayMemberBadge.svelte';
import TicketTable from './TicketTable.svelte';
import TicketCardList from './TicketCardList.svelte';
import { formatDate } from '$lib/utils/date';
import { dayMemberBadgeState } from './day-member-badge';
import type { AdminTicketSchema, TicketMembershipRecordSchema } from '$lib/api/generated/types.gen';

const VALID_UNTIL = '2099-12-01T23:00:00Z';

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

const NOW = new Date('2026-11-01T12:00:00Z');

describe('dayMemberBadgeState', () => {
	it('is live for a future or null valid_until with no ended_reason', () => {
		expect(dayMemberBadgeState(record(), NOW)).toBe('live');
		expect(dayMemberBadgeState(record({ valid_until: null }), NOW)).toBe('live');
	});

	it.each(['cancelled', 'expelled', 'removed', 'tier_changed'] as const)(
		'is ended for ended_reason %s',
		(reason) => {
			expect(dayMemberBadgeState(record({ ended_reason: reason }), NOW)).toBe('ended');
		}
	);

	it('is ended for a past valid_until', () => {
		expect(dayMemberBadgeState(record({ valid_until: '2026-10-01T00:00:00Z' }), NOW)).toBe('ended');
	});

	it('is hidden for revoked (even when past), standard, null and undefined', () => {
		expect(
			dayMemberBadgeState(
				record({ ended_reason: 'revoked', valid_until: '2026-10-01T00:00:00Z' }),
				NOW
			)
		).toBe('hidden');
		expect(dayMemberBadgeState(record({ kind: 'standard' }), NOW)).toBe('hidden');
		expect(dayMemberBadgeState(null, NOW)).toBe('hidden');
		expect(dayMemberBadgeState(undefined, NOW)).toBe('hidden');
	});
});

describe('DayMemberBadge', () => {
	it('shows the live badge with a visible end date', () => {
		render(DayMemberBadge, { props: { record: record(), now: NOW } });
		expect(screen.getByTestId('day-member-badge')).toHaveTextContent('Day member');
		expect(screen.getByTestId('day-member-until')).toHaveTextContent(
			`until ${formatDate(VALID_UNTIL)}`
		);
	});

	it('shows no date line when valid_until is null', () => {
		render(DayMemberBadge, { props: { record: record({ valid_until: null }), now: NOW } });
		expect(screen.getByTestId('day-member-badge')).toBeInTheDocument();
		expect(screen.queryByTestId('day-member-until')).not.toBeInTheDocument();
	});

	it('shows the ended badge for an ended record', () => {
		render(DayMemberBadge, { props: { record: record({ ended_reason: 'cancelled' }), now: NOW } });
		expect(screen.getByTestId('day-member-badge-ended')).toHaveTextContent('Day membership ended');
		expect(screen.queryByTestId('day-member-badge')).not.toBeInTheDocument();
	});

	it('shows the ended badge for a past valid_until', () => {
		render(DayMemberBadge, {
			props: { record: record({ valid_until: '2026-10-01T00:00:00Z' }), now: NOW }
		});
		expect(screen.getByTestId('day-member-badge-ended')).toBeInTheDocument();
	});

	it('renders nothing for revoked, standard, null and undefined', () => {
		for (const r of [
			record({ ended_reason: 'revoked' }),
			record({ kind: 'standard' }),
			null,
			undefined
		]) {
			const { container, unmount } = render(DayMemberBadge, { props: { record: r, now: NOW } });
			expect(container.querySelector('[data-testid^="day-member-badge"]')).toBeNull();
			unmount();
		}
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
