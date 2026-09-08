import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SalesBySourceCard from './SalesBySourceCard.svelte';
import type { TicketAttributionBucketSchema } from '$lib/api/generated/types.gen';

const buckets: TicketAttributionBucketSchema[] = [
	{
		utm_source: 'newsletter',
		utm_medium: 'email',
		utm_campaign: 'spring-2026',
		utm_content: null,
		count: 2
	},
	{
		utm_source: 'revel-embed',
		utm_medium: 'embed',
		utm_campaign: null,
		utm_content: 'partner.example.org',
		count: 1
	},
	{ utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, count: 1 }
];
const currentUrl = new URL('https://x.test/org/acme/admin/events/e1/tickets?status=active&page=3');

describe('SalesBySourceCard', () => {
	it('renders one row per bucket with counts, and the null bucket as Direct', () => {
		render(SalesBySourceCard, { buckets, currentUrl });
		expect(screen.getByText('newsletter')).toBeInTheDocument();
		expect(screen.getByText('Direct')).toBeInTheDocument();
		expect(screen.getByText('2')).toBeInTheDocument();
	});

	it('tagged rows link to a same-page utm filter, preserving other filters and resetting page', () => {
		render(SalesBySourceCard, { buckets, currentUrl });
		const link = screen.getByRole('link', { name: /newsletter/ });
		const href = new URL(link.getAttribute('href') ?? '', currentUrl);
		expect(href.searchParams.get('utm_source')).toBe('newsletter');
		expect(href.searchParams.get('utm_campaign')).toBe('spring-2026');
		expect(href.searchParams.get('status')).toBe('active');
		expect(href.searchParams.get('page')).toBeNull();
	});

	it('a bucket without a campaign filters by source only', () => {
		render(SalesBySourceCard, { buckets, currentUrl });
		const link = screen.getByRole('link', { name: /revel-embed/ });
		const href = new URL(link.getAttribute('href') ?? '', currentUrl);
		expect(href.searchParams.get('utm_source')).toBe('revel-embed');
		expect(href.searchParams.get('utm_campaign')).toBeNull();
	});

	it('the Direct row is not a link', () => {
		render(SalesBySourceCard, { buckets, currentUrl });
		expect(screen.queryByRole('link', { name: /Direct/ })).toBeNull();
	});

	it('marks the active row and offers a clear link when the URL is filtered', () => {
		const filtered = new URL(
			String(currentUrl) + '&utm_source=newsletter&utm_campaign=spring-2026'
		);
		render(SalesBySourceCard, { buckets, currentUrl: filtered });
		expect(screen.getByRole('link', { name: /newsletter/ })).toHaveAttribute(
			'aria-current',
			'true'
		);
		const clear = screen.getByRole('link', { name: /Clear filter/ });
		const href = new URL(clear.getAttribute('href') ?? '', filtered);
		expect(href.searchParams.get('utm_source')).toBeNull();
		expect(href.searchParams.get('utm_campaign')).toBeNull();
		expect(href.searchParams.get('status')).toBe('active');
	});

	it('shows the all-direct empty state when only the direct bucket exists', () => {
		render(SalesBySourceCard, { buckets: [buckets[2]], currentUrl });
		expect(screen.getByText(/direct so far/i)).toBeInTheDocument();
		expect(screen.queryByRole('table')).toBeNull();
	});
});
