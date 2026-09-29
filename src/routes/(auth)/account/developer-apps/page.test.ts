import { render, screen, within } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { OAuthAppSchema } from '$lib/api/generated/types.gen';
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

vi.mock('$lib/api/generated/sdk.gen', () => sdk);
vi.mock('$lib/stores/auth.svelte', () => authMock);
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function app(name: string, id: string): OAuthAppSchema {
	return {
		registration_source: 'manual',
		id,
		client_id: `cid-${id}`,
		name,
		description: '',
		client_type: 'confidential',
		allowed_scopes: ['openid'],
		homepage_url: '',
		privacy_policy_url: '',
		verified: false,
		is_active: true,
		redirect_uris: ['https://example.com/cb'],
		last_used_at: null,
		logo_url: null,
		connections_count: 0
	};
}

const ok = <T>(data: T) => ({ data, error: undefined, response: { status: 200 } });
const failed = (status: number) => ({
	data: undefined,
	error: { detail: 'nope' },
	response: { status }
});

const EMPTY_TITLE = "You haven't registered any apps.";
const CALLOUT_TITLE = 'Verify your email address to register apps';

describe('Developer apps page', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		sdk.oauthappListApps.mockReset();
		authMock.authStore.user = { email_verified: true };
	});

	function renderPage() {
		return render(QueryClientTestWrapper, {
			props: { client: queryClient, component: Page, componentProps: {} }
		});
	}

	it('renders one card per app under the section heading, with a "New app" header action', async () => {
		sdk.oauthappListApps.mockResolvedValue(ok([app('Acme', 'a'), app('Beta', 'b')]));
		renderPage();
		const cards = await screen.findAllByRole('article');
		expect(cards.map((c) => within(c).getByRole('heading', { level: 3 }).textContent)).toEqual([
			'Acme',
			'Beta'
		]);
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Developer apps');
		expect(screen.getByRole('heading', { level: 2, name: 'Your apps' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'New app' })).toHaveAttribute(
			'href',
			'/account/developer-apps/new'
		);
	});

	it('shows the empty state with a "New app" CTA on 200 []', async () => {
		sdk.oauthappListApps.mockResolvedValue(ok([]));
		renderPage();
		expect(await screen.findByText(EMPTY_TITLE)).toBeInTheDocument();
		// Header action + empty-state CTA.
		const links = screen.getAllByRole('link', { name: 'New app' });
		expect(links).toHaveLength(2);
		links.forEach((l) => expect(l).toHaveAttribute('href', '/account/developer-apps/new'));
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('403 → the verify-email callout, no list and no empty state', async () => {
		sdk.oauthappListApps.mockResolvedValue(failed(403));
		renderPage();
		expect(await screen.findByText(CALLOUT_TITLE)).toBeInTheDocument();
		expect(screen.queryByRole('article')).toBeNull();
		expect(screen.queryByText(EMPTY_TITLE)).toBeNull();
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('an unverified store user sees the callout and the list is never requested', async () => {
		authMock.authStore.user = { email_verified: false };
		renderPage();
		expect(await screen.findByText(CALLOUT_TITLE)).toBeInTheDocument();
		expect(screen.queryByRole('status')).toBeNull();
		expect(sdk.oauthappListApps).not.toHaveBeenCalled();
	});

	it('404 → the load error, not the empty state', async () => {
		sdk.oauthappListApps.mockResolvedValue(failed(404));
		renderPage();
		expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your apps.");
		expect(screen.queryByText(EMPTY_TITLE)).toBeNull();
		expect(screen.queryByText(CALLOUT_TITLE)).toBeNull();
	});
});
