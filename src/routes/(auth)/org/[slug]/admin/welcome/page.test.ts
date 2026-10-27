import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadmincoreUpdateOrganization: vi.fn(),
	organizationadmincoreStripeConnect: vi.fn()
}));

function setup(setupCounts: unknown) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient(),
			component: Page,
			componentProps: {
				data: {
					organization: {
						id: 'o1',
						slug: 'acme',
						name: 'Acme',
						visibility: 'private',
						contact_email: null
					},
					setupCounts
				}
			}
		}
	});
}

describe('launchpad headline follows progress', () => {
	it('none: original title and subtitle', () => {
		setup({ eventCount: 0, publishedCount: 0, latestDraft: null });
		expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
			'Now put something on the calendar'
		);
		expect(screen.getByText('Start with the event. Payments can follow.')).toBeTruthy();
	});

	it('draft: waiting title and next-steps subtitle', () => {
		setup({ eventCount: 1, publishedCount: 0, latestDraft: { id: 'e', name: 'D' } });
		expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
			'Your first event is waiting'
		);
		expect(screen.getByText("Finish the last steps whenever you're ready.")).toBeTruthy();
	});

	it('published: live title', () => {
		setup({ eventCount: 1, publishedCount: 1, latestDraft: null });
		expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
			'Your first event is live'
		);
	});

	it('later links render as a list (separators are CSS only)', () => {
		setup({ eventCount: 0, publishedCount: 0, latestDraft: null });
		const list = screen.getByRole('link', { name: 'add a logo' }).closest('ul') as HTMLElement;
		expect(list.querySelectorAll('li a').length).toBe(3);
		expect(list.textContent).not.toContain('·');
	});
});
