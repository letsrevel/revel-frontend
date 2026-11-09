import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import RegisterTable from './RegisterTable.svelte';
import PersonStatusCell from './PersonStatusCell.svelte';
import { makeRecord, makeUnlinked } from './person-fixtures';

describe('PersonStatusCell', () => {
	it('shows Paused for a paused member and Active otherwise', () => {
		const { unmount } = render(PersonStatusCell, {
			props: { record: makeRecord({ member_status: 'paused' }) }
		});
		expect(screen.getByTestId('register-status-paused')).toHaveTextContent('Paused');
		unmount();
		render(PersonStatusCell, { props: { record: makeRecord() } });
		expect(screen.getByTestId('register-status-active')).toHaveTextContent('Active');
	});

	it('trusts is_current: a non-current entry reads Ended', () => {
		render(PersonStatusCell, {
			props: { record: makeRecord({ is_current: false, member_status: null }) }
		});
		expect(screen.getByTestId('register-status-ended')).toBeInTheDocument();
	});

	it('marks a row with a staff note, with text for assistive tech', () => {
		render(PersonStatusCell, { props: { record: makeRecord({ has_note: true }) } });
		const marker = screen.getByTestId('register-note-marker');
		expect(marker).toHaveTextContent('Has a staff note');
	});

	it('has no note marker without a note', () => {
		render(PersonStatusCell, { props: { record: makeRecord({ has_note: false }) } });
		expect(screen.queryByTestId('register-note-marker')).not.toBeInTheDocument();
	});

	it('shows the subscription compactly: renews, ends, or the plain status', () => {
		const sub = (extra: object) => ({
			status: 'active' as const,
			plan_name: 'Annual',
			current_period_end: '2026-12-01T12:00:00Z',
			cancel_at_period_end: false,
			...extra
		});
		const cases: [object, RegExp][] = [
			[{}, /^Subscribed · renews Dec 1, 2026$/],
			[{ cancel_at_period_end: true }, /^Subscription ends Dec 1, 2026$/],
			[{ status: 'past_due' }, /past due/i],
			[{ current_period_end: null }, /^Subscribed$/]
		];
		for (const [extra, expected] of cases) {
			const { unmount } = render(PersonStatusCell, {
				props: { record: makeRecord({ subscription: sub(extra) }) }
			});
			expect(screen.getByTestId('register-subscription-line').textContent?.trim()).toMatch(
				expected
			);
			unmount();
		}
	});

	it('shows no subscription line for an unlinked entry', () => {
		render(PersonStatusCell, { props: { record: makeUnlinked() } });
		expect(screen.queryByTestId('register-subscription-line')).not.toBeInTheDocument();
	});
});

describe('RegisterTable rows', () => {
	const props = (onOpen = vi.fn()) => ({
		records: [makeRecord(), makeUnlinked()],
		isOwner: true,
		onEdit: vi.fn(),
		onEnd: vi.fn(),
		onDelete: vi.fn(),
		onInvite: vi.fn(),
		onUnlink: vi.fn(),
		onOpen
	});

	it('opens a person from a button named after them, by click or keyboard', async () => {
		const onOpen = vi.fn();
		render(RegisterTable, { props: props(onOpen) });
		const table = screen.getByTestId('register-table');
		const button = within(table).getByRole('button', { name: 'Open Ada Rossi' });
		button.focus();
		await userEvent.keyboard('{Enter}');
		expect(onOpen).toHaveBeenCalledTimes(1);
		expect(onOpen.mock.calls[0][0].id).toBe('r1');
		await userEvent.click(within(table).getByRole('button', { name: 'Open Bruno Verdi' }));
		expect(onOpen.mock.calls[1][0].id).toBe('r2');
	});

	it('opens on a click anywhere on the row, but not from the actions menu', async () => {
		const onOpen = vi.fn();
		render(RegisterTable, { props: props(onOpen) });
		const rows = screen.getAllByTestId('register-row');
		await userEvent.click(within(rows[0]).getByText('ada@example.org'));
		expect(onOpen).toHaveBeenCalledTimes(1);
		await userEvent.click(within(rows[0]).getByTestId('register-row-actions'));
		expect(onOpen).toHaveBeenCalledTimes(1);
	});
});
