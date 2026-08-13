import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import SeatLayoutPreview from './SeatLayoutPreview.svelte';

describe('SeatLayoutPreview', () => {
	it('renders one circle per seat at the baked cell-center position', () => {
		const { container, getByRole } = render(SeatLayoutPreview, {
			seats: [
				{ key: '0-0', x: 0, y: 0, categoryColor: null },
				{ key: '0-1', x: 1.5, y: 0.25, categoryColor: '#aa0000' }
			]
		});
		expect(getByRole('img')).toBeTruthy();
		const circles = container.querySelectorAll('circle');
		expect(circles).toHaveLength(2);
		// (x + 0.5) * 24
		expect(circles[1].getAttribute('cx')).toBe(String((1.5 + 0.5) * 24));
		expect(circles[1].getAttribute('cy')).toBe(String((0.25 + 0.5) * 24));
		expect(circles[1].getAttribute('fill')).toBe('#aa0000');
	});

	it('renders shape and proposedShape polygons when given', () => {
		const shape = [
			{ x: -1, y: -1 },
			{ x: 3, y: -1 },
			{ x: 3, y: 3 }
		];
		const { container } = render(SeatLayoutPreview, {
			seats: [{ key: '0-0', x: 0, y: 0, categoryColor: null }],
			shape,
			proposedShape: shape
		});
		expect(container.querySelectorAll('polygon')).toHaveLength(2);
	});
});
