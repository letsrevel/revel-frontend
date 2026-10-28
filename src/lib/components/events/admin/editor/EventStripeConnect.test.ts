import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/components/organization/stripe-connect', () => ({
	requestStripeOnboardingLink: vi.fn().mockRejectedValue(new Error('Boom'))
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));
import { requestStripeOnboardingLink } from '$lib/components/organization/stripe-connect';
import EventStripeConnect from './EventStripeConnect.svelte';

describe('EventStripeConnect', () => {
	beforeEach(() => vi.clearAllMocks());

	it('requests the link with return_to event and the event id, and shows errors', async () => {
		const user = userEvent.setup();
		render(EventStripeConnect, {
			props: { show: true, orgSlug: 'acme', eventId: 'e1', defaultEmail: 'o@acme.test' }
		});
		await user.click(screen.getByRole('button', { name: 'Connect to Stripe' }));
		expect(requestStripeOnboardingLink).toHaveBeenCalledWith(
			'acme',
			'o@acme.test',
			'tok',
			'event',
			'e1'
		);
		expect(await screen.findByText('Boom')).toBeTruthy();
	});

	it('runs beforeRedirect (stash) once the link is in hand, never on failure', async () => {
		const user = userEvent.setup();
		const beforeRedirect = vi.fn();
		const props = {
			show: true,
			orgSlug: 'acme',
			eventId: 'e1',
			defaultEmail: 'o@acme.test',
			beforeRedirect
		};
		vi.mocked(requestStripeOnboardingLink).mockRejectedValueOnce(new Error('Nope'));
		const { unmount } = render(EventStripeConnect, { props });
		await user.click(screen.getByRole('button', { name: 'Connect to Stripe' }));
		await screen.findByText('Nope');
		expect(beforeRedirect).not.toHaveBeenCalled();
		unmount();

		// The URL is the current page, so jsdom's navigation is a no-op.
		vi.mocked(requestStripeOnboardingLink).mockResolvedValueOnce(window.location.href);
		render(EventStripeConnect, { props });
		await user.click(screen.getByRole('button', { name: 'Connect to Stripe' }));
		await vi.waitFor(() => expect(beforeRedirect).toHaveBeenCalledOnce());
	});
});
