import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
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
	logout: vi.fn()
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: authMock }));
vi.mock('$lib/api/generated/sdk.gen', () => ({ dashboardDashboardOrganizations: vi.fn() }));

let submitted: HTMLFormElement[] = [];
const onSubmit = (e: Event) => {
	e.preventDefault(); // jsdom cannot navigate
	submitted.push(e.target as HTMLFormElement);
};

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
		authMock.logout.mockClear();
		document.addEventListener('submit', onSubmit);
	});
	afterEach(() => document.removeEventListener('submit', onSubmit));

	it('desktop: clears client state, then POSTs to /logout', async () => {
		const { clear } = setup();
		await userEvent.click(screen.getByRole('button', { name: 'User menu' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Log Out' }));

		expect(authMock.logout).toHaveBeenCalled();
		expect(clear).toHaveBeenCalled();
		expect(submitted).toHaveLength(1);
		expect(submitted[0]).toHaveAttribute('method', 'POST');
		expect(submitted[0]).toHaveAttribute('action', '/logout');
	});

	it('mobile: the same POST is submitted', async () => {
		setup({ mobile: true });
		await userEvent.click(screen.getByRole('button', { name: 'Log Out' }));

		expect(authMock.logout).toHaveBeenCalled();
		expect(submitted).toHaveLength(1);
		expect(submitted[0]).toHaveAttribute('method', 'POST');
		expect(submitted[0]).toHaveAttribute('action', '/logout');
	});
});
