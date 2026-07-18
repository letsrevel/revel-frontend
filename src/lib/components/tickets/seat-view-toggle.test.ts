import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
	ChartSeatSchema,
	ChartSectorSchema,
	VenueChartSchema
} from '$lib/api/generated/types.gen';
import SeatViewToggle from './SeatViewToggle.svelte';
import {
	SEAT_VIEW_PREF_KEY,
	defaultSeatViewMode,
	readSeatViewPref,
	standingCountsFrom,
	writeSeatViewPref
} from './seat-view-toggle';

function seat(id: string, overrides: Partial<ChartSeatSchema> = {}): ChartSeatSchema {
	return { id, label: id.toUpperCase(), is_active: true, ...overrides };
}

function sector(
	id: string,
	seats: ChartSeatSchema[],
	overrides: Partial<ChartSectorSchema> = {}
): ChartSectorSchema {
	return { id, name: id, kind: 'seated', seats, ...overrides };
}

function chart(sectors: ChartSectorSchema[]): VenueChartSchema {
	return {
		venue_id: 'venue-1',
		venue_name: 'Test Hall',
		updated_at: '2026-07-18T00:00:00Z',
		price_categories: [],
		sectors
	};
}

function manySeats(count: number): ChartSeatSchema[] {
	return Array.from({ length: count }, (_, index) => seat(`s${index}`));
}

describe('defaultSeatViewMode', () => {
	it('defaults a small single-sector chart to the list', () => {
		expect(defaultSeatViewMode(chart([sector('a', manySeats(12))]))).toBe('list');
	});

	it('defaults to the map with more than one sector', () => {
		expect(defaultSeatViewMode(chart([sector('a', manySeats(2)), sector('b', [])]))).toBe('map');
	});

	it('defaults to the map when a sector has a renderable shape', () => {
		const shaped = sector('a', manySeats(2), {
			shape: [
				{ x: 0, y: 0 },
				{ x: 4, y: 0 },
				{ x: 2, y: 3 }
			]
		});
		expect(defaultSeatViewMode(chart([shaped]))).toBe('map');
	});

	it('ignores degenerate shapes with fewer than 3 points', () => {
		const degenerate = sector('a', manySeats(2), {
			shape: [
				{ x: 0, y: 0 },
				{ x: 4, y: 0 }
			]
		});
		expect(defaultSeatViewMode(chart([degenerate]))).toBe('list');
	});

	it('defaults to the map above 60 active seats', () => {
		expect(defaultSeatViewMode(chart([sector('a', manySeats(61))]))).toBe('map');
		expect(defaultSeatViewMode(chart([sector('a', manySeats(60))]))).toBe('list');
	});

	it('does not count inactive seats toward the 60-seat threshold', () => {
		const seats = [...manySeats(60), seat('inactive-1', { is_active: false })];
		expect(defaultSeatViewMode(chart([sector('a', seats)]))).toBe('list');
	});

	it('defaults an empty chart to the list', () => {
		expect(defaultSeatViewMode(chart([]))).toBe('list');
	});
});

describe('seat view preference persistence', () => {
	beforeEach(() => {
		window.sessionStorage.clear();
	});

	it('returns null when nothing is stored', () => {
		expect(readSeatViewPref()).toBeNull();
	});

	it('round-trips an explicit choice through sessionStorage', () => {
		writeSeatViewPref('map');
		expect(window.sessionStorage.getItem(SEAT_VIEW_PREF_KEY)).toBe('map');
		expect(readSeatViewPref()).toBe('map');
		writeSeatViewPref('list');
		expect(readSeatViewPref()).toBe('list');
	});

	it('treats unknown stored values as unset', () => {
		window.sessionStorage.setItem(SEAT_VIEW_PREF_KEY, 'grid');
		expect(readSeatViewPref()).toBeNull();
	});
});

describe('standingCountsFrom', () => {
	it('returns undefined for an absent or empty standing map', () => {
		expect(standingCountsFrom(undefined)).toBeUndefined();
		expect(standingCountsFrom({})).toBeUndefined();
	});

	it('adapts well-formed entries and defaults a missing taken to 0', () => {
		expect(
			standingCountsFrom({
				'sec-1': { capacity: 100, taken: 25 },
				'sec-2': { capacity: 40 }
			})
		).toEqual({
			'sec-1': { capacity: 100, taken: 25 },
			'sec-2': { capacity: 40, taken: 0 }
		});
	});

	it('drops entries without a numeric capacity', () => {
		expect(
			standingCountsFrom({
				'sec-null': { capacity: null, taken: 3 },
				'sec-bogus': { capacity: 'lots', taken: 3 },
				'sec-ok': { capacity: 10, taken: 3 }
			})
		).toEqual({ 'sec-ok': { capacity: 10, taken: 3 } });
	});

	it('returns undefined when no entry survives the capacity filter', () => {
		expect(standingCountsFrom({ 'sec-null': { capacity: null, taken: 3 } })).toBeUndefined();
	});
});

describe('SeatViewToggle', () => {
	it('reflects the active mode via aria-pressed', () => {
		render(SeatViewToggle, { props: { mode: 'map', onModeChange: vi.fn() } });
		expect(screen.getByRole('button', { name: 'Map', pressed: true })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'List', pressed: false })).toBeInTheDocument();
	});

	it('fires onModeChange with the tapped mode', async () => {
		const onModeChange = vi.fn();
		render(SeatViewToggle, { props: { mode: 'map', onModeChange } });
		await fireEvent.click(screen.getByRole('button', { name: 'List' }));
		expect(onModeChange).toHaveBeenCalledWith('list');
		await fireEvent.click(screen.getByRole('button', { name: 'Map' }));
		expect(onModeChange).toHaveBeenCalledWith('map');
	});

	it('exposes an accessible group label', () => {
		render(SeatViewToggle, { props: { mode: 'list', onModeChange: vi.fn() } });
		expect(screen.getByRole('group', { name: 'Seat display' })).toBeInTheDocument();
	});
});
