import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn(), goto: vi.fn() }));
vi.mock('$app/stores', async () => {
	const { readable } = await import('svelte/store');
	return {
		page: readable({
			url: new URL('https://letsrevel.io/org/acme/admin/events/e1/edit'),
			data: {
				customDomains: { enabled: true, platformOrigin: 'https://letsrevel.io' },
				organization: {
					id: 'o1',
					slug: 'acme',
					name: 'Acme',
					custom_domain: 'events.acme.test',
					contact_email: 'o@acme.test'
				}
			}
		})
	};
});
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadmincoreStripeAccountVerify: vi.fn(),
	eventadmincoreUpdateEventStatus: vi.fn(),
	eventadmincoreDeleteEvent: vi.fn(),
	eventadmincoreCancellationRefundPreview: vi.fn()
}));
vi.mock('$lib/components/events/admin/EventEditor.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
vi.mock('$lib/components/events/admin/DuplicateEventModal.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
vi.mock('$lib/components/events/admin/CancelEventDialog.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));

function setup(status: string) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient(),
			component: Page,
			componentProps: {
				data: { event: { id: 'e1', name: 'Party', status, slug: 'party' }, isOwner: true }
			}
		}
	});
}

describe('event edit page: preview and share links', () => {
	const url = '/org/acme/admin/events/e1/edit';
	afterEach(() => window.history.replaceState({}, '', '/'));
	beforeEach(() => vi.clearAllMocks());

	it('draft preview stays on the platform, even for a custom-domain org', () => {
		setup('draft');
		const href = screen.getByRole('link', { name: 'Preview' }).getAttribute('href') ?? '';
		expect(href).not.toMatch(/^https?:/);
		expect(href).toMatch(/events\/acme\/party$/);
	});

	it('?published=1 shows the share card once, with the custom-domain URL, and strips the param', () => {
		window.history.replaceState({}, '', `${url}?tab=ticketing&published=1`);
		setup('open');
		expect((screen.getByLabelText('Event link') as HTMLInputElement).value).toBe(
			'https://events.acme.test/events/acme/party'
		);
		expect(window.location.search).toBe('?tab=ticketing');
	});

	it('an open event without ?published=1 shows no share card', () => {
		window.history.replaceState({}, '', `${url}?tab=ticketing`);
		setup('open');
		expect(screen.queryByTestId('publish-share-card')).toBeNull();
	});
});
