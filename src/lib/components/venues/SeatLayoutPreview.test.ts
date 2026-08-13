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

	// Baked positions never flip under invertRowOrder, so an inverted sector's
	// front row (rank 0, the stage-adjacent one) carries the LARGEST y. The
	// stage bar has to move to the bottom edge to match — seat coordinates stay
	// exactly where the bake put them in both cases.
	describe('stage bar placement', () => {
		const seats = [
			{ key: '0-0', x: 0, y: 0, categoryColor: null },
			{ key: '1-0', x: 0, y: 1, categoryColor: null }
		];
		const stageOf = (container: HTMLElement) => {
			const rect = container.querySelector('[data-testid="preview-stage"]');
			const viewBox = container.querySelector('svg')?.getAttribute('viewBox')?.split(' ') ?? [];
			return {
				y: Number(rect?.getAttribute('y')),
				height: Number(rect?.getAttribute('height')),
				vbY: Number(viewBox[1]),
				vbH: Number(viewBox[3])
			};
		};

		it('pins the stage to the TOP edge for a normal sector', () => {
			const { container } = render(SeatLayoutPreview, { seats });
			const stage = stageOf(container);
			expect(stage.y).toBe(stage.vbY);
			// Every seat sits below the bar.
			for (const circle of container.querySelectorAll('circle')) {
				expect(Number(circle.getAttribute('cy'))).toBeGreaterThan(stage.y + stage.height);
			}
		});

		it('pins the stage to the BOTTOM edge for an inverted sector', () => {
			const { container } = render(SeatLayoutPreview, { seats, invertRowOrder: true });
			const stage = stageOf(container);
			expect(stage.y).toBe(stage.vbY + stage.vbH - stage.height);
			// Every seat sits above the bar — including the max-y front row.
			for (const circle of container.querySelectorAll('circle')) {
				expect(Number(circle.getAttribute('cy'))).toBeLessThan(stage.y);
			}
		});

		it('leaves seat coordinates untouched by the inversion', () => {
			const cys = (invertRowOrder: boolean) =>
				[
					...render(SeatLayoutPreview, { seats, invertRowOrder }).container.querySelectorAll(
						'circle'
					)
				].map((c) => c.getAttribute('cy'));
			expect(cys(true)).toEqual(cys(false));
		});
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
