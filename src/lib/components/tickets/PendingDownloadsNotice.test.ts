import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import PendingDownloadsNotice from './PendingDownloadsNotice.svelte';

describe('PendingDownloadsNotice', () => {
	it('renders the short label with the full detail available to screen readers', () => {
		render(PendingDownloadsNotice);
		const trigger = screen.getByRole('button', { name: /Pending payment confirmation/ });
		// The tooltip detail is also present as sr-only text, so screen readers
		// get the full explanation without hovering.
		expect(trigger.textContent).toContain('valid only once your payment is confirmed');
	});
});
