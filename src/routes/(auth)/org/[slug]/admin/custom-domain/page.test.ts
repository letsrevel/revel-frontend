import { render, screen, within, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { resetDismissedForTests } from '$lib/utils/admin-warnings/dismissed.svelte';
import { customDomainQueryKey } from '$lib/components/organization/custom-domain/query-key';
import Page from './+page.svelte';

vi.mock('$app/paths', () => ({
	resolve: (p: string, params: { slug: string }) => p.replace('[slug]', params.slug)
}));
vi.mock('$lib/components/organization/custom-domain/custom-domain-api', () => ({
	getCustomDomain: vi.fn()
}));
vi.mock('$lib/components/organization/custom-domain/CustomDomainManager.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
import { getCustomDomain } from '$lib/components/organization/custom-domain/custom-domain-api';

function setup(org: Record<string, unknown>, enabled = false) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: Page,
			componentProps: {
				data: {
					customDomainEnabled: enabled,
					supportEmail: null,
					organization: { id: 'org-1', slug: 'acme', name: 'Acme', ...org }
				}
			}
		}
	});
	return client;
}

const domain = (status: string) => ({ hostname: 'events.acme.test', status });

describe('custom domain page: A5', () => {
	beforeEach(() => {
		localStorage.clear();
		resetDismissedForTests();
		vi.clearAllMocks();
	});

	it('shows A5 with a link to the visibility field for a restricted org with a domain', () => {
		setup({ visibility: 'members-only', custom_domain: 'events.acme.test' });
		const list = screen.getByTestId('custom-domain-warnings');
		expect(within(list).getByText('The custom domain shows a hidden organization')).toBeTruthy();
		const link = within(list).getByRole('link', { name: /Change visibility/ });
		expect(link.getAttribute('href')).toBe('/(auth)/org/acme/admin/settings#visibility');
		expect(within(list).getByRole('button', { name: /dismiss/i })).toBeTruthy();
	});

	it.each([
		['public org', { visibility: 'public', custom_domain: 'events.acme.test' }],
		['no domain', { visibility: 'private', custom_domain: null }]
	])('shows nothing for %s', (_n, org) => {
		setup(org);
		expect(within(screen.getByTestId('custom-domain-warnings')).queryByRole('listitem')).toBeNull();
	});

	it('gives the page heading an id so a dismissed list can hand focus to it', () => {
		setup({ visibility: 'private', custom_domain: 'events.acme.test' });
		const h1 = screen.getByRole('heading', { level: 1 });
		expect(h1.id).toBe('custom-domain-title');
		expect(h1.getAttribute('tabindex')).toBe('-1');
	});

	it('shows A5 from the query when the domain is active', async () => {
		vi.mocked(getCustomDomain).mockResolvedValue(domain('active') as never);
		setup({ visibility: 'private', custom_domain: null }, true);
		const list = screen.getByTestId('custom-domain-warnings');
		await waitFor(() =>
			expect(within(list).getByText('The custom domain shows a hidden organization')).toBeTruthy()
		);
	});

	it('drops A5 once the domain is removed in the manager (query data becomes null)', async () => {
		vi.mocked(getCustomDomain).mockResolvedValue(domain('active') as never);
		const client = setup({ visibility: 'private', custom_domain: 'events.acme.test' }, true);
		const list = screen.getByTestId('custom-domain-warnings');
		await waitFor(() =>
			expect(within(list).getByText('The custom domain shows a hidden organization')).toBeTruthy()
		);
		client.setQueryData(customDomainQueryKey('acme'), null);
		await waitFor(() =>
			expect(within(list).queryByText('The custom domain shows a hidden organization')).toBeNull()
		);
	});

	it('shows no A5 for a pending domain even if the snapshot has a hostname', async () => {
		vi.mocked(getCustomDomain).mockResolvedValue(domain('pending') as never);
		setup({ visibility: 'private', custom_domain: 'events.acme.test' }, true);
		await waitFor(() => expect(getCustomDomain).toHaveBeenCalled());
		await waitFor(() =>
			expect(
				within(screen.getByTestId('custom-domain-warnings')).queryByText(
					'The custom domain shows a hidden organization'
				)
			).toBeNull()
		);
	});
});
