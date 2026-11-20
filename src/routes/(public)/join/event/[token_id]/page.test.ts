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
const navListeners = vi.hoisted(() => [] as Array<() => void>);
vi.mock('$app/navigation', () => ({
	goto: gotoMock,
	afterNavigate: (fn: () => void) => navListeners.push(fn)
}));

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
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock('svelte-sonner', () => ({ toast: { success: toastSuccess, error: vi.fn() } }));

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

function renderPage(data: Record<string, unknown>): ReturnType<typeof render> {
	return render(QueryClientTestWrapper, {
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
		navListeners.length = 0;
		toastSuccess.mockReset();
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

	it('does not open the event when the user navigated during the cleanup, even back to the same page', async () => {
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
		// The success path ran up to the cleanup (positive control).
		expect(toastSuccess).toHaveBeenCalled();
		// The user leaves and comes back with Back: same path, but two navigations.
		navListeners.forEach((fn) => fn());
		navListeners.forEach((fn) => fn());
		release();
		await new Promise((r) => setTimeout(r, 0));

		expect(gotoMock).not.toHaveBeenCalled();
	});
});

// #1276: a link that no longer works still names its event. A person who
// already holds an invitation reaches it from there.
describe('join event page — link no longer works', () => {
	const rejection = {
		message: 'gone',
		reason: 'used_up',
		event_name: 'Test Event',
		event_slug: 'test-event',
		organization_slug: 'test-org'
	};

	it('offers the event and the event list', () => {
		renderPage({ token: null, rejection });

		const toEvent = screen.getByRole('link', { name: m['joinEventPage.rejectedGoToEvent']() });
		expect(toEvent.getAttribute('href')).toContain('/events/test-org/test-event');
		expect(screen.getByText(m['joinEventPage.rejectedInvitedHint']())).toBeInTheDocument();
		expect(
			screen.getByRole('link', { name: m['joinEventPage.rejectedCta']() }).getAttribute('href')
		).toContain('/events');
	});

	it('offers only the event list when the event is not named', () => {
		renderPage({ token: null, rejection: { ...rejection, event_slug: '', organization_slug: '' } });

		expect(
			screen.queryByRole('link', { name: m['joinEventPage.rejectedGoToEvent']() })
		).not.toBeInTheDocument();
		expect(
			screen.getByRole('link', { name: m['joinEventPage.rejectedCta']() })
		).toBeInTheDocument();
	});
});

// #1276: the component is reused across /join/event/<token> params; a claim
// still running for the previous token must not keep the new page busy.
describe('join event page — token change during a claim', () => {
	beforeEach(() => {
		authState.isAuthenticated = true;
		authState.accessToken = 'tok';
		navListeners.length = 0;
	});

	it('enables the claim button for the new token', async () => {
		vi.mocked(eventpublicdiscoveryClaimInvitation).mockImplementation(
			() => new Promise(() => undefined) as never
		);
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		const props = (id: string) => ({
			client,
			component: JoinEventPage,
			componentProps: {
				data: {
					token: makeToken({ id }),
					rejection: null,
					tokenId: id,
					canAttendWithoutLogin: false
				}
			}
		});
		const { rerender } = render(QueryClientTestWrapper, { props: props('token-1') });
		const user = userEvent.setup();

		await user.click(screen.getByRole('button', { name: m['joinEventPage.claimButton']() }));
		await vi.waitFor(() =>
			expect(
				screen.getByRole('button', { name: m['joinEventPage.claimingButton']() })
			).toBeDisabled()
		);

		await rerender(props('token-2'));

		await vi.waitFor(() =>
			expect(screen.getByRole('button', { name: m['joinEventPage.claimButton']() })).toBeEnabled()
		);
	});
});
