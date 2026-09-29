import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ConsentError from './ConsentError.svelte';

describe('ConsentError', () => {
	it('shows the headline, the detail and a back link', () => {
		render(ConsentError, {
			props: {
				headline: "This app asked for permissions it can't request.",
				detail: 'Scope org:nope is unknown.',
				onRetry: null
			}
		});
		expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
			"This app asked for permissions it can't request."
		);
		expect(screen.getByText('Scope org:nope is unknown.')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Back to Revel' })).toHaveAttribute(
			'href',
			'/dashboard'
		);
		expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
	});

	it('offers Retry only when a handler is given', async () => {
		const onRetry = vi.fn();
		render(ConsentError, { props: { headline: 'Something went wrong.', detail: null, onRetry } });
		await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(onRetry).toHaveBeenCalledOnce();
	});

	it('exposes a focusable headline', () => {
		render(ConsentError, { props: { headline: 'x', detail: null, onRetry: null } });
		expect(screen.getByTestId('consent-error-headline').getAttribute('tabindex')).toBe('-1');
	});
});
