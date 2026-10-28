import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { invalidateAll } from '$app/navigation';
import { organizationadmincoreStripeAccountVerify } from '$lib/api/generated/sdk.gen';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn(), goto: vi.fn() }));
vi.mock('$app/stores', async () => {
	const { readable } = await import('svelte/store');
	return {
		page: readable({
			url: new URL('http://localhost/org/acme/admin/events/e1/edit'),
			data: { organization: { id: 'o1', slug: 'acme', name: 'Acme', contact_email: 'o@acme.test' } }
		})
	};
});
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadmincoreStripeAccountVerify: vi.fn(),
	eventadmincoreUpdateEventStatus: vi.fn(),
	eventadmincoreDeleteEvent: vi.fn(),
	eventadmincoreCancellationRefundPreview: vi.fn()
}));
vi.mock('$lib/components/events/admin/EventEditor.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
vi.mock('$lib/components/events/admin/DuplicateEventModal.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
vi.mock('$lib/components/events/admin/CancelEventDialog.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
vi.mock('$lib/components/events/admin/editor/PublishShareCard.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));

function setup() {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient(),
			component: Page,
			componentProps: {
				data: {
					event: { id: 'e1', name: 'Party', status: 'draft', slug: 'party' },
					isOwner: true
				}
			}
		}
	});
}

describe('Stripe return params on the event edit page', () => {
	const url = '/org/acme/admin/events/e1/edit';
	afterEach(() => window.history.replaceState({}, '', '/'));
	beforeEach(() => vi.clearAllMocks());

	it('stripe_success: verifies, invalidates, strips params but keeps tab=ticketing', async () => {
		window.history.replaceState({}, '', `${url}?tab=ticketing&stripe_success=true`);
		vi.mocked(organizationadmincoreStripeAccountVerify).mockResolvedValue({
			data: { charges_enabled: true }
		} as never);
		setup();
		const notice = await screen.findByTestId('stripe-return-notice');
		expect(notice.textContent).toContain('Stripe is connected.');
		expect(organizationadmincoreStripeAccountVerify).toHaveBeenCalledOnce();
		expect(invalidateAll).toHaveBeenCalled();
		expect(window.location.search).toBe('?tab=ticketing');
	});

	it('stripe_success with charges disabled: needs-details notice', async () => {
		window.history.replaceState({}, '', `${url}?tab=ticketing&stripe_success=true`);
		vi.mocked(organizationadmincoreStripeAccountVerify).mockResolvedValue({
			data: { charges_enabled: false }
		} as never);
		setup();
		expect((await screen.findByTestId('stripe-return-notice')).textContent).toContain(
			'Stripe still needs a few details'
		);
	});

	it('stripe_refresh: expired notice with Continue, no verify, param stripped', async () => {
		window.history.replaceState({}, '', `${url}?tab=ticketing&stripe_refresh=true`);
		setup();
		const notice = await screen.findByTestId('stripe-return-notice');
		expect(notice.textContent).toContain('Your Stripe setup link expired.');
		expect(screen.getByRole('button', { name: 'Continue Stripe setup' })).toBeTruthy();
		expect(organizationadmincoreStripeAccountVerify).not.toHaveBeenCalled();
		expect(window.location.search).toBe('?tab=ticketing');
	});

	it('no params: no notice', () => {
		window.history.replaceState({}, '', `${url}?tab=ticketing`);
		setup();
		expect(screen.queryByTestId('stripe-return-notice')).toBeNull();
	});
});
