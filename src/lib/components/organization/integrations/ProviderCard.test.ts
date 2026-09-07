import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import ProviderCard from './ProviderCard.svelte';
import type { ConnectionSchema } from '$lib/api/generated/types.gen';
import {
	organizationintegrationsAccounts,
	organizationintegrationsConnect,
	organizationintegrationsDisconnect,
	organizationintegrationsUpdate
} from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	organizationintegrationsAccounts: vi.fn(),
	organizationintegrationsRemoteEvents: vi.fn().mockResolvedValue({ data: [], error: undefined }),
	organizationintegrationsConnect: vi.fn(),
	organizationintegrationsDisconnect: vi.fn(),
	organizationintegrationsUpdate: vi.fn()
}));

type ConnectResult = Awaited<ReturnType<typeof organizationintegrationsConnect>>;
type DisconnectResult = Awaited<ReturnType<typeof organizationintegrationsDisconnect>>;
type UpdateResult = Awaited<ReturnType<typeof organizationintegrationsUpdate>>;
type AccountsResult = Awaited<ReturnType<typeof organizationintegrationsAccounts>>;

function conn(overrides: Partial<ConnectionSchema> = {}): ConnectionSchema {
	return { provider: 'eventbrite', display_name: 'Eventbrite', status: null, ...overrides };
}

function renderCard(connection: ConnectionSchema, onChanged = vi.fn()) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: ProviderCard,
			componentProps: { organizationSlug: 'acme', connection, onChanged }
		}
	});
	return { onChanged };
}

describe('ProviderCard', () => {
	beforeEach(() => {
		vi.mocked(organizationintegrationsConnect).mockResolvedValue({
			data: { authorize_url: 'https://www.eventbrite.com/oauth/authorize?x=1' },
			error: undefined,
			response: { ok: true } as Response
		} as unknown as ConnectResult);
		vi.mocked(organizationintegrationsDisconnect).mockResolvedValue({
			data: { ok: true },
			error: undefined,
			response: { ok: true } as Response
		} as unknown as DisconnectResult);
		vi.mocked(organizationintegrationsUpdate).mockResolvedValue({
			data: conn({ status: 'active', auto_sync: true }),
			error: undefined,
			response: { ok: true } as Response
		} as unknown as UpdateResult);
		vi.mocked(organizationintegrationsAccounts).mockResolvedValue({
			data: [],
			error: undefined,
			response: { ok: true } as Response
		} as unknown as AccountsResult);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('offers Connect when not connected and navigates to the authorize URL', async () => {
		const user = userEvent.setup();
		const assign = vi.fn();
		vi.stubGlobal('location', { ...window.location, assign });
		renderCard(conn());
		expect(screen.getByText(/receives a copy/)).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Connect Eventbrite' }));
		await waitFor(() =>
			expect(assign).toHaveBeenCalledWith('https://www.eventbrite.com/oauth/authorize?x=1')
		);
	});

	it('shows who is connected, the auto-sync toggle and Disconnect when active', () => {
		renderCard(
			conn({
				status: 'active',
				remote_account_name: 'Acme Events',
				auto_sync: false,
				connected_at: '2026-09-01T10:00:00Z'
			})
		);
		expect(screen.getByText('Connected as Acme Events')).toBeInTheDocument();
		expect(screen.getByText(/since /)).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: /up to date automatically/ })).not.toBeChecked();
		expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Import from Eventbrite' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Connect Eventbrite' })).toBeNull();
	});

	it('sends the auto-sync change and reports it', async () => {
		const user = userEvent.setup();
		const { onChanged } = renderCard(conn({ status: 'active', auto_sync: false }));
		await user.click(screen.getByRole('checkbox', { name: /up to date automatically/ }));
		await waitFor(() =>
			expect(vi.mocked(organizationintegrationsUpdate)).toHaveBeenCalledWith(
				expect.objectContaining({ body: { auto_sync: true } })
			)
		);
		await waitFor(() => expect(onChanged).toHaveBeenCalled());
	});

	it('warns when live updates are off', () => {
		renderCard(
			conn({
				status: 'active',
				last_error: { detail: 'x', code: 'webhook_registration_failed', provider_message: null }
			})
		);
		expect(screen.getByText(/refresh every 15 minutes/)).toBeInTheDocument();
	});

	it('offers Reconnect when access was lost', () => {
		renderCard(
			conn({
				status: 'error',
				last_error: { detail: 'x', code: 'connection_revoked', provider_message: null }
			})
		);
		expect(screen.getByText(/lost access/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument();
	});

	it('confirms before disconnecting, then disconnects', async () => {
		const user = userEvent.setup();
		const { onChanged } = renderCard(conn({ status: 'active' }));
		await user.click(screen.getByRole('button', { name: 'Disconnect' }));
		const dialog = screen.getByRole('dialog');
		expect(dialog).toHaveTextContent('remove Revel under Apps');
		await user.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
		await waitFor(() => expect(vi.mocked(organizationintegrationsDisconnect)).toHaveBeenCalled());
		await waitFor(() => expect(onChanged).toHaveBeenCalled());
	});

	it('mounts the account picker when pending', async () => {
		renderCard(conn({ status: 'pending' }));
		expect(screen.getByText('Choose an account')).toBeInTheDocument();
		await waitFor(() => expect(screen.getByText(/returned no accounts/)).toBeInTheDocument());
	});

	it('shows the mapped error and the platform detail when connect is refused', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationintegrationsConnect).mockResolvedValue({
			data: undefined,
			error: { detail: 'x', code: 'already_connected', provider_message: 'raw words' },
			response: { ok: false } as Response
		} as unknown as ConnectResult);
		renderCard(conn());
		await user.click(screen.getByRole('button', { name: 'Connect Eventbrite' }));
		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Eventbrite is already connected.');
		expect(alert).toHaveTextContent('raw words');
	});
});
