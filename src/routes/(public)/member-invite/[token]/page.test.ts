import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MemberInvitePage from './+page.svelte';
import type { ClaimResult, InvitePreview } from './+page.server';

const authState = vi.hoisted(() => ({ email: 'me@example.com' as string | null }));
vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: {
		get user() {
			return authState.email ? { email: authState.email } : null;
		}
	}
}));

const okPreview: InvitePreview = {
	status: 'ok',
	organizationName: 'Verein X',
	organizationSlug: 'verein-x',
	fullName: 'Ada Lovelace'
};

function renderPage(opts: {
	preview?: InvitePreview;
	signedIn?: boolean;
	claim?: ClaimResult;
}): void {
	render(MemberInvitePage, {
		props: {
			data: {
				token: 'tok/1',
				preview: opts.preview ?? okPreview,
				signedIn: opts.signedIn ?? false
			},
			form: opts.claim ? { claim: opts.claim } : undefined
		} as never
	});
}

describe('member-invite page (#1171)', () => {
	beforeEach(() => {
		authState.email = 'me@example.com';
		vi.stubGlobal('fetch', vi.fn());
	});

	it('shows the entry name, not the account email, and tells the page not to be indexed', () => {
		renderPage({ signedIn: true });
		expect(screen.getByTestId('member-invite-entry')).toHaveTextContent('Ada Lovelace');
		expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
			'content',
			'noindex,nofollow'
		);
		expect(document.head.querySelector('meta[name="referrer"]')).toHaveAttribute(
			'content',
			'no-referrer'
		);
	});

	it('logged out: login and register links carry the invite as returnUrl', () => {
		renderPage({ signedIn: false });
		const target = encodeURIComponent('/member-invite/tok%2F1');
		expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
			'href',
			expect.stringMatching(new RegExp(`^/login\\?returnUrl=${target}$`))
		);
		expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
			'href',
			expect.stringMatching(new RegExp(`^/register\\?returnUrl=${target}$`))
		);
		expect(screen.queryByRole('button', { name: /link to my account/i })).not.toBeInTheDocument();
	});

	it('logged in: shows the confirm button and a sign-out link back to the invite, and sends nothing', () => {
		renderPage({ signedIn: true });
		expect(screen.getByText(/signed in as me@example\.com/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Link to my account' })).toBeEnabled();
		expect(screen.getByRole('link', { name: /sign out/i })).toHaveAttribute(
			'href',
			expect.stringContaining('/logout?returnUrl=')
		);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('logged in without a hydrated email still asks for the confirm', () => {
		authState.email = null;
		renderPage({ signedIn: true });
		expect(screen.getByRole('button', { name: 'Link to my account' })).toBeInTheDocument();
	});

	it('success: heading focused (no double live region), links to the org and memberships', async () => {
		renderPage({
			signedIn: true,
			claim: {
				outcome: 'success',
				organizationSlug: 'verein-x',
				organizationName: 'Verein X',
				recordId: 'r1'
			}
		});
		expect(screen.getByTestId('member-invite-result')).toHaveTextContent('Membership linked');
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		await vi.waitFor(() =>
			expect(screen.getByRole('heading', { name: 'Membership linked' })).toHaveFocus()
		);
		expect(screen.getByRole('link', { name: 'Go to Verein X' })).toHaveAttribute(
			'href',
			'/org/verein-x'
		);
		expect(screen.getByRole('link', { name: 'My memberships' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Link to my account' })).not.toBeInTheDocument();
	});

	it('409 already_member shows dedicated copy, not the backend detail', () => {
		renderPage({
			signedIn: true,
			claim: { outcome: 'conflict', code: 'already_member', detail: 'Server sentence.' }
		});
		const result = screen.getByTestId('member-invite-result');
		expect(result).toHaveTextContent('You already have a membership in this organization.');
		expect(result).not.toHaveTextContent('Server sentence.');
	});

	it('409 not_started shows dedicated copy', () => {
		renderPage({
			signedIn: true,
			claim: { outcome: 'conflict', code: 'not_started', detail: 'Server sentence.' }
		});
		expect(screen.getByTestId('member-invite-result')).toHaveTextContent(
			"This membership hasn't started yet. Try the link again once it has."
		);
	});

	it('409 with an unknown code falls back to the backend detail', () => {
		renderPage({
			signedIn: true,
			claim: { outcome: 'conflict', code: null, detail: 'Server sentence.' }
		});
		expect(screen.getByTestId('member-invite-result')).toHaveTextContent('Server sentence.');
	});

	it('409 without a code or detail falls back to generic copy', () => {
		renderPage({ signedIn: true, claim: { outcome: 'conflict', code: null, detail: null } });
		expect(screen.getByTestId('member-invite-result')).toHaveTextContent("couldn't be linked");
	});

	it('403 outcome focuses the heading and shows the detail as secondary text', async () => {
		renderPage({ signedIn: true, claim: { outcome: 'forbidden', detail: 'Blocked.' } });
		expect(screen.getByTestId('member-invite-result')).toHaveTextContent(
			"You can't join this organization"
		);
		expect(screen.getByTestId('member-invite-result-note')).toHaveTextContent('Blocked.');
		await vi.waitFor(() =>
			expect(screen.getByRole('heading', { name: /can't join/i })).toHaveFocus()
		);
	});

	it('403 without a detail shows no secondary text', () => {
		renderPage({ signedIn: true, claim: { outcome: 'forbidden', detail: null } });
		expect(screen.queryByTestId('member-invite-result-note')).toBeNull();
	});

	it('claim 404 shows invitation not found', () => {
		renderPage({ signedIn: true, claim: { outcome: 'not_found' } });
		expect(screen.getByTestId('member-invite-result')).toHaveTextContent('Invitation not found');
	});

	it.each<[ClaimResult, string]>([
		[{ outcome: 'throttled' }, 'Too many attempts'],
		[{ outcome: 'error' }, 'Something went wrong']
	])('retryable outcome %j keeps the confirm button', (claim, text) => {
		renderPage({ signedIn: true, claim });
		expect(screen.getByTestId('member-invite-result')).toHaveTextContent(text);
		expect(screen.getByRole('button', { name: 'Link to my account' })).toBeEnabled();
	});

	it('success still renders when the preview is not_found (token consumed, no-JS reload)', () => {
		renderPage({
			preview: { status: 'not_found' },
			signedIn: true,
			claim: {
				outcome: 'success',
				organizationSlug: 'verein-x',
				organizationName: 'Verein X',
				recordId: 'r1'
			}
		});
		expect(screen.getByRole('heading', { name: 'Membership linked' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Go to Verein X' })).toHaveAttribute(
			'href',
			'/org/verein-x'
		);
		expect(screen.queryByText('Invitation not found')).not.toBeInTheDocument();
	});

	it('success falls back to the slug when the org name is unknown', () => {
		renderPage({
			preview: { status: 'not_found' },
			claim: {
				outcome: 'success',
				organizationSlug: 'verein-x',
				organizationName: null,
				recordId: 'r1'
			}
		});
		expect(screen.getByRole('link', { name: 'Go to verein-x' })).toBeInTheDocument();
	});

	it('unauthenticated: session-expired copy, login link with returnUrl, no confirm button', () => {
		renderPage({ signedIn: true, claim: { outcome: 'unauthenticated' } });
		expect(screen.getByTestId('member-invite-result')).toHaveTextContent(
			'Your session has expired. Log in again to link this membership.'
		);
		expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
			'href',
			expect.stringContaining('/login?returnUrl=')
		);
		expect(screen.queryByRole('button', { name: 'Link to my account' })).not.toBeInTheDocument();
	});

	it('preview 404 renders the not-found state with a link home', () => {
		renderPage({ preview: { status: 'not_found' } });
		expect(screen.getByRole('heading', { level: 1, name: 'Invitation not found' })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
		expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
	});

	it('preview 429 renders the throttled state', () => {
		renderPage({ preview: { status: 'throttled' } });
		expect(screen.getByRole('heading', { level: 1, name: 'Too many attempts' })).toBeVisible();
	});

	it('preview failure renders a retry state', () => {
		renderPage({ preview: { status: 'error' } });
		expect(screen.getByRole('link', { name: 'Retry' })).toBeInTheDocument();
	});
});
