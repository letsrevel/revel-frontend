import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import type {
	ChartSeatSchema,
	ChartSectorSchema,
	VenueChartSchema
} from '$lib/api/generated/types.gen';
import SeatMap from './SeatMap.svelte';
import type { SeatView } from './seating-view';

// SeatMap is a pure props component: the chart provides geometry, the seats
// prop (from seating-view) provides statuses. Real compiled paraglide messages
// back the accessible-name assertions, mirroring SeatSelector.test.ts.

function chartSeat(id: string, overrides: Partial<ChartSeatSchema> = {}): ChartSeatSchema {
	return {
		id,
		label: id.toUpperCase(),
		row_label: id[0]?.toUpperCase() ?? '?',
		row_order: id[0] === 'b' ? 1 : 0,
		number: Number(id.slice(1)) || 1,
		adjacency_index: (Number(id.slice(1)) || 1) - 1,
		is_accessible: false,
		is_obstructed_view: false,
		is_active: true,
		price_category_id: null,
		...overrides
	};
}

function view(id: string, overrides: Partial<SeatView> = {}): SeatView {
	return {
		id,
		label: id.toUpperCase(),
		rowLabel: id[0]?.toUpperCase() ?? '?',
		rowOrder: id[0] === 'b' ? 1 : 0,
		number: Number(id.slice(1)) || 1,
		adjacencyIndex: (Number(id.slice(1)) || 1) - 1,
		isAccessible: false,
		isObstructedView: false,
		status: 'available',
		...overrides
	};
}

function makeChart(
	seats: ChartSeatSchema[],
	overrides: Partial<VenueChartSchema> = {},
	sectorOverrides: Partial<ChartSectorSchema> = {}
): VenueChartSchema {
	return {
		venue_id: 'venue-1',
		venue_name: 'Test Hall',
		updated_at: '2026-07-18T00:00:00Z',
		price_categories: [],
		sectors: [{ id: 'sec-1', name: 'Stalls', kind: 'seated', seats, ...sectorOverrides }],
		...overrides
	};
}

interface RenderOptions {
	chart?: VenueChartSchema;
	seats?: SeatView[];
	onToggle?: (id: string) => void;
	maxReached?: boolean;
	disabled?: boolean;
	interactive?: boolean;
	activeSectorId?: string | null;
	standingCounts?: Record<string, { capacity: number; taken: number }>;
}

function renderMap(options: RenderOptions = {}) {
	const onToggle = options.onToggle ?? vi.fn();
	const chart = options.chart ?? makeChart([chartSeat('a1'), chartSeat('a2'), chartSeat('b1')]);
	const seats = options.seats ?? [view('a1'), view('a2'), view('b1')];
	render(SeatMap, { props: { ...options, chart, seats, onToggle } });
	return onToggle;
}

function seatButton(name: string): HTMLElement {
	return screen.getByRole('button', { name });
}

describe('SeatMap', () => {
	describe('rendering', () => {
		it('renders a labelled map with a stage marker and zoom controls', () => {
			renderMap();
			expect(screen.getByRole('group', { name: 'Seat map' })).toBeInTheDocument();
			expect(screen.getByText('STAGE')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeInTheDocument();
		});

		it('renders seats with the shared SeatSelector status wording', () => {
			renderMap({
				seats: [view('a1'), view('a2', { status: 'sold' }), view('b1', { status: 'held' })]
			});
			expect(seatButton('Seat A1')).toBeInTheDocument();
			expect(seatButton('Seat A2, sold')).toHaveAttribute('aria-disabled', 'true');
			expect(seatButton('Seat B1, held by someone else')).toHaveAttribute('aria-disabled', 'true');
		});

		it('appends the price-category name to the accessible name (color never alone)', () => {
			renderMap({
				chart: makeChart(
					[chartSeat('a1', { price_category_id: 'cat-1' }), chartSeat('a2'), chartSeat('b1')],
					{
						price_categories: [{ id: 'cat-1', name: 'Gold', color: '#aa0000', display_order: 0 }]
					}
				)
			});
			expect(seatButton('Seat A1, Gold')).toBeInTheDocument();
			expect(seatButton('Seat A2')).toBeInTheDocument();
		});

		it('marks my seat pressed and a pending seat busy', () => {
			renderMap({
				seats: [view('a1', { status: 'mine' }), view('a2', { status: 'pending' }), view('b1')]
			});
			expect(seatButton('Seat A1')).toHaveAttribute('aria-pressed', 'true');
			expect(seatButton('Seat A2, updating')).toHaveAttribute('aria-busy', 'true');
		});

		it('renders chart seats missing from the seats prop as non-interactive', () => {
			renderMap({ seats: [view('a1')] });
			expect(seatButton('Seat A1')).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /Seat A2/ })).not.toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /Seat B1/ })).not.toBeInTheDocument();
		});

		it('renders a standing sector as a zone with occupancy, not seats', () => {
			renderMap({
				chart: makeChart([], {}, { id: 'stand-1', name: 'Pit', kind: 'standing', capacity: 100 }),
				seats: [],
				standingCounts: { 'stand-1': { capacity: 100, taken: 60 } }
			});
			expect(screen.getByRole('img', { name: 'Pit, Standing area, 40/100' })).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /Seat/ })).not.toBeInTheDocument();
		});

		it('renders no seat buttons when interactive is false', () => {
			renderMap({ interactive: false });
			expect(screen.queryByRole('button', { name: /Seat/ })).not.toBeInTheDocument();
			// Zoom controls remain.
			expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
		});
	});

	describe('sector transforms', () => {
		it('keeps a rotated single sector interactive with a stage indicator', () => {
			// A scoped sector rotated 90°: it renders un-rotated (readable) but the
			// group transform / stage placement must not break seat a11y.
			const rotated = makeChart(
				[chartSeat('a1'), chartSeat('a2'), chartSeat('b1')],
				{},
				{ metadata: { transform: { x: 4, y: 6, rotation: 90 } } }
			);
			const onToggle = renderMap({ chart: rotated });
			expect(screen.getByRole('img', { name: 'STAGE' })).toBeInTheDocument();
			const a1 = seatButton('Seat A1');
			expect(a1).toHaveAttribute('aria-pressed', 'false');
			return fireEvent.click(a1).then(() => {
				expect(onToggle).toHaveBeenCalledExactlyOnceWith('a1');
			});
		});

		it('renders a full multi-sector map with one stage marker and every sector', () => {
			const twoSectors: VenueChartSchema = {
				venue_id: 'venue-1',
				venue_name: 'Test Hall',
				updated_at: '2026-07-18T00:00:00Z',
				price_categories: [],
				sectors: [
					{ id: 'sec-1', name: 'Stalls', kind: 'seated', seats: [chartSeat('a1')] },
					{
						id: 'sec-2',
						name: 'Balcony',
						kind: 'seated',
						seats: [chartSeat('c1', { id: 'c1' })],
						metadata: { transform: { x: 12, y: 0, rotation: 30 } }
					}
				]
			};
			renderMap({
				chart: twoSectors,
				seats: [view('a1'), view('c1')]
			});
			// A single stage marker for the whole venue.
			expect(screen.getAllByRole('img', { name: 'STAGE' })).toHaveLength(1);
			// Both sectors' seats render as buttons.
			expect(seatButton('Seat A1')).toBeInTheDocument();
			expect(seatButton('Seat C1')).toBeInTheDocument();
			// Both sector names render (upright, outside the rotated group).
			expect(screen.getByText('Stalls')).toBeInTheDocument();
			expect(screen.getByText('Balcony')).toBeInTheDocument();
		});

		it('renders other sectors as inert labelled ghosts in whole-venue context mode', () => {
			const twoSectors: VenueChartSchema = {
				venue_id: 'venue-1',
				venue_name: 'Test Hall',
				updated_at: '2026-07-18T00:00:00Z',
				price_categories: [],
				sectors: [
					{ id: 'sec-1', name: 'Stalls', kind: 'seated', seats: [chartSeat('a1')] },
					{
						id: 'sec-2',
						name: 'Balcony',
						kind: 'seated',
						seats: [chartSeat('c1', { id: 'c1' })],
						metadata: { transform: { x: 12, y: 0, rotation: 30 } }
					}
				]
			};
			// seatViews cover ONLY the active sector, exactly like the dialogs.
			const onToggle = renderMap({
				chart: twoSectors,
				seats: [view('a1')],
				activeSectorId: 'sec-1'
			});
			// Active sector: fully interactive.
			expect(seatButton('Seat A1')).toBeInTheDocument();
			// Ghost sector: one labelled inert group, its seat is NOT a button and
			// NOT the sold/blocked X treatment.
			expect(
				screen.getByRole('img', { name: 'Balcony: sold through a different ticket' })
			).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /Seat C1/ })).not.toBeInTheDocument();
			expect(onToggle).not.toHaveBeenCalled();
		});
	});

	describe('cooperative wheel zoom', () => {
		function mapTransform(): string {
			const svg = screen.getByRole('group', { name: 'Seat map' });
			return svg.querySelector('g')?.getAttribute('transform') ?? '';
		}

		it('zooms only with Ctrl/Cmd held — a bare wheel is a scroll, not a hijack', async () => {
			renderMap();
			const svg = screen.getByRole('group', { name: 'Seat map' });
			const before = mapTransform();

			await fireEvent.wheel(svg, { deltaY: -120 });
			expect(mapTransform()).toBe(before); // untouched — the dialog scrolls
			expect(screen.getByText('Hold Ctrl (or ⌘) and scroll to zoom')).toBeInTheDocument();

			await fireEvent.wheel(svg, { deltaY: -120, ctrlKey: true });
			expect(mapTransform()).not.toBe(before);
		});
	});

	describe('onToggle', () => {
		it('fires for an available seat and for my held seat', async () => {
			const onToggle = renderMap({
				seats: [view('a1'), view('a2', { status: 'mine' }), view('b1')]
			});
			await fireEvent.click(seatButton('Seat A1'));
			expect(onToggle).toHaveBeenCalledExactlyOnceWith('a1');
			await fireEvent.click(seatButton('Seat A2'));
			expect(onToggle).toHaveBeenLastCalledWith('a2');
		});

		it('never fires for sold, held, blocked or pending seats', async () => {
			const onToggle = renderMap({
				seats: [
					view('a1', { status: 'sold' }),
					view('a2', { status: 'held' }),
					view('b1', { status: 'pending' })
				]
			});
			await fireEvent.click(seatButton('Seat A1, sold'));
			await fireEvent.click(seatButton('Seat A2, held by someone else'));
			await fireEvent.click(seatButton('Seat B1, updating'));
			expect(onToggle).not.toHaveBeenCalled();
		});

		it('makes available seats inert (but keeps mine togglable) when maxReached', async () => {
			const onToggle = renderMap({
				seats: [view('a1', { status: 'mine' }), view('a2'), view('b1')],
				maxReached: true
			});
			const available = seatButton('Seat A2');
			expect(available).toHaveAttribute('aria-disabled', 'true');
			await fireEvent.click(available);
			expect(onToggle).not.toHaveBeenCalled();
			await fireEvent.click(seatButton('Seat A1'));
			expect(onToggle).toHaveBeenCalledExactlyOnceWith('a1');
		});

		it('fires for nothing when disabled', async () => {
			const onToggle = renderMap({
				seats: [view('a1', { status: 'mine' }), view('a2'), view('b1')],
				disabled: true
			});
			await fireEvent.click(seatButton('Seat A1'));
			await fireEvent.click(seatButton('Seat A2'));
			expect(onToggle).not.toHaveBeenCalled();
		});
	});

	describe('keyboard', () => {
		it('toggles with Enter and Space', async () => {
			const onToggle = renderMap();
			await fireEvent.keyDown(seatButton('Seat A1'), { key: 'Enter' });
			expect(onToggle).toHaveBeenCalledExactlyOnceWith('a1');
			await fireEvent.keyDown(seatButton('Seat A2'), { key: ' ' });
			expect(onToggle).toHaveBeenLastCalledWith('a2');
		});

		it('does not toggle an unavailable seat via keyboard', async () => {
			const onToggle = renderMap({
				seats: [view('a1', { status: 'blocked' }), view('a2'), view('b1')]
			});
			await fireEvent.keyDown(seatButton('Seat A1, unavailable'), { key: 'Enter' });
			expect(onToggle).not.toHaveBeenCalled();
		});

		it('roves the tabindex row-by-row with arrow keys', async () => {
			renderMap();
			const a1 = seatButton('Seat A1');
			const a2 = seatButton('Seat A2');
			const b1 = seatButton('Seat B1');

			// Initial roving stop is the first seat of the first row.
			expect(a1).toHaveAttribute('tabindex', '0');
			expect(a2).toHaveAttribute('tabindex', '-1');
			expect(b1).toHaveAttribute('tabindex', '-1');

			await fireEvent.keyDown(a1, { key: 'ArrowRight' });
			expect(a1).toHaveAttribute('tabindex', '-1');
			expect(a2).toHaveAttribute('tabindex', '0');

			await fireEvent.keyDown(a2, { key: 'ArrowDown' });
			expect(b1).toHaveAttribute('tabindex', '0');

			await fireEvent.keyDown(b1, { key: 'ArrowUp' });
			expect(a1).toHaveAttribute('tabindex', '0');
		});
	});
});
