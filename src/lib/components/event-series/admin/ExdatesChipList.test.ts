import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ExdatesChipList from './ExdatesChipList.svelte';

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

describe('ExdatesChipList', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const baseProps = {
		organizationSlug: 'revels',
		seriesId: 'ser_abc123',
		exdates: [] as string[]
	};

	it('renders the heading even when exdates is empty', () => {
		render(ExdatesChipList, { props: baseProps });
		expect(screen.getByTestId('exdates-list')).toBeInTheDocument();
	});

	it('shows the empty-state copy when no exdates', () => {
		const { container } = render(ExdatesChipList, { props: baseProps });
		// Empty-state paragraph renders via recurringEvents.exdates.empty key.
		const list = container.querySelector('ul');
		expect(list).toBeNull();
	});

	it('renders one chip per parseable ISO date', () => {
		render(ExdatesChipList, {
			props: {
				...baseProps,
				exdates: ['2026-05-01T18:00:00Z', '2026-05-08T18:00:00Z', '2026-05-15T18:00:00Z']
			}
		});
		const chips = screen.getAllByRole('listitem');
		expect(chips).toHaveLength(3);
	});

	it('filters out invalid ISO entries via parseExdates', () => {
		render(ExdatesChipList, {
			props: {
				...baseProps,
				exdates: ['2026-05-01T18:00:00Z', 'not-a-date', '2026-05-15T18:00:00Z']
			}
		});
		const chips = screen.getAllByRole('listitem');
		expect(chips).toHaveLength(2);
	});

	it('hides the "Create one-off event" chip action when canEdit=false', () => {
		render(ExdatesChipList, {
			props: { ...baseProps, exdates: ['2026-05-01T18:00:00Z'] }
		});
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('renders a chip action per date when canEdit=true', () => {
		render(ExdatesChipList, {
			props: {
				...baseProps,
				canEdit: true,
				exdates: ['2026-05-01T18:00:00Z', '2026-05-08T18:00:00Z']
			}
		});
		expect(screen.getAllByRole('button')).toHaveLength(2);
	});

	it('navigates to /admin/events/new with start + series prefilled on chip click', async () => {
		const { goto } = await import('$app/navigation');
		const user = userEvent.setup();

		render(ExdatesChipList, {
			props: {
				...baseProps,
				canEdit: true,
				exdates: ['2026-05-01T18:00:00Z']
			}
		});

		await user.click(screen.getByRole('button'));

		expect(goto).toHaveBeenCalledTimes(1);
		const target = vi.mocked(goto).mock.calls[0][0] as string;
		expect(target).toContain('/org/revels/admin/events/new');
		expect(target).toContain('start=2026-05-01T18%3A00%3A00Z');
		expect(target).toContain('event_series_id=ser_abc123');
	});

	it('passes the exact ISO the caller provided (not a reformatted one)', async () => {
		const { goto } = await import('$app/navigation');
		const user = userEvent.setup();

		// Provide a non-UTC-normalised ISO; the component should not mangle it.
		render(ExdatesChipList, {
			props: {
				...baseProps,
				canEdit: true,
				exdates: ['2026-05-01T20:00:00+02:00']
			}
		});
		await user.click(screen.getByRole('button'));
		const target = vi.mocked(goto).mock.calls[0][0] as string;
		expect(decodeURIComponent(target.split('start=')[1].split('&')[0])).toBe(
			'2026-05-01T20:00:00+02:00'
		);
	});
});
