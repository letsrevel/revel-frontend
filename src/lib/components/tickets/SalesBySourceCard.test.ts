import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
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

// Most of these tests are about row/link/filter rendering, not the disclosure
// behavior — render with `collapsible: false` (today's always-open markup) so
// content is directly queryable, exactly as it was before the card became
// collapsible by default. The `collapsible` describe block below covers the
// disclosure itself.
describe('SalesBySourceCard', () => {
	it('renders one row per bucket with counts, and the null bucket as Direct', () => {
		render(SalesBySourceCard, { buckets, currentUrl, collapsible: false });
		expect(screen.getByText('newsletter')).toBeInTheDocument();
		expect(screen.getByText('Direct')).toBeInTheDocument();
		expect(screen.getByText('2')).toBeInTheDocument();
	});

	it('renders the "Sales by source" heading by default', () => {
		render(SalesBySourceCard, { buckets, currentUrl, collapsible: false });
		expect(screen.getByRole('heading', { name: 'Sales by source' })).toBeInTheDocument();
	});

	it('tagged rows link to a same-page utm filter, preserving other filters and resetting page', () => {
		render(SalesBySourceCard, { buckets, currentUrl, collapsible: false });
		const link = screen.getByRole('link', { name: /newsletter/ });
		const href = new URL(link.getAttribute('href') ?? '', currentUrl);
		expect(href.searchParams.get('utm_source')).toBe('newsletter');
		expect(href.searchParams.get('utm_campaign')).toBe('spring-2026');
		expect(href.searchParams.get('status')).toBe('active');
		expect(href.searchParams.get('page')).toBeNull();
	});

	it('a bucket without a campaign filters by source only', () => {
		render(SalesBySourceCard, { buckets, currentUrl, collapsible: false });
		const link = screen.getByRole('link', { name: /revel-embed/ });
		const href = new URL(link.getAttribute('href') ?? '', currentUrl);
		expect(href.searchParams.get('utm_source')).toBe('revel-embed');
		expect(href.searchParams.get('utm_campaign')).toBeNull();
	});

	it('the Direct row is not a link', () => {
		render(SalesBySourceCard, { buckets, currentUrl, collapsible: false });
		expect(screen.queryByRole('link', { name: /Direct/ })).toBeNull();
	});

	it('marks the active row and offers a clear link when the URL is filtered', () => {
		const filtered = new URL(
			String(currentUrl) + '&utm_source=newsletter&utm_campaign=spring-2026'
		);
		render(SalesBySourceCard, { buckets, currentUrl: filtered, collapsible: false });
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
		render(SalesBySourceCard, { buckets: [buckets[2]], currentUrl, collapsible: false });
		expect(screen.getByText(/direct so far/i)).toBeInTheDocument();
		expect(screen.queryByRole('table')).toBeNull();
	});

	it('a bucket with neither utm_source nor utm_campaign renders as a non-link row, not active', () => {
		const untaggedBucket: TicketAttributionBucketSchema = {
			utm_source: null,
			utm_medium: 'social',
			utm_campaign: null,
			utm_content: 'story',
			count: 5
		};
		render(SalesBySourceCard, {
			buckets: [...buckets, untaggedBucket],
			currentUrl,
			collapsible: false
		});
		expect(screen.getByText('social · story')).toBeInTheDocument();
		expect(screen.getByText('5')).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: /social · story/ })).toBeNull();
		// No row in the table carries aria-current on this unfiltered URL.
		expect(document.querySelector('[aria-current]')).toBeNull();
	});

	it('sanitizes junk currentUrl utm_source/utm_campaign instead of rendering a chip or an active row', () => {
		const junkUrl = new URL(String(currentUrl) + '&utm_source=%20%20&utm_campaign=');
		render(SalesBySourceCard, { buckets, currentUrl: junkUrl, collapsible: false });
		expect(screen.queryByText(/Filtered by/)).toBeNull();
		expect(screen.queryByRole('link', { name: /Clear filter/ })).toBeNull();
		expect(document.querySelector('[aria-current]')).toBeNull();
	});

	describe('filterable={false}', () => {
		const filteredUrl = new URL(
			String(currentUrl) + '&utm_source=newsletter&utm_campaign=spring-2026'
		);

		it('renders every bucket as a plain row, with no links at all', () => {
			render(SalesBySourceCard, {
				buckets,
				currentUrl: filteredUrl,
				filterable: false,
				collapsible: false
			});
			expect(screen.queryByRole('link')).toBeNull();
		});

		it('marks no row as active', () => {
			render(SalesBySourceCard, {
				buckets,
				currentUrl: filteredUrl,
				filterable: false,
				collapsible: false
			});
			expect(document.querySelector('[aria-current]')).toBeNull();
		});

		it('never renders the "Filtered by" chip or clear link', () => {
			render(SalesBySourceCard, {
				buckets,
				currentUrl: filteredUrl,
				filterable: false,
				collapsible: false
			});
			expect(screen.queryByText(/Filtered by/)).toBeNull();
			expect(screen.queryByText(/Clear filter/)).toBeNull();
		});

		it('still renders bucket labels and counts', () => {
			render(SalesBySourceCard, {
				buckets,
				currentUrl: filteredUrl,
				filterable: false,
				collapsible: false
			});
			expect(screen.getByText('newsletter')).toBeInTheDocument();
			expect(screen.getByText('revel-embed')).toBeInTheDocument();
			expect(screen.getByText('Direct')).toBeInTheDocument();
			expect(screen.getByText('2')).toBeInTheDocument();
			expect(screen.getAllByText('1')).toHaveLength(2);
		});
	});

	describe('showHeading={false}', () => {
		it('does not render a heading, but the table keeps its accessible name via the sr-only caption', () => {
			render(SalesBySourceCard, { buckets, currentUrl, showHeading: false, collapsible: false });
			expect(screen.queryByRole('heading')).toBeNull();
			expect(
				screen.getByRole('table', { name: 'Non-cancelled tickets grouped by campaign tag' })
			).toBeInTheDocument();
		});

		it('still renders bucket labels and counts', () => {
			render(SalesBySourceCard, { buckets, currentUrl, showHeading: false, collapsible: false });
			expect(screen.getByText('newsletter')).toBeInTheDocument();
			expect(screen.getByText('Direct')).toBeInTheDocument();
		});

		it('leaves the "Filtered by" chip logic untouched — still keyed to filterable', () => {
			const filteredUrl = new URL(
				String(currentUrl) + '&utm_source=newsletter&utm_campaign=spring-2026'
			);
			render(SalesBySourceCard, {
				buckets,
				currentUrl: filteredUrl,
				showHeading: false,
				filterable: true,
				collapsible: false
			});
			expect(screen.getByText(/Filtered by/)).toBeInTheDocument();
			expect(screen.queryByRole('heading')).toBeNull();
		});
	});
});

describe('SalesBySourceCard collapsible (default)', () => {
	it('renders as a <details> with the heading in the summary', () => {
		render(SalesBySourceCard, { buckets, currentUrl });
		const details = document.querySelector('details');
		expect(details).not.toBeNull();
		expect(details?.querySelector('summary')).toContainElement(
			screen.getByRole('heading', { name: 'Sales by source' })
		);
	});

	it('is collapsed by default: row content is not visible until opened', () => {
		render(SalesBySourceCard, { buckets, currentUrl });
		const details = document.querySelector('details') as HTMLDetailsElement;
		expect(details.open).toBe(false);
		expect(screen.getByText('newsletter')).not.toBeVisible();
	});

	it('opens on clicking the summary, revealing the table', async () => {
		const user = userEvent.setup();
		render(SalesBySourceCard, { buckets, currentUrl });
		await user.click(screen.getByRole('heading', { name: 'Sales by source' }));
		const details = document.querySelector('details') as HTMLDetailsElement;
		expect(details.open).toBe(true);
		expect(screen.getByText('newsletter')).toBeVisible();
	});

	it('auto-opens when the current URL carries an active utm filter', () => {
		const filtered = new URL(
			String(currentUrl) + '&utm_source=newsletter&utm_campaign=spring-2026'
		);
		render(SalesBySourceCard, { buckets, currentUrl: filtered });
		const details = document.querySelector('details') as HTMLDetailsElement;
		expect(details.open).toBe(true);
		expect(screen.getByText(/Filtered by/)).toBeVisible();
	});

	it('manual toggling persists: closing after an auto-open stays closed', async () => {
		const user = userEvent.setup();
		const filtered = new URL(
			String(currentUrl) + '&utm_source=newsletter&utm_campaign=spring-2026'
		);
		render(SalesBySourceCard, { buckets, currentUrl: filtered });
		const details = document.querySelector('details') as HTMLDetailsElement;
		expect(details.open).toBe(true);

		await user.click(screen.getByRole('heading', { name: 'Sales by source' }));
		expect(details.open).toBe(false);
	});
});

describe('SalesBySourceCard collapsible={false}', () => {
	it('renders no <details> element — plain always-visible markup', () => {
		render(SalesBySourceCard, { buckets, currentUrl, collapsible: false });
		expect(document.querySelector('details')).toBeNull();
		expect(screen.getByText('newsletter')).toBeInTheDocument();
	});
});
