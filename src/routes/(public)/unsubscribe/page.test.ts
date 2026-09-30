import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import UnsubscribePage from './+page.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { buildSeo } from '$lib/seo';
import type { UnsubscribeTokenInfo } from '$lib/utils/unsubscribe-token';

vi.mock('$lib/api', () => ({
	oneclickunsubscribeOneClick: vi.fn(),
	notificationpreferenceUnsubscribe: vi.fn(),
	notificationpreferenceUpdatePreferences: vi.fn(),
	telegramGetLinkStatus: vi.fn().mockResolvedValue({ data: { connected: false } })
}));

vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const seo = buildSeo({
	kind: 'auth',
	url: new URL('https://letsrevel.io/unsubscribe'),
	lang: 'en',
	page: 'unsubscribe'
});

function renderPage(tokenInfo: UnsubscribeTokenInfo, token: string | null = 'tok'): void {
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({
				defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
			}),
			component: UnsubscribePage,
			componentProps: { data: { token, tokenInfo, seo } }
		}
	});
}

const accountToken = (
	notificationType: string | null = null,
	organizationId: string | null = null
): UnsubscribeTokenInfo => ({
	status: 'valid',
	kind: 'unsubscribe',
	email: 'ada@example.com',
	notificationType,
	organizationId
});

describe('unsubscribe page (#982)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it.each([
		['missing', { status: 'missing' } as const],
		['malformed', { status: 'invalid' } as const],
		['expired', { status: 'expired' } as const]
	])('shows the invalid-link state on load for a %s token', (_label, info) => {
		renderPage(info);
		expect(
			screen.getByRole('heading', { level: 1, name: /invalid or expired link/i })
		).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /log in to manage preferences/i })).toHaveAttribute(
			'href',
			expect.stringContaining('returnUrl=%2Faccount%2Fsettings')
		);
		expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
	});

	it('explains which email keeps arriving and defaults silence to off', () => {
		renderPage(accountToken());
		expect(screen.getByRole('heading', { name: /some emails always arrive/i })).toBeInTheDocument();
		expect(screen.getByText(/tickets, receipts, payment and refund notices/i)).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: /silence all notifications/i })).not.toBeChecked();
		expect(screen.getByRole('checkbox', { name: /^email$/i })).not.toBeChecked();
		// No scoped shortcut without a notification type
		expect(screen.queryByRole('button', { name: /stop these/i })).not.toBeInTheDocument();
	});

	it('swaps to the invalid-link state when the backend rejects the token on submit', async () => {
		const user = userEvent.setup();
		const { notificationpreferenceUnsubscribe } = await import('$lib/api');
		vi.mocked(notificationpreferenceUnsubscribe).mockResolvedValue({
			data: undefined,
			error: { detail: 'This unsubscribe link is no longer valid.' },
			response: { status: 400 } as Response
		} as never);

		renderPage(accountToken());
		await user.click(screen.getByRole('button', { name: /save changes/i }));

		const heading = await screen.findByRole('heading', {
			level: 1,
			name: /invalid or expired link/i
		});
		await waitFor(() => expect(heading).toHaveFocus());
	});

	it('offers a one-click stop scoped to the email type', async () => {
		const user = userEvent.setup();
		const { oneclickunsubscribeOneClick } = await import('$lib/api');
		vi.mocked(oneclickunsubscribeOneClick).mockResolvedValue({
			data: { message: 'You have been unsubscribed.' },
			error: undefined,
			response: { status: 200 } as Response
		} as never);

		renderPage(accountToken('event_reminder'));
		await user.click(screen.getByRole('button', { name: /stop these emails/i }));

		expect(oneclickunsubscribeOneClick).toHaveBeenCalledWith({ query: { token: 'tok' } });
		const message = await screen.findByText(/won't get these emails anymore/i);
		// Focus follows the swap (the clicked button is gone); no auto-redirect.
		await waitFor(() => expect(message.closest('[tabindex="-1"]')).toHaveFocus());
		expect(screen.getByRole('link', { name: /go to homepage/i })).toHaveAttribute('href', '/');
	});

	it('words the one-click stop as an org mute for organization announcements', () => {
		renderPage(accountToken('org_announcement', 'org-1'));
		expect(screen.getByRole('button', { name: /stop these announcements/i })).toBeInTheDocument();
		expect(screen.getByText(/from this organization only/i)).toBeInTheDocument();
	});

	it('confirms an invitation opt-out for an address without an account', async () => {
		const user = userEvent.setup();
		const { oneclickunsubscribeOneClick, notificationpreferenceUnsubscribe } =
			await import('$lib/api');
		vi.mocked(oneclickunsubscribeOneClick).mockResolvedValue({
			data: { message: 'You have been unsubscribed.' },
			error: undefined,
			response: { status: 200 } as Response
		} as never);

		renderPage({
			status: 'valid',
			kind: 'email_opt_out',
			email: 'guest@example.com',
			organizationId: null
		});

		expect(screen.getByText(/revel organizers to guest@example\.com/i)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /stop invitation emails/i }));

		expect(oneclickunsubscribeOneClick).toHaveBeenCalledWith({ query: { token: 'tok' } });
		expect(notificationpreferenceUnsubscribe).not.toHaveBeenCalled();
		expect(
			await screen.findByText(/won't send invitation emails to guest@example\.com/i)
		).toBeInTheDocument();
	});

	it('shows the invalid-link state when the opt-out token is rejected', async () => {
		const user = userEvent.setup();
		const { oneclickunsubscribeOneClick } = await import('$lib/api');
		vi.mocked(oneclickunsubscribeOneClick).mockResolvedValue({
			data: undefined,
			error: { detail: 'Token has expired.' },
			response: { status: 400 } as Response
		} as never);

		renderPage({
			status: 'valid',
			kind: 'email_opt_out',
			email: 'guest@example.com',
			organizationId: null
		});
		await user.click(screen.getByRole('button', { name: /stop invitation emails/i }));

		expect(
			await screen.findByRole('heading', { level: 1, name: /invalid or expired link/i })
		).toBeInTheDocument();
	});
});
