import { invalidateAll } from '$app/navigation';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import SetupCard from './SetupCard.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { SetupProgress } from '$lib/utils/org-setup-progress';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadmincoreUpdateOrganization: vi.fn()
}));
vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn().mockResolvedValue(undefined),
	goto: vi.fn()
}));

const COOKIE = 'revel_setup_hidden_org-1';

const fresh: SetupProgress = {
	pageHidden: true,
	event: 'none',
	latestDraft: null,
	stripe: 'none',
	doneCount: 1,
	total: 5,
	allDone: false
};

function setup(progress: SetupProgress | null = fresh, extra: Record<string, unknown> = {}) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: SetupCard,
			componentProps: {
				orgId: 'org-1',
				orgSlug: 'acme',
				progress,
				visibility: progress?.pageHidden ? 'private' : 'public',
				defaultStripeEmail: 'a@b.c',
				accessToken: 'tok',
				...extra
			}
		}
	});
}

describe('SetupCard', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		document.cookie = `${COOKIE}=; path=/; max-age=0`;
	});
	afterEach(() => vi.restoreAllMocks());

	it('shows kicker and progressbar for a fresh org', () => {
		setup();
		expect(screen.getByText('Get set up · 1 of 5 done')).toBeTruthy();
		const bar = screen.getByRole('progressbar');
		expect(bar.getAttribute('aria-valuenow')).toBe('1');
		expect(bar.getAttribute('aria-valuemax')).toBe('5');
		expect(screen.getByRole('heading', { name: "Let's get your first event out" })).toBeTruthy();
	});

	it('picks the headline from progress', () => {
		setup({ ...fresh, event: 'draft', latestDraft: { id: 'e', name: 'X' } });
		expect(screen.getByRole('heading', { name: 'Your draft is ready to publish' })).toBeTruthy();
	});

	it('renders nothing once an event is published, even with Stripe and visibility outstanding', () => {
		const { container } = setup({ ...fresh, event: 'published', doneCount: 3 });
		expect(screen.queryByTestId('org-setup-card')).toBeNull();
		expect(container.textContent?.trim()).toBe('');
	});

	it('renders for a draft event', () => {
		setup({ ...fresh, event: 'draft', latestDraft: { id: 'e', name: 'X' }, doneCount: 2 });
		expect(screen.getByTestId('org-setup-card')).toBeTruthy();
	});

	it('progressbar exposes the readable value and steps read with a separator', () => {
		setup();
		expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('1 of 5 done');
		const created = screen.getByText('Organization created').closest('li');
		expect(created?.textContent?.replace(/\s+/g, ' ').trim()).toMatch(
			/^Organization created ?, Done$/
		);
	});

	it('hide collapses and sets the UI cookie', async () => {
		const user = userEvent.setup();
		setup();
		await user.click(screen.getByRole('button', { name: 'Hide setup' }));
		expect(screen.getByText('Setup hidden.')).toBeTruthy();
		expect(document.cookie).toContain(`${COOKIE}=1`);
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show it again' }));
	});

	it('show it again clears the cookie, reloads data and refocuses Hide', async () => {
		const user = userEvent.setup();
		setup();
		await user.click(screen.getByRole('button', { name: 'Hide setup' }));
		await user.click(screen.getByRole('button', { name: 'Show it again' }));
		expect(document.cookie).not.toContain(COOKIE);
		expect(invalidateAll).toHaveBeenCalled();
		expect(screen.getByText('Get set up · 1 of 5 done')).toBeTruthy();
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Hide setup' }));
	});

	it('server-hidden render (no progress, hidden=true) is the collapsed line', () => {
		setup(null, { hidden: true });
		expect(screen.getByText('Setup hidden.')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Show it again' })).toBeTruthy();
		expect(screen.queryByTestId('org-setup-card')).toBeNull();
	});
});
