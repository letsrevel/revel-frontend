import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadmincoreStripeConnect: vi.fn()
}));
import { organizationadmincoreStripeConnect } from '$lib/api/generated/sdk.gen';
import { requestStripeOnboardingLink } from './stripe-connect';

const call = vi.mocked(organizationadmincoreStripeConnect);

describe('requestStripeOnboardingLink', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns the onboarding url and sends slug, auth and email', async () => {
		call.mockResolvedValue({ data: { onboarding_url: 'https://stripe.test/x' } } as never);
		await expect(requestStripeOnboardingLink('acme', 'a@b.test', 'tok')).resolves.toBe(
			'https://stripe.test/x'
		);
		expect(call).toHaveBeenCalledWith({
			path: { slug: 'acme' },
			headers: { Authorization: 'Bearer tok' },
			body: { email: 'a@b.test', return_to: 'settings' }
		});
	});

	it('forwards return_to welcome', async () => {
		call.mockResolvedValue({ data: { onboarding_url: 'u' } } as never);
		await requestStripeOnboardingLink('acme', 'a@b.test', 'tok', 'welcome');
		expect(call).toHaveBeenCalledWith(
			expect.objectContaining({ body: { email: 'a@b.test', return_to: 'welcome' } })
		);
	});

	it('throws the extracted detail on error', async () => {
		call.mockResolvedValue({ error: { detail: 'Not allowed here' } } as never);
		await expect(requestStripeOnboardingLink('acme', 'a@b.test', 'tok')).rejects.toThrow(
			'Not allowed here'
		);
	});

	it('throws the fallback text when data is empty', async () => {
		call.mockResolvedValue({} as never);
		await expect(requestStripeOnboardingLink('acme', 'a@b.test', 'tok')).rejects.toThrow(
			'Failed to create Stripe Connect link'
		);
	});
});
