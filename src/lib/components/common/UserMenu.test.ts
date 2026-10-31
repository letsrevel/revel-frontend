import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { readable } from 'svelte/store';
import { QueryClient } from '@tanstack/svelte-query';
import UserMenu from './UserMenu.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('http://localhost/'), data: { features: {}, tenant: null } })
}));

const authMock = vi.hoisted(() => ({
	user: { email: 'sam@example.com', first_name: 'Sam', display_name: 'Sam' },
	accessToken: null as string | null,
	permissions: null,
	logout: vi.fn(),
	waitForAuthSettled: vi.fn(() => Promise.resolve())
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: authMock }));
vi.mock('$lib/api/generated/sdk.gen', () => ({ dashboardDashboardOrganizations: vi.fn() }));

let submitted: HTMLFormElement[] = [];

function setup(props: { mobile?: boolean } = {}) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const clear = vi.spyOn(client, 'clear');
	render(QueryClientTestWrapper, {
		props: { client, component: UserMenu, componentProps: props }
	});
	return { clear };
}

describe('UserMenu logout', () => {
	beforeEach(() => {
		submitted = [];
		document.body.querySelectorAll(':scope > form').forEach((f) => f.remove());
		authMock.logout.mockClear();
		authMock.waitForAuthSettled.mockClear();
		// jsdom cannot navigate; form.submit() fires no submit event, so stub it.
		vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (
			this: HTMLFormElement
		) {
			submitted.push(this);
		});
	});
	afterEach(() => vi.restoreAllMocks());

	it('desktop: clears client state, then POSTs to /logout', async () => {
		const { clear } = setup();
		await userEvent.click(screen.getByRole('button', { name: 'User menu' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Log Out' }));
		await waitFor(() => expect(submitted).toHaveLength(1));

		expect(authMock.waitForAuthSettled).toHaveBeenCalled();
		expect(authMock.logout).toHaveBeenCalled();
		expect(clear).toHaveBeenCalled();
		expect(submitted[0]).toHaveAttribute('method', 'POST');
		expect(submitted[0]).toHaveAttribute('action', '/logout');
	});

	it('mobile: the same POST is submitted', async () => {
		setup({ mobile: true });
		await userEvent.click(screen.getByRole('button', { name: 'Log Out' }));
		await waitFor(() => expect(submitted).toHaveLength(1));

		expect(authMock.logout).toHaveBeenCalled();
		expect(submitted[0]).toHaveAttribute('method', 'POST');
		expect(submitted[0]).toHaveAttribute('action', '/logout');
	});

	it('ignores a second click while a logout is in flight', async () => {
		let release: () => void = () => undefined;
		authMock.waitForAuthSettled.mockReturnValueOnce(new Promise<void>((r) => (release = r)));
		setup({ mobile: true });
		const btn = screen.getByRole('button', { name: 'Log Out' });
		await userEvent.click(btn);
		await userEvent.click(btn);
		release();
		await waitFor(() => expect(submitted).toHaveLength(1));
		expect(authMock.logout).toHaveBeenCalledTimes(1);
	});
});
