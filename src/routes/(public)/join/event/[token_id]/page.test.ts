import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { eventpublicdiscoveryClaimInvitation } from '$lib/api/generated/sdk.gen';
import * as m from '$lib/paraglide/messages.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import JoinEventPage from './+page.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { EventTokenSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicdiscoveryClaimInvitation: vi.fn()
}));

const gotoMock = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ goto: gotoMock }));

const pageState = vi.hoisted(() => ({ pathname: '/join/event/token-1' }));
vi.mock('$app/state', () => ({
	page: {
		data: {},
		get url() {
			return new URL(`http://localhost${pageState.pathname}`);
		}
	}
}));

const forgetMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/utils/pending-event-token', () => ({ forgetPendingEventToken: forgetMock }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const authState = vi.hoisted(() => ({
	isAuthenticated: false,
	accessToken: null as string | null
}));
vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: authState
}));

function makeToken(overrides: Partial<EventTokenSchema> = {}): EventTokenSchema {
	return {
		id: 'token-1',
		event_name: 'Test Event',
		event_slug: 'test-event',
		organization_slug: 'test-org',
		event_start: '2026-10-01T18:00:00Z',
		issuer: 'user-1',
		event: 'event-1',
		created_at: '2026-09-01T00:00:00Z',
		grants_invitation: true,
		...overrides
	};
}

function renderPage(data: Record<string, unknown>): void {
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({
				defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
			}),
			component: JoinEventPage,
			componentProps: {
				data: {
					token: makeToken(),
					rejection: null,
					tokenId: 'token-1',
					canAttendWithoutLogin: false,
					...data
				}
			}
		}
	});
}

// Backend #923: guests can claim invitation links — the event's guest checkout
// and RSVP endpoints accept the token via X-Event-Token / ?et=. The join page
// must offer anonymous visitors a guest path alongside sign-in whenever the
// token's event allows attending without a login.
describe('join event page — continue as guest', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authState.isAuthenticated = false;
		authState.accessToken = null;
	});

	it('offers "Continue as guest" alongside sign-in when the event allows guests', () => {
		renderPage({ canAttendWithoutLogin: true });

		const guestLink = screen.getByRole('link', { name: /continue as guest/i });
		expect(guestLink.getAttribute('href')).toContain('/events/test-org/test-event');
		expect(guestLink.getAttribute('href')).toContain('et=token-1');
		// Sign-in stays available — guest is an alternative, not a replacement.
		expect(screen.getByRole('button', { name: /sign in to claim/i })).toBeInTheDocument();
	});

	it('offers no guest path when the event requires a login', () => {
		renderPage({ canAttendWithoutLogin: false });
		expect(screen.queryByRole('link', { name: /continue as guest/i })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /sign in to claim/i })).toBeInTheDocument();
	});

	it('offers no guest path to authenticated users', () => {
		authState.isAuthenticated = true;
		authState.accessToken = 'jwt';
		renderPage({ canAttendWithoutLogin: true });
		expect(screen.queryByRole('link', { name: /continue as guest/i })).not.toBeInTheDocument();
	});
});

// #1274: a successful claim forgets the pending token, then opens the event,
// but never pulls back a user who moved on while the request ran.
describe('join event page — claim', () => {
	beforeEach(() => {
		authState.isAuthenticated = true;
		authState.accessToken = 'tok';
		pageState.pathname = '/join/event/token-1';
		gotoMock.mockReset();
		forgetMock.mockReset();
		vi.mocked(eventpublicdiscoveryClaimInvitation).mockResolvedValue({
			data: { name: 'Test Event', slug: 'test-event' },
			error: undefined
		} as never);
	});

	async function claim(): Promise<void> {
		const user = userEvent.setup();
		await user.click(screen.getByRole('button', { name: m['joinEventPage.claimButton']() }));
	}

	it('forgets the claimed token, then opens the event', async () => {
		forgetMock.mockResolvedValue(undefined);
		renderPage({});

		await claim();

		await vi.waitFor(() => expect(gotoMock).toHaveBeenCalled());
		expect(forgetMock).toHaveBeenCalledWith('token-1');
		expect(gotoMock.mock.calls[0][0]).toContain('/events/test-org/test-event');
	});

	it('does not open the event when the user left the page during the cleanup', async () => {
		let release: () => void = () => undefined;
		forgetMock.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					release = resolve;
				})
		);
		renderPage({});

		await claim();
		await vi.waitFor(() => expect(forgetMock).toHaveBeenCalledWith('token-1'));
		pageState.pathname = '/events';
		release();
		await new Promise((r) => setTimeout(r, 0));

		expect(gotoMock).not.toHaveBeenCalled();
	});
});
