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

const KEY = 'revel:org-setup-hidden:org-1';

const fresh: SetupProgress = {
	pageHidden: true,
	event: 'none',
	latestDraft: null,
	stripe: 'none',
	doneCount: 1,
	total: 5,
	allDone: false
};

function setup(progress: SetupProgress = fresh) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: SetupCard,
			componentProps: {
				orgId: 'org-1',
				orgSlug: 'acme',
				progress,
				visibility: progress.pageHidden ? 'private' : 'public',
				defaultStripeEmail: 'a@b.c',
				accessToken: 'tok'
			}
		}
	});
}

describe('SetupCard', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
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

	it('hide collapses and persists', async () => {
		const spy = vi.spyOn(Storage.prototype, 'setItem');
		const user = userEvent.setup();
		setup();
		await user.click(screen.getByRole('button', { name: 'Hide setup' }));
		expect(screen.getByText('Setup hidden.')).toBeTruthy();
		expect(spy).toHaveBeenCalledWith(KEY, '1');
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show it again' }));
		await user.click(screen.getByRole('button', { name: 'Show it again' }));
		expect(screen.getByText('Get set up · 1 of 5 done')).toBeTruthy();
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Hide setup' }));
	});

	it('remount with stored flag is collapsed', async () => {
		localStorage.setItem(KEY, '1');
		setup();
		expect(await screen.findByText('Setup hidden.')).toBeTruthy();
	});

	it('survives storage throwing', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('denied');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('denied');
		});
		const user = userEvent.setup();
		setup();
		expect(screen.getByText('Get set up · 1 of 5 done')).toBeTruthy();
		await user.click(screen.getByRole('button', { name: 'Hide setup' }));
		expect(screen.getByText('Setup hidden.')).toBeTruthy();
	});
});
