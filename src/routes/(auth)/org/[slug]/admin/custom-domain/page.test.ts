import { render, screen, within } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetDismissedForTests } from '$lib/utils/admin-warnings/dismissed.svelte';
import Page from './+page.svelte';

vi.mock('$app/paths', () => ({
	resolve: (p: string, params: { slug: string }) => p.replace('[slug]', params.slug)
}));

function setup(org: Record<string, unknown>) {
	return render(Page, {
		props: {
			data: {
				customDomainEnabled: false,
				supportEmail: null,
				organization: { id: 'org-1', slug: 'acme', name: 'Acme', ...org }
			} as never
		}
	});
}

describe('custom domain page: A5', () => {
	beforeEach(() => {
		localStorage.clear();
		resetDismissedForTests();
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
});
