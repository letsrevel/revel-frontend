import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import GlobalEmailSuppressionBanner from './GlobalEmailSuppressionBanner.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	notificationpreferenceGetPreferences: vi.fn(),
	notificationpreferenceMuteOrganization: vi.fn(),
	notificationpreferenceUnmuteOrganization: vi.fn(),
	organizationGetOrganizationById: vi.fn()
}));

const authState = vi.hoisted(() => ({ accessToken: 'tok' as string | null }));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: authState }));

const pageState = vi.hoisted(() => ({ url: new URL('http://localhost/dashboard') }));
vi.mock('$app/state', () => ({ page: pageState }));

import { notificationpreferenceGetPreferences } from '$lib/api/generated/sdk.gen';

const suppressed = { reason: 'hard_bounce', since: '2026-09-20T10:00:00Z' };

function renderBanner(preferences: Record<string, unknown>) {
	vi.mocked(notificationpreferenceGetPreferences).mockResolvedValue({ data: preferences } as never);
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: GlobalEmailSuppressionBanner
		}
	});
}

describe('GlobalEmailSuppressionBanner (#987)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authState.accessToken = 'tok';
		pageState.url = new URL('http://localhost/dashboard');
		sessionStorage.clear();
	});

	it('shows for a suppressed address', async () => {
		renderBanner({ email_suppression: suppressed });
		expect(await screen.findByRole('region')).toBeInTheDocument();
	});

	it('shows nothing when not suppressed, or when the field is absent (older backend)', async () => {
		renderBanner({ email_suppression: null });
		await Promise.resolve();
		expect(screen.queryByRole('region')).not.toBeInTheDocument();
		renderBanner({});
		await new Promise((r) => setTimeout(r, 0));
		expect(screen.queryByRole('region')).not.toBeInTheDocument();
	});

	it.each(['/account/settings', '/account/settings/', '/de/account/settings'])(
		'steps aside on account settings (%s), which renders its own copy',
		async (path) => {
			pageState.url = new URL(`http://localhost${path}`);
			renderBanner({ email_suppression: suppressed });
			await new Promise((r) => setTimeout(r, 0));
			expect(screen.queryByRole('region')).not.toBeInTheDocument();
		}
	);

	it('stays dismissed for the session, but returns for a new suppression', async () => {
		const first = renderBanner({ email_suppression: suppressed });
		await userEvent.setup().click(await screen.findByRole('button', { name: 'Dismiss' }));
		expect(screen.queryByRole('region')).not.toBeInTheDocument();
		first.unmount();

		renderBanner({ email_suppression: suppressed });
		await new Promise((r) => setTimeout(r, 0));
		expect(screen.queryByRole('region')).not.toBeInTheDocument();

		renderBanner({ email_suppression: { reason: 'complaint', since: '2026-09-29T10:00:00Z' } });
		expect(await screen.findByRole('region')).toBeInTheDocument();
	});

	it('renders nothing when signed out', () => {
		authState.accessToken = null;
		renderBanner({ email_suppression: suppressed });
		expect(screen.queryByRole('region')).not.toBeInTheDocument();
		expect(notificationpreferenceGetPreferences).not.toHaveBeenCalled();
	});
});
