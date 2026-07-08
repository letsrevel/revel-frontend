import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import SeriesPassBadge from './SeriesPassBadge.svelte';

describe('SeriesPassBadge', () => {
	const seriesPass = {
		held_pass_id: 'held-1',
		series_pass_id: 'pass-1',
		name: 'Full course'
	};

	it('renders the season pass label', () => {
		render(SeriesPassBadge, { props: { seriesPass } });
		// Both the visible label and the sr-only tooltip text match.
		expect(screen.getAllByText(/season pass/i).length).toBeGreaterThan(0);
	});

	it('names the pass in the tooltip', () => {
		render(SeriesPassBadge, { props: { seriesPass } });
		expect(screen.getByTitle(/full course/i)).toBeInTheDocument();
	});
});
