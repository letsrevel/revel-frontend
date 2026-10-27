import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

vi.mock('$lib/api/client', () => ({ client: {} }));
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadmincoreStripeAccountVerify: vi.fn().mockResolvedValue({ data: undefined })
}));

import StripeConnect from './StripeConnect.svelte';

const HREF = '/org/acme/admin/welcome';

function renderIt(continueSetupHref?: string | null) {
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: StripeConnect,
			componentProps: {
				organizationSlug: 'acme',
				stripeChargesEnabled: false,
				stripeDetailsSubmitted: false,
				stripeAccountId: null,
				stripeAccountEmail: null,
				accessToken: 'tok',
				continueSetupHref
			}
		}
	});
}

describe('StripeConnect continue-setup link', () => {
	afterEach(() => {
		window.history.replaceState({}, '', '/');
	});

	it('shows the link after returning from Stripe when an href is given', () => {
		window.history.replaceState({}, '', '/org/acme/admin/settings?stripe_success=true');
		renderIt(HREF);
		expect(screen.getByRole('link', { name: 'Continue setup' })).toHaveAttribute('href', HREF);
	});

	it('shows no link without the prop', () => {
		window.history.replaceState({}, '', '/org/acme/admin/settings?stripe_success=true');
		renderIt();
		expect(screen.queryByRole('link', { name: 'Continue setup' })).toBeNull();
	});

	it('shows no link when not returning from Stripe', () => {
		renderIt(HREF);
		expect(screen.queryByRole('link', { name: 'Continue setup' })).toBeNull();
	});
});
