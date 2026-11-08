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

	it('success: announced via status, heading focused, links to the org and memberships', async () => {
		renderPage({
			signedIn: true,
			claim: { outcome: 'success', organizationSlug: 'verein-x', recordId: 'r1' }
		});
		expect(screen.getByRole('status')).toHaveTextContent('Membership linked');
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

	it('409 shows the backend detail verbatim, or a generic fallback', () => {
		renderPage({ signedIn: true, claim: { outcome: 'conflict', detail: 'Server sentence.' } });
		expect(screen.getByRole('alert')).toHaveTextContent('Server sentence.');
	});

	it('409 without a detail falls back to generic copy', () => {
		renderPage({ signedIn: true, claim: { outcome: 'conflict', detail: null } });
		expect(screen.getByRole('alert')).toHaveTextContent("couldn't be linked");
	});

	it('403 and 404 outcomes are announced as alerts and focus the heading', async () => {
		renderPage({ signedIn: true, claim: { outcome: 'forbidden' } });
		expect(screen.getByRole('alert')).toHaveTextContent("You can't join this organization");
		await vi.waitFor(() =>
			expect(screen.getByRole('heading', { name: /can't join/i })).toHaveFocus()
		);
	});

	it('claim 404 shows invitation not found', () => {
		renderPage({ signedIn: true, claim: { outcome: 'not_found' } });
		expect(screen.getByRole('alert')).toHaveTextContent('Invitation not found');
	});

	it.each<[ClaimResult, string]>([
		[{ outcome: 'throttled' }, 'Too many attempts'],
		[{ outcome: 'error' }, 'Something went wrong']
	])('retryable outcome %j keeps the confirm button', (claim, text) => {
		renderPage({ signedIn: true, claim });
		expect(screen.getByRole('alert')).toHaveTextContent(text);
		expect(screen.getByRole('button', { name: 'Link to my account' })).toBeEnabled();
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
