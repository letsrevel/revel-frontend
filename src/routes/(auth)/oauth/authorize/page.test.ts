import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthorizeDescribeResponse } from '$lib/api/generated/types.gen';

const describeMock = vi.hoisted(() => vi.fn());
const decideMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/api/queries/oauth-authorize', () => ({
	describeAuthorization: describeMock,
	decideAuthorization: decideMock
}));
vi.mock('$lib/utils/navigate-to', () => ({ navigateTo: navigateMock, isHttpUrl: () => true }));
vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'tok', user: { display_name: 'Sam Jones', email: 'sam@example.com' } }
}));

import Page from './+page.svelte';

const SEARCH = '?client_id=abc&resource=a&resource=b';

function description(
	overrides: Partial<AuthorizeDescribeResponse> = {}
): AuthorizeDescribeResponse {
	return {
		application: {
			name: 'Acme Planner',
			description: 'Plans things.',
			logo_url: null,
			verified: false,
			registration_source: 'dcr',
			homepage_url: '',
			privacy_policy_url: ''
		},
		scopes: [
			{ name: 'openid', label: 'Sign you in', group: 'identity' },
			{ name: 'org:tickets', label: 'Manage tickets and refunds', group: 'org' }
		],
		redirect_uri: 'https://acme.example/cb',
		state: 'xyz',
		consent_ticket: 'ticket-1',
		...overrides
	};
}

beforeEach(() => {
	describeMock.mockReset();
	decideMock.mockReset();
	navigateMock.mockReset();
	window.history.replaceState({}, '', `/oauth/authorize${SEARCH}`);
});

describe('/oauth/authorize page', () => {
	it('renders the consent screen with grouped scopes, the alert, and Allow before Deny', async () => {
		describeMock.mockResolvedValue({ kind: 'describe', data: description() });
		render(Page);
		expect(
			await screen.findByRole('heading', { level: 1, name: 'Connect Acme Planner' })
		).toBeInTheDocument();
		expect(describeMock).toHaveBeenCalledWith(SEARCH);
		expect(screen.getAllByRole('alert')).toHaveLength(1);
		expect(screen.getAllByRole('listitem')).toHaveLength(2);
		// The unverified warning is itself an h2 (it outranks the scope groups).
		expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent?.trim())).toEqual([
			'Revel has not reviewed this app.',
			'Sign in and profile',
			'Your organizations'
		]);
		const buttons = screen.getAllByRole('button').map((b) => b.textContent?.trim());
		expect(buttons.indexOf('Allow')).toBeLessThan(buttons.indexOf('Deny'));
		expect(screen.getByText('Signed in as Sam Jones (sam@example.com).')).toBeInTheDocument();
		const switchLink = screen.getByRole('link', { name: 'Not you? Switch account' });
		expect(switchLink).toHaveAttribute(
			'href',
			`/logout?returnUrl=${encodeURIComponent('/oauth/authorize' + SEARCH)}`
		);
		expect(switchLink).toHaveAttribute('data-sveltekit-reload');
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
		);
	});

	it('has one polite live region from first render that announces the redirect', async () => {
		let resolveDescribe: (v: unknown) => void = () => undefined;
		describeMock.mockReturnValue(new Promise((r) => (resolveDescribe = r)));
		const { container } = render(Page);
		const live = screen.getByTestId('consent-live-region');
		expect(live).toHaveAttribute('aria-live', 'polite');
		expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
		await waitFor(() => expect(live).toHaveTextContent('Checking the request…'));
		resolveDescribe({ kind: 'redirect', redirectTo: 'https://acme.example/cb?code=1' });
		await waitFor(() => expect(live).toHaveTextContent('Redirecting to acme.example…'));
		expect(screen.getByTestId('consent-live-region')).toBe(live);
		expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
	});

	it('the error header is a single h1 with no duplicate kicker', async () => {
		describeMock.mockResolvedValue({ kind: 'failure' });
		const { container } = render(Page);
		await screen.findByRole('button', { name: 'Try again' });
		expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
		expect(container.textContent?.match(/Connect an app/g)).toHaveLength(1);
	});

	it('follows redirect_to immediately without a screen', async () => {
		describeMock.mockResolvedValue({
			kind: 'redirect',
			redirectTo: 'https://acme.example/cb?code=1'
		});
		render(Page);
		await waitFor(() =>
			expect(navigateMock).toHaveBeenCalledWith('https://acme.example/cb?code=1')
		);
		expect(screen.queryByRole('button', { name: 'Allow' })).toBeNull();
	});

	it('shows a 400 as an error on Revel and never navigates', async () => {
		describeMock.mockResolvedValue({
			kind: 'error',
			code: 'invalid_scope',
			detail: 'Scope org:nope is unknown.'
		});
		render(Page);
		expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent(
			"This app asked for permissions it can't request."
		);
		expect(screen.getByText('Scope org:nope is unknown.')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
		expect(navigateMock).not.toHaveBeenCalled();
	});

	it('offers Retry on a failure and re-runs the GET', async () => {
		describeMock
			.mockResolvedValueOnce({ kind: 'failure' })
			.mockResolvedValueOnce({ kind: 'describe', data: description() });
		render(Page);
		await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
		expect(await screen.findByRole('button', { name: 'Allow' })).toBeInTheDocument();
		expect(describeMock).toHaveBeenCalledTimes(2);
	});

	it('sends the user to login when the session is gone', async () => {
		describeMock.mockResolvedValue({ kind: 'unauthenticated' });
		render(Page);
		await waitFor(() =>
			expect(navigateMock).toHaveBeenCalledWith(
				`/login?returnUrl=${encodeURIComponent('/oauth/authorize' + SEARCH)}`
			)
		);
	});

	it('Allow posts the ticket and follows redirect_to; buttons aria-disable while submitting', async () => {
		describeMock.mockResolvedValue({ kind: 'describe', data: description() });
		let resolveDecision: (v: unknown) => void = () => undefined;
		decideMock.mockReturnValue(new Promise((r) => (resolveDecision = r)));
		render(Page);
		const allowButton = await screen.findByRole('button', { name: 'Allow' });
		await userEvent.click(allowButton);
		expect(decideMock).toHaveBeenCalledWith(SEARCH, { allow: true, consent_ticket: 'ticket-1' });
		// aria-disabled, never native disabled: focus must stay on the button.
		expect(allowButton).toHaveAttribute('aria-disabled', 'true');
		expect(screen.getByRole('button', { name: 'Deny' })).toHaveAttribute('aria-disabled', 'true');
		expect(allowButton).not.toBeDisabled();
		expect(document.activeElement).toBe(allowButton);
		expect(screen.getByTestId('consent-live-region')).toHaveTextContent('Sending…');
		await userEvent.click(allowButton);
		await userEvent.click(screen.getByRole('button', { name: 'Deny' }));
		expect(decideMock).toHaveBeenCalledTimes(1);
		expect(document.activeElement).not.toBe(document.body);
		resolveDecision({ kind: 'redirect', redirectTo: 'https://acme.example/cb?code=1&state=xyz' });
		await waitFor(() =>
			expect(navigateMock).toHaveBeenCalledWith('https://acme.example/cb?code=1&state=xyz')
		);
	});

	it('Deny posts allow:false and follows the access_denied redirect', async () => {
		describeMock.mockResolvedValue({ kind: 'describe', data: description() });
		decideMock.mockResolvedValue({
			kind: 'redirect',
			redirectTo: 'https://acme.example/cb?error=access_denied'
		});
		render(Page);
		await userEvent.click(await screen.findByRole('button', { name: 'Deny' }));
		expect(decideMock).toHaveBeenCalledWith(SEARCH, { allow: false });
		await waitFor(() =>
			expect(navigateMock).toHaveBeenCalledWith('https://acme.example/cb?error=access_denied')
		);
	});

	it('consent_required re-fetches and shows a polite notice without a second alert', async () => {
		describeMock.mockResolvedValue({
			kind: 'describe',
			data: description({ consent_ticket: 'ticket-2' })
		});
		decideMock.mockResolvedValue({ kind: 'error', code: 'consent_required', detail: 'Expired.' });
		render(Page);
		await userEvent.click(await screen.findByRole('button', { name: 'Allow' }));
		await waitFor(() => expect(describeMock).toHaveBeenCalledTimes(2));
		const live = screen.getByTestId('consent-live-region');
		await waitFor(() =>
			expect(live).toHaveTextContent('The screen expired. Please review the request again.')
		);
		expect(live.closest('[aria-live="polite"]')).not.toBeNull();
		expect(screen.getAllByRole('alert')).toHaveLength(1);
		expect(screen.getByRole('button', { name: 'Allow' })).not.toHaveAttribute('aria-disabled');
		expect(navigateMock).not.toHaveBeenCalled();
	});

	it('invalid_request on POST is a dead end with no Retry', async () => {
		describeMock.mockResolvedValue({ kind: 'describe', data: description() });
		decideMock.mockResolvedValue({
			kind: 'error',
			code: 'invalid_request',
			detail: 'Ticket mismatch.'
		});
		render(Page);
		await userEvent.click(await screen.findByRole('button', { name: 'Allow' }));
		expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent(
			"This app's request is invalid."
		);
		expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
		expect(navigateMock).not.toHaveBeenCalled();
	});

	it('a network failure on POST offers Retry that re-posts the same decision', async () => {
		describeMock.mockResolvedValue({ kind: 'describe', data: description() });
		decideMock
			.mockResolvedValueOnce({ kind: 'failure' })
			.mockResolvedValueOnce({ kind: 'redirect', redirectTo: 'https://acme.example/cb?code=2' });
		render(Page);
		await userEvent.click(await screen.findByRole('button', { name: 'Allow' }));
		await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
		expect(decideMock).toHaveBeenNthCalledWith(2, SEARCH, {
			allow: true,
			consent_ticket: 'ticket-1'
		});
		await waitFor(() =>
			expect(navigateMock).toHaveBeenCalledWith('https://acme.example/cb?code=2')
		);
	});
});
