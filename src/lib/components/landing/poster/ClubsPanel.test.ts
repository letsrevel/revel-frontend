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

	it('keeps the mock decorative: one role=img whose inner text is aria-hidden', () => {
		render(ClubsPanel);
		const img = screen.getByRole('img', { name: m['home.poster.memberMockAria']() });
		// The tier name is in the DOM (visible) but must sit inside an aria-hidden
		// subtree of the role=img, so AT reads the single label and never the card.
		const tier = screen.getByText(m['home.poster.memberMockTier']());
		expect(img.contains(tier)).toBe(true);
		expect(tier.closest('[aria-hidden="true"]')).not.toBeNull();
		// Every direct child of the role=img is hidden — no layer leaks out.
		for (const child of Array.from(img.children)) {
			expect(child.getAttribute('aria-hidden')).toBe('true');
		}
	});
});
