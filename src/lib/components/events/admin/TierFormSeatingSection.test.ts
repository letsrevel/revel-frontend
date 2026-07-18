import { render, screen, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TierFormSeatingSection from './TierFormSeatingSection.svelte';
import type {
	PriceCategorySchema,
	SeatAssignmentMode,
	VenueSectorSchema
} from '$lib/api/generated/types.gen';

// TierFormSeatingSection is a pure props section (the chart/venues queries and
// the per-mode payload/validity gating live in TierForm), so no sdk mock or
// QueryClientProvider is needed — the gating flags are exercised via props the
// same way TierForm computes them (sectorRequired = user_choice,
// categoryRequired = best_available).

const sectors: VenueSectorSchema[] = [
	{ id: 'sector-1', name: 'Main Floor', code: 'MF', capacity: 100 }
];

const standingSectors: VenueSectorSchema[] = [
	{ id: 'standing-1', name: 'Pit', code: 'PIT', capacity: 250 },
	{ id: 'standing-2', name: 'Terrace', code: 'TER', capacity: 80 }
];

const priceCategories: PriceCategorySchema[] = [
	{ id: 'pc-gold', name: 'Gold', color: '#f9b233', display_order: 1 },
	{ id: 'pc-silver', name: 'Silver', color: '#9ab2ff', display_order: 0 }
];

function renderSection(
	overrides: Partial<{
		seatAssignmentMode: SeatAssignmentMode;
		sectorId: string | null;
		priceCategoryId: string | null;
		canUseSeatAssignment: boolean;
		venueId: string | null;
		selectedVenueSectors: VenueSectorSchema[];
		standingSectors: VenueSectorSchema[];
		sectorRequired: boolean;
		priceCategories: PriceCategorySchema[];
		chartLoading: boolean;
		chartError: boolean;
		onRetryChart: () => void;
		categoryRequired: boolean;
	}> = {}
) {
	return render(TierFormSeatingSection, {
		props: {
			seatAssignmentMode: 'none' as SeatAssignmentMode,
			maxTicketsPerUser: '',
			sectorId: null,
			priceCategoryId: null,
			canUseSeatAssignment: true,
			venueId: 'venue-1',
			venuesLoading: false,
			selectedVenue: undefined,
			selectedVenueSectors: sectors,
			standingSectors: [],
			sectorRequired: false,
			priceCategories,
			chartLoading: false,
			chartError: false,
			categoryRequired: false,
			isPending: false,
			...overrides
		}
	});
}

describe('TierFormSeatingSection', () => {
	describe('assignment mode select', () => {
		it('offers none, best_available and user_choice — and no random option', () => {
			renderSection();
			const modeSelect = screen.getByRole('combobox', { name: 'Seat Assignment Mode' });
			const options = within(modeSelect).getAllByRole('option');
			expect(options.map((o) => (o as HTMLOptionElement).value)).toEqual([
				'none',
				'best_available',
				'user_choice'
			]);
			expect(options.some((o) => /random/i.test(o.textContent ?? ''))).toBe(false);
		});

		it('labels the best_available option and shows its help text when selected', () => {
			renderSection({ seatAssignmentMode: 'best_available', categoryRequired: true });
			const modeSelect = screen.getByRole('combobox', { name: 'Seat Assignment Mode' });
			expect(
				within(modeSelect).getByRole('option', { name: /Best Available/i })
			).toBeInTheDocument();
			expect(screen.getByText(/assigned automatically at purchase/i)).toBeInTheDocument();
		});

		it('disables the seated modes when the event has no venue', () => {
			renderSection({ canUseSeatAssignment: false, venueId: null });
			const modeSelect = screen.getByRole('combobox', { name: 'Seat Assignment Mode' });
			const byValue = (value: string) =>
				within(modeSelect)
					.getAllByRole('option')
					.find((o) => (o as HTMLOptionElement).value === value) as HTMLOptionElement;
			expect(byValue('best_available')).toBeDisabled();
			expect(byValue('user_choice')).toBeDisabled();
			expect(byValue('none')).toBeEnabled();
		});
	});

	describe('best_available mode', () => {
		it('renders a required price-category select ordered by display_order, and no sector select', () => {
			renderSection({ seatAssignmentMode: 'best_available', categoryRequired: true });

			const categorySelect = screen.getByRole('combobox', { name: /Price Category/ });
			expect(categorySelect).toBeRequired();
			const options = within(categorySelect).getAllByRole('option');
			expect(options.map((o) => o.textContent?.trim())).toEqual([
				'Select a price category (required)',
				'Silver',
				'Gold'
			]);

			// Sector selection belongs to user_choice only.
			expect(screen.queryByRole('combobox', { name: /Sector/ })).not.toBeInTheDocument();
		});

		it('marks the empty required category select with the destructive border', () => {
			renderSection({
				seatAssignmentMode: 'best_available',
				categoryRequired: true,
				priceCategoryId: null
			});
			expect(screen.getByRole('combobox', { name: /Price Category/ }).className).toContain(
				'border-destructive'
			);
		});

		it('drops the destructive border once a category is selected and shows its color swatch', () => {
			renderSection({
				seatAssignmentMode: 'best_available',
				categoryRequired: true,
				priceCategoryId: 'pc-gold'
			});
			const categorySelect = screen.getByRole('combobox', { name: /Price Category/ });
			expect(categorySelect.className).not.toContain('border-destructive');
			// Swatch is decorative (aria-hidden) and paired with the category name
			// (jsdom serializes the hex to rgb, so match on the parsed style).
			const swatch = Array.from(
				document.querySelectorAll<HTMLElement>('span[aria-hidden="true"]')
			).find((el) => el.style.backgroundColor !== '');
			expect(swatch).toBeDefined();
			expect(swatch?.style.backgroundColor).toBe('rgb(249, 178, 51)');
			expect(swatch?.parentElement?.textContent).toContain('Gold');
		});

		it('explains the blocked state when the chart has no price categories', () => {
			renderSection({
				seatAssignmentMode: 'best_available',
				categoryRequired: true,
				priceCategories: []
			});
			expect(screen.queryByRole('combobox', { name: /Price Category/ })).not.toBeInTheDocument();
			expect(screen.getByText(/no price categories/i)).toBeInTheDocument();
		});

		it('shows a loading state while the chart query is pending', () => {
			renderSection({
				seatAssignmentMode: 'best_available',
				categoryRequired: true,
				chartLoading: true
			});
			expect(screen.getByText('Loading seating chart...')).toBeInTheDocument();
			expect(screen.queryByRole('combobox', { name: /Price Category/ })).not.toBeInTheDocument();
		});

		it('shows a distinct load-failure state with a working retry button when the chart query errored', async () => {
			const user = userEvent.setup();
			const onRetryChart = vi.fn();
			renderSection({
				seatAssignmentMode: 'best_available',
				categoryRequired: true,
				priceCategories: [],
				chartError: true,
				onRetryChart
			});

			expect(screen.getByRole('alert')).toHaveTextContent(/failed to load the seating chart/i);
			// The failure must NOT be misreported as an empty chart.
			expect(screen.queryByText(/no price categories/i)).not.toBeInTheDocument();
			expect(screen.queryByRole('combobox', { name: /Price Category/ })).not.toBeInTheDocument();

			await user.click(screen.getByRole('button', { name: 'Try again' }));
			expect(onRetryChart).toHaveBeenCalledOnce();
		});

		it('prefers the loading state over a previous error while refetching', () => {
			renderSection({
				seatAssignmentMode: 'best_available',
				categoryRequired: true,
				chartLoading: true,
				chartError: true
			});
			expect(screen.getByText('Loading seating chart...')).toBeInTheDocument();
			expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		});
	});

	describe('user_choice mode', () => {
		it('renders a required sector select and no price-category select', () => {
			renderSection({ seatAssignmentMode: 'user_choice', sectorRequired: true });

			const sectorSelect = screen.getByRole('combobox', { name: /Sector/ });
			expect(sectorSelect).toBeRequired();
			expect(
				within(sectorSelect).getByRole('option', { name: 'Select a sector (required)' })
			).toBeInTheDocument();
			expect(within(sectorSelect).getByRole('option', { name: /Main Floor/ })).toBeInTheDocument();

			expect(screen.queryByRole('combobox', { name: /Price Category/ })).not.toBeInTheDocument();
		});

		it('marks the empty required sector select with the destructive border', () => {
			renderSection({ seatAssignmentMode: 'user_choice', sectorRequired: true, sectorId: null });
			expect(screen.getByRole('combobox', { name: /Sector/ }).className).toContain(
				'border-destructive'
			);
		});
	});

	describe('none mode', () => {
		it('renders neither sector nor price-category selects when there are no standing sectors', () => {
			renderSection({ seatAssignmentMode: 'none' });
			expect(screen.queryByRole('combobox', { name: /Sector/i })).not.toBeInTheDocument();
			expect(screen.queryByRole('combobox', { name: /Price Category/ })).not.toBeInTheDocument();
		});

		it('renders an optional standing-sector select when the chart has standing sectors', () => {
			renderSection({ seatAssignmentMode: 'none', standingSectors });

			const standingSelect = screen.getByRole('combobox', { name: /Standing Sector/i });
			expect(standingSelect).not.toBeRequired();

			// Empty "no cap" option first (the default), then only the standing
			// sectors — never the seated ones from selectedVenueSectors.
			const options = within(standingSelect).getAllByRole('option');
			expect(options[0]).toHaveTextContent('None (no capacity limit)');
			expect((options[0] as HTMLOptionElement).selected).toBe(true);
			expect(options.map((o) => o.textContent?.trim())).toEqual([
				'None (no capacity limit)',
				expect.stringContaining('Pit'),
				expect.stringContaining('Terrace')
			]);
			expect(
				within(standingSelect).queryByRole('option', { name: /Main Floor/ })
			).not.toBeInTheDocument();

			expect(screen.getByText(/cap this tier's sales at the sector capacity/i)).toBeInTheDocument();
			expect(screen.queryByRole('combobox', { name: /Price Category/ })).not.toBeInTheDocument();
		});

		it('prefills the standing select from sectorId and shows the hard-limit warning', () => {
			renderSection({ seatAssignmentMode: 'none', standingSectors, sectorId: 'standing-1' });
			const standingSelect = screen.getByRole('combobox', {
				name: /Standing Sector/i
			}) as HTMLSelectElement;
			expect(standingSelect.value).toBe('standing-1');
			expect(screen.getByText('Sector Hard Limit')).toBeInTheDocument();
			expect(screen.getByText(/limited to 250 attendees/)).toBeInTheDocument();
		});

		it('hides the standing select when the event has no venue', () => {
			renderSection({
				seatAssignmentMode: 'none',
				standingSectors,
				canUseSeatAssignment: false,
				venueId: null
			});
			expect(screen.queryByRole('combobox', { name: /Standing Sector/i })).not.toBeInTheDocument();
		});

		it('does not render the standing select in seated modes', () => {
			renderSection({ seatAssignmentMode: 'user_choice', sectorRequired: true, standingSectors });
			expect(screen.queryByRole('combobox', { name: /Standing Sector/i })).not.toBeInTheDocument();

			renderSection({
				seatAssignmentMode: 'best_available',
				categoryRequired: true,
				standingSectors
			});
			expect(screen.queryByRole('combobox', { name: /Standing Sector/i })).not.toBeInTheDocument();
		});
	});
});
