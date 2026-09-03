import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import ClubsPanel from './ClubsPanel.svelte';
import * as m from '$lib/paraglide/messages.js';

describe('ClubsPanel', () => {
	it('renders the clubs headline, pills, and the membership card mock', () => {
		render(ClubsPanel);
		expect(screen.getByText(m['home.poster.clubsH1']())).toBeInTheDocument();
		expect(screen.getByText(m['home.poster.clubsPill2']())).toBeInTheDocument();
		expect(
			screen.getByRole('img', { name: m['home.poster.memberMockAria']() })
		).toBeInTheDocument();
	});

	it('keeps the mock decorative: one role=img, no inner text exposed to AT', () => {
		render(ClubsPanel);
		const img = screen.getByRole('img', { name: m['home.poster.memberMockAria']() });
		// Every inner layer is aria-hidden, so the tier name is not an accessible node.
		expect(screen.queryByRole('heading', { name: m['home.poster.memberMockTier']() })).toBeNull();
		expect(img.querySelector('[aria-hidden="true"]')).not.toBeNull();
	});
});
