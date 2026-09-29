import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { toast } from 'svelte-sonner';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { OAuthAppCreatedSchema, OAuthAppSchema } from '$lib/api/generated/types.gen';
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
// Reactive: SvelteKit reuses this page across `app_id`s, and one test moves it.
const pageMock = vi.hoisted(() => ({ page: null as unknown as { params: { app_id: string } } }));
vi.mock('$app/state', async () => {
	const { createMockPage } = await import('$lib/test-utils/mock-page-state.svelte');
	pageMock.page = createMockPage({
		params: { app_id: 'app-1' },
		url: new URL('http://localhost/account/developer-apps/app-1')
	}) as { params: { app_id: string } };
	return { page: pageMock.page };
});
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('$lib/components/common/ImageCropperModal.svelte', async () => ({
	default: (await import('$lib/components/forms/__mocks__/CropperModalStub.svelte')).default
}));

const VOCAB = [
	{ name: 'openid', label: 'Sign you in', group: 'identity' as const },
	{ name: 'me:tickets', label: 'See your tickets', group: 'me' as const },
	{ name: 'org:read', label: 'See your organizations', group: 'org' as const }
];
const SECRET = 'rotated-s3cret-never-cached';

function app(overrides: Partial<OAuthAppSchema> = {}): OAuthAppSchema {
	return {
		registration_source: 'manual',
		id: 'app-1',
		client_id: 'cid-1',
		name: 'Acme',
		description: 'Old text',
		client_type: 'confidential',
		allowed_scopes: ['openid', 'org:read'],
		homepage_url: '',
		privacy_policy_url: '',
		verified: true,
		is_active: true,
		redirect_uris: ['https://example.com/cb'],
		last_used_at: null,
		logo_url: null,
		connections_count: 2,
		...overrides
	};
}

const ok = <T>(data: T) => ({ data, error: undefined, response: { status: 200 } });
const failed = (status: number, error: unknown = { detail: 'nope' }) => ({
	data: undefined,
	error,
	response: { status }
});

describe('Developer app detail page', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		Object.values(sdk).forEach((fn) => fn.mockReset());
		gotoMock.mockReset();
		vi.mocked(toast.success).mockReset();
		vi.mocked(toast.error).mockReset();
		sdk.oauthscopeListScopes.mockResolvedValue(ok(VOCAB));
		sdk.oauthappGetApp.mockResolvedValue(ok(app()));
		sdk.oauthappUpdateApp.mockResolvedValue(ok(app()));
		authMock.authStore.user = { email_verified: true };
		pageMock.page.params.app_id = 'app-1';
	});

	function renderPage() {
		return render(QueryClientTestWrapper, {
			props: { client: queryClient, component: Page, componentProps: {} }
		});
	}

	async function ready() {
		await screen.findByRole('button', { name: 'Save changes' });
		return userEvent.setup();
	}

	const dialog = () => screen.getByRole('dialog');

	it('renders the header, badges and a copyable client id', async () => {
		renderPage();
		await ready();
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Acme');
		const badges = screen.getAllByTestId('status-badge').map((b) => b.textContent?.trim());
		expect(badges).toEqual(expect.arrayContaining(['Confidential', 'Active', 'Verified']));
		expect(screen.getByRole('textbox', { name: 'Client ID' })).toHaveValue('cid-1');
		expect(sdk.oauthappGetApp).toHaveBeenCalledWith({ path: { app_id: 'app-1' } });
	});

	it('404 → the not-found state with a way back to the list', async () => {
		sdk.oauthappGetApp.mockResolvedValue(failed(404));
		renderPage();
		expect(await screen.findByText("This app doesn't exist or isn't yours.")).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Back to your apps' })).toHaveAttribute(
			'href',
			'/account/developer-apps'
		);
		expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
	});

	it('an unverified store user sees the callout and nothing is fetched', async () => {
		authMock.authStore.user = { email_verified: false };
		renderPage();
		expect(
			await screen.findByText('Verify your email address to register apps')
		).toBeInTheDocument();
		expect(sdk.oauthappGetApp).not.toHaveBeenCalled();
	});

	it('saving with no changes sends nothing and confirms', async () => {
		renderPage();
		const user = await ready();
		await user.click(screen.getByRole('button', { name: 'Save changes' }));
		expect(toast.success).toHaveBeenCalledWith('Changes saved.');
		expect(sdk.oauthappUpdateApp).not.toHaveBeenCalled();
	});

	it('editing only the description PATCHes exactly { description }', async () => {
		renderPage();
		const user = await ready();
		const description = screen.getByRole('textbox', { name: 'Description' });
		await user.clear(description);
		await user.type(description, 'New text');
		await user.click(screen.getByRole('button', { name: 'Save changes' }));
		await waitFor(() =>
			expect(sdk.oauthappUpdateApp).toHaveBeenCalledWith({
				path: { app_id: 'app-1' },
				body: { description: 'New text' }
			})
		);
		await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Changes saved.'));
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('removing a scope asks first, then PATCHes the new scope set', async () => {
		renderPage();
		const user = await ready();
		await user.click(screen.getByRole('checkbox', { name: 'See your organizations' }));
		await user.click(screen.getByRole('checkbox', { name: 'See your tickets' }));
		await user.click(screen.getByRole('button', { name: 'Save changes' }));

		expect(await screen.findByRole('dialog')).toHaveTextContent('Remove permissions?');
		expect(dialog()).toHaveTextContent('org:read');
		expect(sdk.oauthappUpdateApp).not.toHaveBeenCalled();

		await user.click(within(dialog()).getByRole('button', { name: 'Remove and save' }));
		await waitFor(() =>
			expect(sdk.oauthappUpdateApp).toHaveBeenCalledWith({
				path: { app_id: 'app-1' },
				body: { allowed_scopes: ['openid', 'me:tickets'] }
			})
		);
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	});

	it('only adding a scope saves without a dialog', async () => {
		renderPage();
		const user = await ready();
		await user.click(screen.getByRole('checkbox', { name: 'See your tickets' }));
		await user.click(screen.getByRole('button', { name: 'Save changes' }));
		await waitFor(() =>
			expect(sdk.oauthappUpdateApp).toHaveBeenCalledWith({
				path: { app_id: 'app-1' },
				body: { allowed_scopes: ['openid', 'me:tickets', 'org:read'] }
			})
		);
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('rotate → confirm → the new secret is shown once and never cached', async () => {
		const rotated: OAuthAppCreatedSchema = { ...app(), client_secret: SECRET };
		sdk.oauthappRotateSecret.mockResolvedValue(ok(rotated));
		renderPage();
		const user = await ready();
		await user.click(screen.getByRole('button', { name: 'Rotate secret' }));
		expect(await screen.findByRole('dialog')).toHaveTextContent('Rotate the client secret?');
		await user.click(within(dialog()).getByRole('button', { name: 'Rotate secret' }));

		const heading = await screen.findByRole('heading', {
			level: 2,
			name: 'Save your client secret'
		});
		await waitFor(() => expect(heading).toHaveFocus());
		expect(sdk.oauthappRotateSecret).toHaveBeenCalledWith({ path: { app_id: 'app-1' } });
		expect(screen.getByDisplayValue(SECRET)).toBeInTheDocument();

		// A pending mutation keeps rescheduling GC: an empty cache proves it settled.
		await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
		expect(JSON.stringify(queryClient.getQueryCache().getAll())).not.toContain(SECRET);
		expect(
			JSON.stringify(
				queryClient
					.getMutationCache()
					.getAll()
					.map((mu) => mu.state)
			)
		).not.toContain(SECRET);

		await user.click(screen.getByRole('button', { name: "I've saved it" }));
		expect(screen.queryByDisplayValue(SECRET)).toBeNull();
	});

	async function rotateNow(user: ReturnType<typeof userEvent.setup>) {
		await user.click(screen.getByRole('button', { name: 'Rotate secret' }));
		await user.click(
			within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rotate secret' })
		);
		await screen.findByDisplayValue(SECRET);
	}

	it('a failed refetch after a rotate never hides the one-time secret', async () => {
		sdk.oauthappRotateSecret.mockResolvedValue(ok({ ...app(), client_secret: SECRET }));
		renderPage();
		const user = await ready();
		// The rotate's own `refresh()` refetch fails (e.g. a network blip).
		sdk.oauthappGetApp.mockResolvedValue(failed(500));
		await rotateNow(user);

		expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
		expect(screen.getByDisplayValue(SECRET)).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { level: 2, name: 'Save your client secret' })
		).toBeVisible();
	});

	it('moving to another app id drops the previous app’s secret and form', async () => {
		sdk.oauthappRotateSecret.mockResolvedValue(ok({ ...app(), client_secret: SECRET }));
		renderPage();
		const user = await ready();
		await rotateNow(user);

		sdk.oauthappGetApp.mockResolvedValue(
			ok(app({ id: 'app-2', client_id: 'cid-2', name: 'Other', description: 'Second app' }))
		);
		pageMock.page.params.app_id = 'app-2';

		expect(await screen.findByDisplayValue('Second app')).toBeInTheDocument();
		expect(screen.queryByDisplayValue(SECRET)).toBeNull();
		expect(screen.queryByRole('heading', { name: 'Save your client secret' })).toBeNull();
		expect(sdk.oauthappGetApp).toHaveBeenLastCalledWith({ path: { app_id: 'app-2' } });
	});

	it('403 on rotate → the verify-email callout', async () => {
		sdk.oauthappRotateSecret.mockResolvedValue(failed(403));
		renderPage();
		const user = await ready();
		await user.click(screen.getByRole('button', { name: 'Rotate secret' }));
		await user.click(
			within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rotate secret' })
		);
		expect(
			await screen.findByText('Verify your email address to register apps')
		).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
	});

	it('a public app has no Rotate action', async () => {
		sdk.oauthappGetApp.mockResolvedValue(ok(app({ client_type: 'public' })));
		renderPage();
		await ready();
		expect(screen.queryByRole('button', { name: 'Rotate secret' })).toBeNull();
	});

	it('deactivate warns that users are disconnected, then calls the endpoint', async () => {
		sdk.oauthappDeactivate.mockResolvedValue(ok(app({ is_active: false })));
		renderPage();
		const user = await ready();
		await user.click(screen.getByRole('button', { name: 'Deactivate' }));
		expect(await screen.findByRole('dialog')).toHaveTextContent('disconnected immediately');
		await user.click(within(dialog()).getByRole('button', { name: 'Deactivate' }));
		await waitFor(() =>
			expect(sdk.oauthappDeactivate).toHaveBeenCalledWith({ path: { app_id: 'app-1' } })
		);
		expect(sdk.oauthappActivate).not.toHaveBeenCalled();
	});

	it('cancelling a dialog does nothing', async () => {
		renderPage();
		const user = await ready();
		await user.click(screen.getByRole('button', { name: 'Delete app' }));
		await user.click(
			within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' })
		);
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(sdk.oauthappDeleteApp).not.toHaveBeenCalled();
	});

	it('delete → confirm → back to the list', async () => {
		sdk.oauthappDeleteApp.mockResolvedValue({
			data: undefined,
			error: undefined,
			response: { status: 204 }
		});
		renderPage();
		const user = await ready();
		await user.click(screen.getByRole('button', { name: 'Delete app' }));
		expect(await screen.findByRole('dialog')).toHaveTextContent('Delete Acme?');
		await user.click(within(dialog()).getByRole('button', { name: 'Delete app' }));
		await waitFor(() => expect(gotoMock).toHaveBeenCalledWith('/account/developer-apps'));
		expect(sdk.oauthappDeleteApp).toHaveBeenCalledWith({ path: { app_id: 'app-1' } });
		expect(toast.success).toHaveBeenCalledWith('Acme was deleted.');
	});

	it('a logo pick is cropped and uploaded', async () => {
		global.FileReader = class {
			readAsDataURL = vi.fn();
			onloadend: (() => void) | null = null;
			result = 'data:image/png;base64,test';
		} as unknown as typeof FileReader;
		sdk.oauthappUploadLogo.mockResolvedValue(ok(app({ logo_url: 'https://api/logo.png' })));
		renderPage();
		await ready();
		const input = screen.getByLabelText('Logo', { selector: 'input' }) as HTMLInputElement;
		const file = new File(['x'], 'logo.png', { type: 'image/png' });
		Object.defineProperty(input, 'files', { value: [file], configurable: true });
		await fireEvent.change(input);
		(await screen.findByTestId('cropper-save')).click();
		await waitFor(() =>
			expect(sdk.oauthappUploadLogo).toHaveBeenCalledWith({
				path: { app_id: 'app-1' },
				body: { logo: expect.any(File) }
			})
		);
		await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Logo updated.'));
	});

	it('a failed logo upload shows the error', async () => {
		global.FileReader = class {
			readAsDataURL = vi.fn();
			onloadend: (() => void) | null = null;
			result = 'data:image/png;base64,test';
		} as unknown as typeof FileReader;
		sdk.oauthappUploadLogo.mockResolvedValue(failed(400, { errors: { logo: ['bad'] } }));
		renderPage();
		await ready();
		const input = screen.getByLabelText('Logo', { selector: 'input' }) as HTMLInputElement;
		Object.defineProperty(input, 'files', {
			value: [new File(['x'], 'logo.png', { type: 'image/png' })],
			configurable: true
		});
		await fireEvent.change(input);
		(await screen.findByTestId('cropper-save')).click();
		expect(await screen.findByText("We couldn't upload the logo.")).toBeInTheDocument();
	});
});
