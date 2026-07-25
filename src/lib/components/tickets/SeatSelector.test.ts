import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import SeatSelector from './SeatSelector.svelte';
import type { SeatView } from './seating-view';

// SeatSelector is a pure props component (the hold round-trips live in
// SeatHoldController), so no sdk mock is needed. Real compiled paraglide
// messages back the accessible-name assertions.

function seat(id: string, overrides: Partial<SeatView> = {}): SeatView {
	return {
		id,
		label: id.toUpperCase(),
		rowLabel: id[0]?.toUpperCase() ?? '?',
		rowOrder: 0,
		number: null,
		adjacencyIndex: 0,
		isAccessible: false,
		isObstructedView: false,
		status: 'available',
		...overrides
	};
}

function renderSelector(
	seats: SeatView[],
	props: { onToggle?: (id: string) => void; maxReached?: boolean; disabled?: boolean } = {}
) {
	const onToggle = props.onToggle ?? vi.fn();
	render(SeatSelector, { props: { seats, onToggle, ...props } });
	return onToggle;
}

describe('SeatSelector', () => {
	describe('row grouping', () => {
		it('renders seats grouped into rows sorted by rowOrder, seats by adjacencyIndex', () => {
			// Shuffled input: rendering order must come from rowOrder/adjacencyIndex.
			renderSelector([
				seat('b2', { rowLabel: 'B', rowOrder: 1, adjacencyIndex: 1 }),
				seat('a2', { rowLabel: 'A', rowOrder: 0, adjacencyIndex: 1 }),
				seat('b1', { rowLabel: 'B', rowOrder: 1, adjacencyIndex: 0 }),
				seat('a1', { rowLabel: 'A', rowOrder: 0, adjacencyIndex: 0 })
			]);

			const names = screen
				.getAllByRole('button')
				.map((button) => button.getAttribute('aria-label'));
			expect(names).toEqual(['Seat A1', 'Seat A2', 'Seat B1', 'Seat B2']);
		});

		it('renders a visible row label per row', () => {
			renderSelector([
				seat('a1', { rowLabel: 'A', rowOrder: 0 }),
				seat('b1', { rowLabel: 'B', rowOrder: 1 })
			]);
			expect(screen.getByText('A', { exact: true })).toBeInTheDocument();
			expect(screen.getByText('B', { exact: true })).toBeInTheDocument();
		});
	});

	describe('status rendering', () => {
		it('renders my held seat as pressed and enabled', () => {
			renderSelector([seat('a1', { status: 'mine' })]);
			const button = screen.getByRole('button', { name: 'Seat A1' });
			expect(button).toHaveAttribute('aria-pressed', 'true');
			expect(button).toBeEnabled();
		});

		it('renders an available seat as unpressed and enabled', () => {
			renderSelector([seat('a1')]);
			const button = screen.getByRole('button', { name: 'Seat A1' });
			expect(button).toHaveAttribute('aria-pressed', 'false');
			expect(button).toBeEnabled();
		});

		it('renders sold, held and blocked seats disabled with distinct accessible names', () => {
			renderSelector([
				seat('a1', { status: 'sold' }),
				seat('a2', { status: 'held', adjacencyIndex: 1 }),
				seat('a3', { status: 'blocked', adjacencyIndex: 2 })
			]);
			expect(screen.getByRole('button', { name: 'Seat A1, sold' })).toBeDisabled();
			expect(screen.getByRole('button', { name: 'Seat A2, held by someone else' })).toBeDisabled();
			expect(screen.getByRole('button', { name: 'Seat A3, unavailable' })).toBeDisabled();
		});

		it('renders a pending seat as busy and aria-disabled but keeps it focusable', () => {
			renderSelector([seat('a1', { status: 'pending' })]);
			const button = screen.getByRole('button', { name: 'Seat A1, updating' });
			expect(button).toHaveAttribute('aria-busy', 'true');
			expect(button).toHaveAttribute('aria-disabled', 'true');
			// No disabled attribute: it would blur the just-activated button and
			// drop keyboard focus to <body> on every selection.
			expect(button).toBeEnabled();
			button.focus();
			expect(button).toHaveFocus();
		});

		it('appends accessible and obstructed-view fragments to the accessible name', () => {
			renderSelector([
				seat('a1', { isAccessible: true }),
				seat('a2', { isObstructedView: true, adjacencyIndex: 1 }),
				seat('a3', {
					isAccessible: true,
					isObstructedView: true,
					status: 'sold',
					adjacencyIndex: 2
				})
			]);
			expect(screen.getByRole('button', { name: 'Seat A1, accessible' })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Seat A2, obstructed view' })).toBeInTheDocument();
			// Status comes last, after the seat attributes.
			expect(
				screen.getByRole('button', { name: 'Seat A3, accessible, obstructed view, sold' })
			).toBeInTheDocument();
		});

		it('shows the 10-minute hold notice only when the caller holds a seat', () => {
			const notice = 'Selected seats are held for you for 10 minutes.';
			const { unmount } = render(SeatSelector, {
				props: { seats: [seat('a1')], onToggle: vi.fn() }
			});
			expect(screen.queryByText(notice)).not.toBeInTheDocument();
			unmount();

			renderSelector([seat('a1', { status: 'mine' })]);
			expect(screen.getByRole('status')).toHaveTextContent(notice);
		});
	});

	describe('onToggle', () => {
		it('fires for an available seat', async () => {
			const onToggle = renderSelector([seat('a1')]);
			await fireEvent.click(screen.getByRole('button', { name: 'Seat A1' }));
			expect(onToggle).toHaveBeenCalledExactlyOnceWith('a1');
		});

		it('fires for my held seat (deselect)', async () => {
			const onToggle = renderSelector([seat('a1', { status: 'mine' })]);
			await fireEvent.click(screen.getByRole('button', { name: 'Seat A1' }));
			expect(onToggle).toHaveBeenCalledExactlyOnceWith('a1');
		});

		it('never fires for sold, held, blocked or pending seats', async () => {
			const onToggle = renderSelector([
				seat('a1', { status: 'sold' }),
				seat('a2', { status: 'held', adjacencyIndex: 1 }),
				seat('a3', { status: 'blocked', adjacencyIndex: 2 }),
				seat('a4', { status: 'pending', adjacencyIndex: 3 })
			]);
			for (const button of screen.getAllByRole('button')) {
				await fireEvent.click(button);
			}
			expect(onToggle).not.toHaveBeenCalled();
		});

		it('disables available seats (but not mine) when maxReached', async () => {
			const onToggle = renderSelector(
				[seat('a1', { status: 'mine' }), seat('a2', { adjacencyIndex: 1 })],
				{ maxReached: true }
			);
			expect(screen.getByRole('button', { name: 'Seat A2' })).toBeDisabled();
			const mine = screen.getByRole('button', { name: 'Seat A1' });
			expect(mine).toBeEnabled();
			await fireEvent.click(mine);
			expect(onToggle).toHaveBeenCalledExactlyOnceWith('a1');
		});

		it('disables every seat when the grid is disabled', () => {
			renderSelector([seat('a1', { status: 'mine' }), seat('a2', { adjacencyIndex: 1 })], {
				disabled: true
			});
			for (const button of screen.getAllByRole('button')) {
				expect(button).toBeDisabled();
			}
		});
	});
});
