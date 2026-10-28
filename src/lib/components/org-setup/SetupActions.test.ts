import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import SetupActions from './SetupActions.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type {
	SetupProgress,
	EventSetupState,
	StripeSetupState
} from '$lib/utils/org-setup-progress';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadmincoreStripeConnect: vi.fn()
}));
import { organizationadmincoreStripeConnect } from '$lib/api/generated/sdk.gen';

function progress(
	event: EventSetupState,
	stripe: StripeSetupState,
	latestDraft: SetupProgress['latestDraft'] = null
): SetupProgress {
	return { pageHidden: true, event, latestDraft, stripe, doneCount: 1, total: 5, allDone: false };
}

function setup(p: SetupProgress, density: 'full' | 'compact' = 'full') {
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: SetupActions,
			componentProps: {
				orgSlug: 'acme',
				progress: p,
				defaultStripeEmail: 'owner@acme.test',
				accessToken: 'tok',
				density
			}
		}
	});
}

describe('SetupActions', () => {
	beforeEach(() => vi.clearAllMocks());

	it('event none: create link', () => {
		setup(progress('none', 'none'));
		expect(screen.getByRole('heading', { name: 'Create your first event' })).toBeTruthy();
		expect(screen.getByRole('link', { name: /Create event/ }).getAttribute('href')).toBe(
			'/org/acme/admin/events/new'
		);
	});

	it('event draft: review and publish link to editor', () => {
		setup(progress('draft', 'none', { id: 'ev-1', name: 'Launch Party' }));
		expect(screen.getByRole('heading', { name: /Publish .Launch Party./ })).toBeTruthy();
		expect(screen.getByRole('link', { name: /Review and publish/ }).getAttribute('href')).toBe(
			'/org/acme/admin/events/ev-1/edit'
		);
	});

	it('event draft: shows publish body', () => {
		setup(progress('draft', 'none', { id: 'ev-1', name: 'Launch Party' }));
		expect(
			screen.getByText(
				'Only you can see drafts. Publishing puts it on your page with a link to share.'
			)
		).toBeTruthy();
	});

	it('event box is primary-bordered until published, neutral stripe box', () => {
		const { unmount } = render(QueryClientTestWrapper, {
			props: {
				client: new QueryClient(),
				component: SetupActions,
				componentProps: {
					orgSlug: 'acme',
					progress: progress('none', 'none'),
					defaultStripeEmail: '',
					accessToken: 't',
					density: 'compact'
				}
			}
		});
		const box = (id: string) => document.querySelector(`section[aria-labelledby="${id}"]`);
		expect(box('setup-event-title')?.className).toContain('border-2 border-primary');
		expect(box('setup-stripe-title')?.className).toContain('border-border');
		unmount();
		setup(progress('draft', 'none', { id: 'e', name: 'x' }));
		expect(box('setup-event-title')?.className).toContain('border-primary');
		document.body.innerHTML = '';
		setup(progress('published', 'none'));
		expect(box('setup-event-title')?.className).toContain('border-success');
		expect(box('setup-event-title')?.className).not.toContain('border-primary');
	});

	it('event published: done state without link', () => {
		setup(progress('published', 'none'));
		expect(screen.getByText('Your first event is live')).toBeTruthy();
		expect(screen.queryByRole('link', { name: /Create event|Review and publish/ })).toBeNull();
	});

	it('stripe none / incomplete / ready labels', () => {
		const { unmount } = render(QueryClientTestWrapper, {
			props: {
				client: new QueryClient(),
				component: SetupActions,
				componentProps: {
					orgSlug: 'acme',
					progress: progress('none', 'none'),
					defaultStripeEmail: '',
					accessToken: 't'
				}
			}
		});
		expect(screen.getByRole('button', { name: 'Connect Stripe' })).toBeTruthy();
		unmount();
		setup(progress('none', 'incomplete'));
		expect(screen.getByRole('button', { name: 'Finish Stripe setup' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Connect Stripe' })).toBeNull();
	});

	it('stripe ready: done text, no button', () => {
		setup(progress('none', 'ready'));
		expect(screen.getByText('Stripe connected. Paid tickets are ready.')).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Stripe/ })).toBeNull();
	});

	it('stripe needs-billing: tax details heading and link, no Stripe button', () => {
		setup(progress('none', 'needs-billing'));
		expect(
			screen.getByRole('heading', { name: 'Add tax details for online payments' })
		).toBeTruthy();
		const link = screen.getByRole('link', { name: 'Add tax details' });
		expect(link.getAttribute('href')).toBe('/org/acme/admin/billing');
		expect(screen.queryByRole('button', { name: /Stripe/ })).toBeNull();
	});

	it('full shows Start here, compact omits it', () => {
		setup(progress('none', 'none'), 'full');
		expect(screen.getByText('Start here')).toBeTruthy();
	});

	it('compact omits Start here and bullets', () => {
		setup(progress('none', 'none'), 'compact');
		expect(screen.queryByText('Start here')).toBeNull();
		expect(screen.queryByText('Free RSVPs work right away')).toBeNull();
	});

	describe('stripe confirm', () => {
		const originalLocation = window.location;
		let hrefSet: string | null;

		beforeEach(() => {
			hrefSet = null;
			const fake = {};
			Object.defineProperty(fake, 'href', {
				get: () => 'http://localhost/',
				set: (v: string) => {
					hrefSet = v;
				}
			});
			Object.defineProperty(window, 'location', { value: fake, configurable: true });
		});

		afterEach(() => {
			// The modal is still open when a test ends; bits-ui restores this on a delay.
			document.body.style.pointerEvents = '';
			Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
		});

		async function openAndConfirm(user: ReturnType<typeof userEvent.setup>) {
			await user.click(screen.getByRole('button', { name: 'Connect Stripe' }));
			const email = screen.getByLabelText(/email/i) as HTMLInputElement;
			expect(email.value).toBe('owner@acme.test');
			await user.click(screen.getByRole('button', { name: 'Connect to Stripe' }));
		}

		it('requests the link via the helper and redirects to the onboarding url', async () => {
			vi.mocked(organizationadmincoreStripeConnect).mockResolvedValue({
				data: { onboarding_url: 'https://stripe.test/x' }
			} as never);
			const user = userEvent.setup();
			setup(progress('none', 'none'));
			await openAndConfirm(user);
			await waitFor(() => expect(hrefSet).toBe('https://stripe.test/x'));
			expect(organizationadmincoreStripeConnect).toHaveBeenCalledWith({
				path: { slug: 'acme' },
				headers: { Authorization: 'Bearer tok' },
				body: { email: 'owner@acme.test', return_to: 'welcome' }
			});
		});

		it('shows the error in the modal and does not redirect on failure', async () => {
			vi.mocked(organizationadmincoreStripeConnect).mockResolvedValue({
				error: { detail: 'Stripe is unavailable' }
			} as never);
			const user = userEvent.setup();
			setup(progress('none', 'none'));
			await openAndConfirm(user);
			expect(await screen.findByText('Stripe is unavailable')).toBeTruthy();
			expect(hrefSet).toBeNull();
		});
	});
});
