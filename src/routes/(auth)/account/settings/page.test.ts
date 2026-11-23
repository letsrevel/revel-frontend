import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Page from './+page.svelte';
import type { PageData } from './$types';

const state = vi.hoisted(() => ({
	token: null as string | null,
	bootstrap: 'idle' as 'idle' | 'pending' | 'settled'
}));
const pageStore = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: {
		get accessToken() {
			return state.token;
		},
		get bootstrapState() {
			return state.bootstrap;
		}
	}
}));
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	pageStore.current = writable({});
	return { page: pageStore.current };
});
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/components/notifications', async () => {
	const stub = (await import('$lib/components/common/__mocks__/StubPlatformFooter.svelte')).default;
	return {
		NotificationPreferencesForm: stub,
		MutedOrganizationsCard: stub,
		EmailSuppressionBanner: stub
	};
});
vi.mock('$lib/components/billing', async () => ({
	BillingProfileForm: (await import('$lib/components/common/__mocks__/StubPlatformFooter.svelte'))
		.default
}));
vi.mock('$lib/components/forms/CityAutocomplete.svelte', async () => ({
	default: (await import('$lib/components/common/__mocks__/StubPlatformFooter.svelte')).default
}));
vi.mock('$lib/components/profile/AttendeeVisibilitySelect.svelte', async () => ({
	default: (await import('$lib/components/common/__mocks__/StubPlatformFooter.svelte')).default
}));

const data = {
	notificationPreferences: null,
	generalPreferences: null
} as unknown as PageData;

function setPage(auth: { hasAccessToken: boolean; hasRefreshToken: boolean }): void {
	(pageStore.current as ReturnType<typeof writable>).set({
		url: new URL('http://localhost/account/settings'),
		data: { auth, tenant: null }
	});
}

describe('settings page session handling', () => {
	beforeEach(() => {
		state.token = null;
		state.bootstrap = 'idle';
	});

	it('shows a loading state, not "not logged in", while the session token bootstraps', () => {
		setPage({ hasAccessToken: true, hasRefreshToken: true });
		render(Page, { props: { data } });
		expect(screen.getByTestId('settings-session-pending')).toBeInTheDocument();
		expect(screen.queryByText(/must be logged in/i)).toBeNull();
	});

	it('shows the not-logged-in alert only when the server has no session either', () => {
		setPage({ hasAccessToken: false, hasRefreshToken: false });
		render(Page, { props: { data } });
		expect(screen.getByRole('alert')).toHaveTextContent(/must be logged in/i);
		expect(screen.queryByTestId('settings-session-pending')).toBeNull();
	});

	it('renders the settings sections once the token is in memory', () => {
		state.token = 'tok';
		setPage({ hasAccessToken: true, hasRefreshToken: true });
		render(Page, { props: { data } });
		expect(screen.queryByTestId('settings-session-pending')).toBeNull();
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('shows the spinner while the bootstrap is pending', () => {
		state.bootstrap = 'pending';
		setPage({ hasAccessToken: true, hasRefreshToken: true });
		render(Page, { props: { data } });
		expect(screen.getByTestId('settings-session-pending')).toBeInTheDocument();
	});

	it('shows the alert after a failed bootstrap even though the server flags are true', () => {
		state.bootstrap = 'settled';
		setPage({ hasAccessToken: true, hasRefreshToken: true });
		render(Page, { props: { data } });
		expect(screen.queryByTestId('settings-session-pending')).toBeNull();
		expect(screen.getByRole('alert')).toHaveTextContent(/must be logged in/i);
	});

	it('falls back to the server flags after a logout resets a settled bootstrap to idle', () => {
		// The store's own reset is covered in auth.svelte.test.ts; here we assert
		// the page reaction to the resulting idle state with server flags true.
		state.bootstrap = 'settled';
		state.bootstrap = 'idle';
		setPage({ hasAccessToken: true, hasRefreshToken: true });
		render(Page, { props: { data } });
		expect(screen.getByTestId('settings-session-pending')).toBeInTheDocument();
		expect(screen.queryByRole('alert')).toBeNull();
	});
});
