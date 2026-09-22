import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import McQuestionChart from './McQuestionChart.svelte';

// Screenshot bug: bars were scaled to the most-picked answer, so a 30% answer
// with a 40% leader drew a 75%-wide bar next to a "30%" label.
describe('McQuestionChart — bar widths', () => {
	it('sizes each bar by its share of all responses, matching the label', () => {
		render(McQuestionChart, {
			props: {
				questionText: 'Pick one',
				options: [
					{ option_id: 'a', option_text: 'A', is_correct: false, count: 4 },
					{ option_id: 'b', option_text: 'B', is_correct: false, count: 3 },
					{ option_id: 'c', option_text: 'C', is_correct: true, count: 3 }
				]
			}
		});
		const bars = screen.getAllByRole('img');
		expect(bars.map((bar) => bar.style.width)).toEqual(['40%', '30%', '30%']);
		expect(screen.getByText('4 (40%)')).toBeInTheDocument();
	});

	it('draws empty bars when nobody answered', () => {
		render(McQuestionChart, {
			props: {
				questionText: 'Pick one',
				options: [{ option_id: 'a', option_text: 'A', is_correct: false, count: 0 }]
			}
		});
		expect(screen.getByRole('img').style.width).toBe('0%');
	});
});
