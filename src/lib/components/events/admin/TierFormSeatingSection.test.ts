import { render, screen, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TierFormSeatingSection from './TierFormSeatingSection.svelte';
import type {
	PriceCategorySchema,
	SeatAssignmentMode,
	TierPricingGapSchema,
	VenueSectorSchema
} from '$lib/api/generated/types.gen';

// TierFormSeatingSection is a pure props section (the chart/venues queries and
// the per-mode payload/validity gating live in TierForm), so no sdk mock or
// QueryClientProvider is needed — the gating flags are exercised via props the
// same way TierForm computes them (sectorRequired = any seated mode; pricing
// rows come from the painted-in-sector ∪ priced categories).

const sectors: VenueSectorSchema[] = [
	{ id: 'sector-1', name: 'Main Floor', code: 'MF', capacity: 100 }
];

const standingSectors: VenueSectorSchema[] = [
	{ id: 'standing-1', name: 'Pit', code: 'PIT', capacity: 250 },
	{ id: 'standing-2', name: 'Terrace', code: 'TER', capacity: 80 }
];

const pricingCategories: PriceCategorySchema[] = [
	{ id: 'pc-gold', name: 'Gold', color: '#f9b233', display_order: 1 },
	{ id: 'pc-silver', name: 'Silver', color: '#9ab2ff', display_order: 0 }
];

function renderSection(
	overrides: Partial<{
		seatAssignmentMode: SeatAssignmentMode;
		sectorId: string | null;
		categoryPrices: Record<string, string>;
		pricingCategories: PriceCategorySchema[];
		pricingGaps: TierPricingGapSchema[];
		canUseSeatAssignment: boolean;
		venueId: string | null;
		selectedVenueSectors: VenueSectorSchema[];
		standingSectors: VenueSectorSchema[];
		sectorRequired: boolean;
		chartLoading: boolean;
		chartError: boolean;
		onRetryChart: () => void;
	}> = {}
) {
	return render(TierFormSeatingSection, {
		props: {
			seatAssignmentMode: 'none' as SeatAssignmentMode,
			maxTicketsPerUser: '',
			sectorId: null,
			categoryPrices: {},
			pricingCategories: [],
			pricingGaps: [],
			currencySymbol: '€',
			canUseSeatAssignment: true,
			venueId: 'venue-1',
			venuesLoading: false,
			selectedVenue: undefined,
			selectedVenueSectors: sectors,
			standingSectors: [],
			sectorRequired: false,
			chartLoading: false,
			chartError: false,
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
			renderSection({ seatAssignmentMode: 'best_available', sectorRequired: true });
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

	describe('best_available mode (pricing convergence: same sector + pricing UI as user_choice)', () => {
		it('renders a required sector select — the removed price-category FK used to supply the venue', () => {
			renderSection({ seatAssignmentMode: 'best_available', sectorRequired: true });

			const sectorSelect = screen.getByRole('combobox', { name: /Sector/ });
			expect(sectorSelect).toBeRequired();
			expect(within(sectorSelect).getByRole('option', { name: /Main Floor/ })).toBeInTheDocument();

			// The old FK picker is gone for good.
			expect(screen.queryByRole('combobox', { name: /Price Category/ })).not.toBeInTheDocument();
		});

		it('renders zone-pricing rows with zone copy, ordered by display_order', () => {
			renderSection({
				seatAssignmentMode: 'best_available',
				sectorRequired: true,
				sectorId: 'sector-1',
				pricingCategories
			});

			expect(screen.getByText('Zone pricing')).toBeInTheDocument();
			// Zones help + the per-zone-capacity pattern note (the one organizer
			// capability whose expression changed in the convergence).
			expect(screen.getByText(/buyers pick one of the priced zones/i)).toBeInTheDocument();
			expect(screen.getByText(/give each zone its own tier/i)).toBeInTheDocument();
			// user_choice-only copy stays out.
			expect(screen.queryByText(/sell at this tier's base price/i)).not.toBeInTheDocument();

			const inputs = screen.getAllByRole('textbox');
			expect(inputs.map((input) => input.id)).toEqual([
				'category-price-pc-silver',
				'category-price-pc-gold'
			]);
		});

		it('never shows the coverage-gap warning (partial coverage IS the feature)', () => {
			renderSection({
				seatAssignmentMode: 'best_available',
				sectorRequired: true,
				sectorId: 'sector-1',
				pricingCategories,
				pricingGaps: [{ id: 'pc-silver', name: 'Silver' }] as TierPricingGapSchema[]
			});
			expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		});

		it('shows a loading state for the pricing block while the chart query is pending', () => {
			renderSection({
				seatAssignmentMode: 'best_available',
				sectorRequired: true,
				sectorId: 'sector-1',
				chartLoading: true
			});
			expect(screen.getByText('Loading seating chart...')).toBeInTheDocument();
		});

		it('shows a load-failure state with a working retry button when the chart query errored', async () => {
			const user = userEvent.setup();
			const onRetryChart = vi.fn();
			renderSection({
				seatAssignmentMode: 'best_available',
				sectorRequired: true,
				sectorId: 'sector-1',
				chartError: true,
				onRetryChart
			});

			expect(screen.getByRole('alert')).toHaveTextContent(/failed to load the seating chart/i);
			await user.click(screen.getByRole('button', { name: 'Try again' }));
			expect(onRetryChart).toHaveBeenCalledOnce();
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

		it('keeps the full-coverage copy and shows the coverage-gap warning', () => {
			renderSection({
				seatAssignmentMode: 'user_choice',
				sectorRequired: true,
				sectorId: 'sector-1',
				pricingCategories,
				pricingGaps: [{ id: 'pc-silver', name: 'Silver' }] as TierPricingGapSchema[]
			});
			expect(screen.getByText('Seat category prices')).toBeInTheDocument();
			expect(screen.getByText(/sell at this tier's base price/i)).toBeInTheDocument();
			expect(screen.getByRole('alert')).toHaveTextContent(/Silver/);
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
				sectorRequired: true,
				standingSectors
			});
			expect(screen.queryByRole('combobox', { name: /Standing Sector/i })).not.toBeInTheDocument();
		});
	});
});
