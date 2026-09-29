import { render, screen, waitFor, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { OAuthConnectionSchema } from '$lib/api/generated/types.gen';
import Page from './+page.svelte';

const listConnectionsMock = vi.hoisted(() => vi.fn());
const revokeMock = vi.hoisted(() => vi.fn());
const listScopesMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('$lib/api/generated/sdk.gen', () => ({
	oauthconnectionListConnections: listConnectionsMock,
	oauthconnectionRevoke: revokeMock,
	oauthscopeListScopes: listScopesMock
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));
vi.mock('svelte-sonner', () => ({ toast: toastMock }));

const VOCAB = [
	{ name: 'openid', label: 'Sign you in', group: 'identity' },
	{ name: 'org:tickets', label: 'Manage tickets and refunds', group: 'org' }
];

function connection(name: string, clientId: string): OAuthConnectionSchema {
	return {
		client_id: clientId,
		application: {
			name,
			description: '',
			logo_url: null,
			verified: false,
			registration_source: 'manual',
			homepage_url: '',
			privacy_policy_url: ''
		},
		scopes: ['org:tickets', 'openid'],
		first_authorized_at: '2026-09-01T10:00:00Z',
		last_used_at: '2026-09-02T12:30:00Z'
	};
}

const ok = <T>(data: T) => ({ data, error: undefined, response: { status: 200 } });
const notFound = { data: undefined, error: { detail: 'Not found.' }, response: { status: 404 } };

describe('Connected apps page', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		listConnectionsMock.mockReset();
		revokeMock.mockReset();
		listScopesMock.mockReset();
		toastMock.success.mockReset();
		toastMock.error.mockReset();
		listScopesMock.mockResolvedValue(ok(VOCAB));
	});

	function renderPage() {
		return render(QueryClientTestWrapper, {
			props: { client: queryClient, component: Page, componentProps: {} }
		});
	}

	it('renders one card per connection with vocabulary-ordered labels', async () => {
		listConnectionsMock.mockResolvedValue(ok([connection('Acme', 'a'), connection('Beta', 'b')]));
		renderPage();
		const cards = await screen.findAllByRole('article');
		expect(
			cards.map(
				(c) =>
					c.getAttribute('aria-labelledby') &&
					within(c).getByRole('heading', { level: 3 }).textContent
			)
		).toEqual(['Acme', 'Beta']);
		expect(within(cards[0]).getAllByRole('listitem')[0]).toHaveTextContent('Sign you in');
		expect(
			screen.getByText('Changing your email address disconnects every app.')
		).toBeInTheDocument();
	});

	it('shows the empty state only when the list is genuinely empty', async () => {
		listConnectionsMock.mockResolvedValue(ok([]));
		renderPage();
		expect(await screen.findByText('No apps are connected to your account.')).toBeInTheDocument();
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('shows the load error, not the empty state, when a query 404s', async () => {
		listConnectionsMock.mockResolvedValue(notFound);
		renderPage();
		expect(await screen.findByRole('alert')).toHaveTextContent(
			"We couldn't load your connected apps."
		);
		expect(screen.queryByText('No apps are connected to your account.')).toBeNull();
	});

	it('shows the load error when only the vocabulary fails', async () => {
		listConnectionsMock.mockResolvedValue(ok([connection('Acme', 'a')]));
		listScopesMock.mockResolvedValue(notFound);
		renderPage();
		expect(await screen.findByRole('alert')).toBeInTheDocument();
		expect(screen.queryByRole('article')).toBeNull();
	});

	it('Remove → confirm → DELETE by client_id → list refetched → toast', async () => {
		listConnectionsMock
			.mockResolvedValueOnce(ok([connection('Acme', 'cid-a')]))
			.mockResolvedValueOnce(ok([]));
		revokeMock.mockResolvedValue({ data: undefined, error: undefined, response: { status: 204 } });
		renderPage();
		await userEvent.click(await screen.findByRole('button', { name: 'Remove Acme' }));
		const dialog = await screen.findByRole('dialog');
		expect(dialog).toHaveTextContent('Disconnect Acme?');
		await userEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
		await waitFor(() => expect(revokeMock).toHaveBeenCalledWith({ path: { client_id: 'cid-a' } }));
		await waitFor(() => expect(listConnectionsMock).toHaveBeenCalledTimes(2));
		expect(await screen.findByText('No apps are connected to your account.')).toBeInTheDocument();
		expect(toastMock.success).toHaveBeenCalledWith('Acme was disconnected.');
	});

	it('Cancel closes the dialog without calling DELETE', async () => {
		listConnectionsMock.mockResolvedValue(ok([connection('Acme', 'cid-a')]));
		renderPage();
		await userEvent.click(await screen.findByRole('button', { name: 'Remove Acme' }));
		const dialog = await screen.findByRole('dialog');
		await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(revokeMock).not.toHaveBeenCalled();
	});

	it('a failed DELETE keeps the card and shows an error toast', async () => {
		listConnectionsMock.mockResolvedValue(ok([connection('Acme', 'cid-a')]));
		revokeMock.mockResolvedValue(notFound);
		renderPage();
		await userEvent.click(await screen.findByRole('button', { name: 'Remove Acme' }));
		await userEvent.click(
			within(await screen.findByRole('dialog')).getByRole('button', { name: 'Disconnect' })
		);
		await waitFor(() =>
			expect(toastMock.error).toHaveBeenCalledWith(
				"We couldn't disconnect this app. Please try again."
			)
		);
		expect(screen.getByRole('article', { name: 'Acme' })).toBeInTheDocument();
		expect(screen.queryByRole('dialog')).toBeNull();
	});
	it('a failed DELETE refetches the list so an already-gone app disappears', async () => {
		listConnectionsMock
			.mockResolvedValueOnce(ok([connection('Acme', 'cid-a')]))
			.mockResolvedValue(ok([]));
		revokeMock.mockResolvedValue(notFound);
		renderPage();
		await userEvent.click(await screen.findByRole('button', { name: 'Remove Acme' }));
		await userEvent.click(
			within(await screen.findByRole('dialog')).getByRole('button', { name: 'Disconnect' })
		);
		await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
		expect(await screen.findByText('No apps are connected to your account.')).toBeInTheDocument();
	});

	it("settling app A does not close app B's dialog opened meanwhile", async () => {
		listConnectionsMock.mockResolvedValue(
			ok([connection('Acme', 'cid-a'), connection('Beta', 'cid-b')])
		);
		let resolveA: ((value: unknown) => void) | undefined;
		revokeMock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveA = resolve;
				})
		);
		renderPage();
		await userEvent.click(await screen.findByRole('button', { name: 'Remove Acme' }));
		await userEvent.click(
			within(await screen.findByRole('dialog')).getByRole('button', { name: 'Disconnect' })
		);
		await waitFor(() => expect(revokeMock).toHaveBeenCalledWith({ path: { client_id: 'cid-a' } }));
		await userEvent.click(
			within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' })
		);
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		await userEvent.click(screen.getByRole('button', { name: 'Remove Beta' }));
		expect(await screen.findByRole('dialog')).toHaveTextContent('Disconnect Beta?');

		resolveA?.({ data: undefined, error: undefined, response: { status: 204 } });
		await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Acme was disconnected.'));
		expect(screen.getByRole('dialog')).toHaveTextContent('Disconnect Beta?');

		revokeMock.mockResolvedValue({ data: undefined, error: undefined, response: { status: 204 } });
		await userEvent.click(
			within(screen.getByRole('dialog')).getByRole('button', { name: 'Disconnect' })
		);
		await waitFor(() => expect(revokeMock).toHaveBeenCalledWith({ path: { client_id: 'cid-b' } }));
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	});
});
