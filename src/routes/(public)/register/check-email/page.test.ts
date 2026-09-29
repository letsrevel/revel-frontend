import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Page from './+page.svelte';
import { accountResendVerificationEmail } from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	accountResendVerificationEmail: vi.fn()
}));

// `$app/stores`'s real `page` reflects nothing outside a SvelteKit navigation,
// so a minimal store-shaped stand-in serves the URL each test sets.
const pageState = vi.hoisted(() => ({ url: new URL('http://localhost/register/check-email') }));
vi.mock('$app/stores', () => ({
	page: {
		subscribe(fn: (v: { url: URL }) => void) {
			fn({ url: pageState.url });
			return () => {
				// no-op: the URL never changes after render
			};
		}
	}
}));

type ResendResult = Awaited<ReturnType<typeof accountResendVerificationEmail>>;

async function resendFrom(query: string): Promise<Record<string, unknown>> {
	pageState.url = new URL(`http://localhost/register/check-email?${query}`);
	render(Page);
	await userEvent.click(screen.getByRole('button', { name: /resend/i }));
	await waitFor(() => expect(accountResendVerificationEmail).toHaveBeenCalledTimes(1));
	const [options] = vi.mocked(accountResendVerificationEmail).mock.calls[0];
	return options.body as Record<string, unknown>;
}

describe('check-email resend keeps the returnUrl (#978)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(accountResendVerificationEmail).mockResolvedValue({
			data: { message: 'Verification email sent.' },
			error: undefined
		} as unknown as ResendResult);
	});

	it('sends return_url when the page carries a safe returnUrl', async () => {
		const body = await resendFrom('email=a%40example.com&returnUrl=%2Fevents%2Fx');
		expect(body).toEqual({ email: 'a@example.com', return_url: '/events/x' });
	});

	it('omits return_url when there is no returnUrl', async () => {
		const body = await resendFrom('email=a%40example.com');
		expect(body).toEqual({ email: 'a@example.com' });
		expect(body).not.toHaveProperty('return_url');
	});

	it('drops an unsafe returnUrl', async () => {
		const body = await resendFrom(
			`email=a%40example.com&returnUrl=${encodeURIComponent('https://evil.example')}`
		);
		expect(body).toEqual({ email: 'a@example.com' });
		expect(body).not.toHaveProperty('return_url');
	});
});
