import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { toast } from 'svelte-sonner';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { OAuthAppCreatedSchema } from '$lib/api/generated/types.gen';
import Page from './+page.svelte';

const sdk = vi.hoisted(() => ({
	oauthappActivate: vi.fn(),
	oauthappCreateApp: vi.fn(),
	oauthappDeactivate: vi.fn(),
	oauthappDeleteApp: vi.fn(),
	oauthappGetApp: vi.fn(),
	oauthappListApps: vi.fn(),
	oauthappRotateSecret: vi.fn(),
	oauthappUpdateApp: vi.fn(),
	oauthappUploadLogo: vi.fn(),
	oauthconnectionListConnections: vi.fn(),
	oauthconnectionRevoke: vi.fn(),
	oauthscopeListScopes: vi.fn()
}));
// Mutable so a test can flip the store user to unverified before rendering.
const authMock = vi.hoisted(() => ({
	authStore: { accessToken: 'tok', user: { email_verified: true } as { email_verified: boolean } }
}));
const gotoMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/api/generated/sdk.gen', () => sdk);
vi.mock('$lib/stores/auth.svelte', () => authMock);
vi.mock('$app/navigation', () => ({ goto: gotoMock }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const VOCAB = [
	{ name: 'openid', label: 'Sign you in', group: 'identity' as const },
	{ name: 'org:read', label: 'See your organizations', group: 'org' as const }
];
const SECRET = 's3cret-value-never-cached';

function created(overrides: Partial<OAuthAppCreatedSchema> = {}): OAuthAppCreatedSchema {
	return {
		registration_source: 'manual',
		id: 'app-1',
		client_id: 'cid-1',
		name: 'Acme',
		description: '',
		client_type: 'public',
		allowed_scopes: ['org:read'],
		homepage_url: '',
		privacy_policy_url: '',
		verified: false,
		is_active: true,
		redirect_uris: ['https://example.com/cb'],
		last_used_at: null,
		logo_url: null,
		connections_count: 0,
		client_secret: null,
		...overrides
	};
}

const ok = <T>(data: T) => ({ data, error: undefined, response: { status: 200 } });
const failed = (status: number, error: unknown = { detail: 'nope' }) => ({
	data: undefined,
	error,
	response: { status }
});

const CALLOUT_TITLE = 'Verify your email address to register apps';

describe('Register developer app page', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		Object.values(sdk).forEach((fn) => fn.mockReset());
		gotoMock.mockReset();
		vi.mocked(toast.success).mockReset();
		sdk.oauthscopeListScopes.mockResolvedValue(ok(VOCAB));
		authMock.authStore.user = { email_verified: true };
	});

	function renderPage() {
		return render(QueryClientTestWrapper, {
			props: { client: queryClient, component: Page, componentProps: {} }
		});
	}

	async function fillAndSubmit({ confidential = false } = {}) {
		const user = userEvent.setup();
		await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Acme');
		if (confidential) await user.click(screen.getByRole('radio', { name: /Confidential/ }));
		await user.type(
			screen.getByRole('textbox', { name: 'Redirect URI 1' }),
			'https://example.com/cb'
		);
		await user.click(screen.getByRole('button', { name: 'Register app' }));
		return user;
	}

	it('renders the title and the form once the scope vocabulary loads', async () => {
		renderPage();
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Register a new app');
		expect(await screen.findByRole('button', { name: 'Register app' })).toBeInTheDocument();
	});

	it('a scope-load error shows an alert instead of the form', async () => {
		sdk.oauthscopeListScopes.mockResolvedValue(failed(500));
		renderPage();
		expect(await screen.findByRole('alert')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Register app' })).toBeNull();
	});

	it('public app created → success toast and goto the detail page', async () => {
		sdk.oauthappCreateApp.mockResolvedValue(ok(created()));
		renderPage();
		await fillAndSubmit();
		await waitFor(() => expect(gotoMock).toHaveBeenCalledWith('/account/developer-apps/app-1'));
		expect(toast.success).toHaveBeenCalledWith('Acme was registered.');
		expect(sdk.oauthappCreateApp).toHaveBeenCalledWith({
			body: expect.objectContaining({
				name: 'Acme',
				client_type: 'public',
				redirect_uris: ['https://example.com/cb']
			})
		});
	});

	it('confidential app created → SecretReveal, secret never cached, "I\'ve saved it" → detail', async () => {
		sdk.oauthappCreateApp.mockResolvedValue(
			ok(created({ client_type: 'confidential', client_secret: SECRET }))
		);
		renderPage();
		const user = await fillAndSubmit({ confidential: true });

		const revealHeading = await screen.findByRole('heading', {
			level: 2,
			name: 'Save your client secret'
		});
		// The form unmounted under the user's focus; it lands on the reveal.
		await waitFor(() => expect(revealHeading).toHaveFocus());
		expect(screen.getByDisplayValue(SECRET)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Register app' })).toBeNull();
		expect(gotoMock).not.toHaveBeenCalled();

		// A pending mutation keeps rescheduling GC, so an empty mutation cache proves the
		// create settled (and its secret-bearing state was dropped) before we look.
		await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
		await waitFor(() => {
			expect(JSON.stringify(queryClient.getQueryCache().getAll())).not.toContain(SECRET);
			expect(
				JSON.stringify(
					queryClient
						.getMutationCache()
						.getAll()
						.map((mu) => mu.state)
				)
			).not.toContain(SECRET);
		});

		await user.click(screen.getByRole('button', { name: "I've saved it" }));
		expect(gotoMock).toHaveBeenCalledWith('/account/developer-apps/app-1');
	});

	it('409 → the limit copy, with the typed name kept', async () => {
		sdk.oauthappCreateApp.mockResolvedValue(failed(409, { detail: 'Too many apps' }));
		renderPage();
		await fillAndSubmit();
		expect(
			await screen.findByText("You've reached the limit of apps per account.")
		).toBeInTheDocument();
		expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Acme');
		expect(gotoMock).not.toHaveBeenCalled();
	});

	it('400 field errors land under the matching redirect URI row', async () => {
		sdk.oauthappCreateApp.mockResolvedValue(
			failed(400, { errors: { 'redirect_uris.0': ['Bad'] } })
		);
		renderPage();
		await fillAndSubmit();
		expect(await screen.findByText('Bad')).toBeInTheDocument();
		const row = screen.getByRole('textbox', { name: 'Redirect URI 1' });
		expect(row).toHaveAccessibleDescription('Bad');
		expect(row).toHaveAttribute('aria-invalid', 'true');
		expect(gotoMock).not.toHaveBeenCalled();
	});

	it('400 with only a name error → focus lands on the Name input', async () => {
		sdk.oauthappCreateApp.mockResolvedValue(failed(400, { errors: { name: ['Taken'] } }));
		renderPage();
		await fillAndSubmit();
		const name = screen.getByRole('textbox', { name: 'Name' });
		// The request has settled once the submit button is back.
		expect(await screen.findByRole('button', { name: 'Register app' })).toBeEnabled();
		expect(name).toHaveAccessibleDescription('Taken');
		await waitFor(() => expect(document.activeElement).toBe(name));
	});

	it('403 on create → the verify-email callout', async () => {
		sdk.oauthappCreateApp.mockResolvedValue(failed(403));
		renderPage();
		await fillAndSubmit();
		expect(await screen.findByText(CALLOUT_TITLE)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Register app' })).toBeNull();
	});

	it('an unverified store user sees the callout and no form', async () => {
		authMock.authStore.user = { email_verified: false };
		renderPage();
		expect(await screen.findByText(CALLOUT_TITLE)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Register app' })).toBeNull();
		expect(sdk.oauthscopeListScopes).not.toHaveBeenCalled();
	});
});
