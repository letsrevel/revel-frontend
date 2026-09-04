import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import JoinEventPage from './+page.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { EventTokenSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicdiscoveryClaimInvitation: vi.fn()
}));

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

function renderPage(data: Record<string, unknown>) {
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
