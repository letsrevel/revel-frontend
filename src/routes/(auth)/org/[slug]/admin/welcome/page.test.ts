import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { invalidateAll } from '$app/navigation';
import { organizationadmincoreStripeAccountVerify } from '$lib/api/generated/sdk.gen';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadmincoreUpdateOrganization: vi.fn(),
	organizationadmincoreStripeConnect: vi.fn(),
	organizationadmincoreStripeAccountVerify: vi.fn()
}));

function setup(setupCounts: unknown) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient(),
			component: Page,
			componentProps: {
				data: {
					organization: {
						id: 'o1',
						slug: 'acme',
						name: 'Acme',
						visibility: 'private',
						contact_email: null
					},
					setupCounts
				}
			}
		}
	});
}

describe('launchpad headline follows progress', () => {
	it('none: original title and subtitle', () => {
		setup({ eventCount: 0, publishedCount: 0, latestDraft: null });
		expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
			'Now put something on the calendar'
		);
		expect(screen.getByText('Start with the event. Payments can follow.')).toBeTruthy();
	});

	it('draft: waiting title and next-steps subtitle', () => {
		setup({ eventCount: 1, publishedCount: 0, latestDraft: { id: 'e', name: 'D' } });
		expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
			'Your first event is waiting'
		);
		expect(screen.getByText("Finish the last steps whenever you're ready.")).toBeTruthy();
	});

	it('published: live title', () => {
		setup({ eventCount: 1, publishedCount: 1, latestDraft: null });
		expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
			'Your first event is live'
		);
	});

	it('later links render as a list (separators are CSS only)', () => {
		setup({ eventCount: 0, publishedCount: 0, latestDraft: null });
		const list = screen.getByRole('link', { name: 'add a logo' }).closest('ul') as HTMLElement;
		expect(list.querySelectorAll('li a').length).toBe(3);
		expect(list.textContent).not.toContain('·');
	});
});

describe('Stripe return params', () => {
	const counts = { eventCount: 0, publishedCount: 0, latestDraft: null };
	afterEach(() => window.history.replaceState({}, '', '/'));
	beforeEach(() => vi.clearAllMocks());

	it('stripe_success: verifies, invalidates, strips the param, shows success', async () => {
		window.history.replaceState({}, '', '/org/acme/admin/welcome?stripe_success=true&x=1');
		vi.mocked(organizationadmincoreStripeAccountVerify).mockResolvedValue({
			data: { charges_enabled: true, details_submitted: true }
		} as never);
		setup(counts);
		const status = await screen.findByTestId('stripe-return-notice');
		expect(status.textContent).toContain('Stripe is connected.');
		expect(organizationadmincoreStripeAccountVerify).toHaveBeenCalledOnce();
		expect(invalidateAll).toHaveBeenCalled();
		expect(window.location.search).toBe('?x=1');
	});

	it('stripe_success with charges disabled: needs-details notice', async () => {
		window.history.replaceState({}, '', '/org/acme/admin/welcome?stripe_success=true');
		vi.mocked(organizationadmincoreStripeAccountVerify).mockResolvedValue({
			data: { charges_enabled: false, details_submitted: false }
		} as never);
		setup(counts);
		expect((await screen.findByTestId('stripe-return-notice')).textContent).toContain(
			'Stripe still needs a few details'
		);
		expect(window.location.search).toBe('');
	});

	it('stripe_refresh: notice with continue button, no verify, dismissible', async () => {
		window.history.replaceState({}, '', '/org/acme/admin/welcome?stripe_refresh=true');
		const user = userEvent.setup();
		setup(counts);
		const status = await screen.findByTestId('stripe-return-notice');
		expect(status.textContent).toContain('Your Stripe setup link expired.');
		expect(organizationadmincoreStripeAccountVerify).not.toHaveBeenCalled();
		expect(window.location.search).toBe('');
		await user.click(screen.getByRole('button', { name: 'Continue Stripe setup' }));
		expect(await screen.findByRole('button', { name: 'Connect to Stripe' })).toBeTruthy();
		await user.click(screen.getByRole('button', { name: 'Dismiss notice' }));
		await waitFor(() => expect(screen.queryByTestId('stripe-return-notice')).toBeNull());
	});

	it('no params: no notice', () => {
		setup(counts);
		expect(screen.queryByTestId('stripe-return-notice')).toBeNull();
	});
});
