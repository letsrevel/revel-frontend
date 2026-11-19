import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import * as m from '$lib/paraglide/messages.js';
import UnknownHolderBadge from './UnknownHolderBadge.svelte';

describe('UnknownHolderBadge', () => {
	it('renders a neutral badge named by its content, with the full sentence for screen readers', () => {
		render(UnknownHolderBadge);
		const badge = screen.getByTestId('unknown-holder-badge');
		expect(badge).toHaveTextContent(m['unknownHolder.badge']());
		expect(badge).toHaveTextContent(m['unknownHolder.srLabel']());
		expect(badge).not.toHaveAttribute('aria-label');
		expect(screen.queryByTestId('unknown-holder-explanation')).not.toBeInTheDocument();
	});

	it('shows the plain-text explanation when asked', () => {
		render(UnknownHolderBadge, { props: { showExplanation: true } });
		expect(screen.getByTestId('unknown-holder-explanation')).toHaveTextContent(
			m['unknownHolder.explanation']()
		);
	});
});
