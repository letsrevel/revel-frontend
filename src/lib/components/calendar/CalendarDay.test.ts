import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import CalendarDay from './CalendarDay.svelte';
import type { EventInListSchema } from '$lib/api/generated/types.gen';

const ev = (id: string, name: string) => ({ id, name }) as unknown as EventInListSchema;
const date = new Date(2026, 6, 10);

describe('CalendarDay', () => {
	it('puts the event name as title on the overlay button for a single event', () => {
		render(CalendarDay, {
			props: {
				date,
				dayEvents: [ev('1', 'Summer Party')],
				isCurrentMonth: true,
				isToday: false,
				onEventClick: vi.fn()
			}
		});
		expect(screen.getByRole('button')).toHaveAttribute('title', 'Summer Party');
	});

	it('keeps per-badge titles for multiple events', () => {
		render(CalendarDay, {
			props: {
				date,
				dayEvents: [ev('1', 'A'), ev('2', 'B')],
				isCurrentMonth: true,
				isToday: false,
				onEventClick: vi.fn()
			}
		});
		expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('title', 'A');
		expect(screen.getByRole('button', { name: 'B' })).toHaveAttribute('title', 'B');
	});
});
