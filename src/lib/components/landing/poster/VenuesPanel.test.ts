import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import VenuesPanel from './VenuesPanel.svelte';
import * as m from '$lib/paraglide/messages.js';

describe('VenuesPanel', () => {
	it('renders venue headline, pills, and the seat map mock', () => {
		render(VenuesPanel);
		expect(screen.getByText(m['home.poster.venuesH1']())).toBeInTheDocument();
		expect(screen.getByText(m['home.poster.venuesPill2']())).toBeInTheDocument();
		expect(screen.getByRole('img', { name: m['home.poster.seatMockAria']() })).toBeInTheDocument();
	});
});
