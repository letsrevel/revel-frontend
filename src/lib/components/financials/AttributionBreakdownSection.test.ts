import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import AttributionBreakdownSection from './AttributionBreakdownSection.svelte';
import type {
	EventInListSchema,
	TicketAttributionBucketSchema
} from '$lib/api/generated/types.gen';
import { goto } from '$app/navigation';
import {
	eventpublicdiscoveryListEvents,
	organizationadminticketsTicketAttributionBreakdown
} from '$lib/api/generated/sdk.gen';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

// A minimal store-shaped `page` whose value tests can change with
// `setPageUrl` before each render — `$app/stores`'s real `page` reflects
// nothing outside a real SvelteKit navigation, so it's mocked directly (same
// approach the tickets page test used before this section moved here).
vi.mock('$app/stores', () => {
	let value = { url: new URL('http://localhost/org/acme/admin/financials') };
	const subscribers = new Set<(v: typeof value) => void>();
	const page = {
		subscribe(fn: (v: typeof value) => void) {
			fn(value);
			subscribers.add(fn);
			return () => subscribers.delete(fn);
		}
	};
	(globalThis as unknown as { __setPageUrl: (url: URL) => void }).__setPageUrl = (url: URL) => {
		value = { url };
		subscribers.forEach((fn) => fn(value));
	};
	return { page };
});

function setPageUrl(url: string) {
	(globalThis as unknown as { __setPageUrl: (url: URL) => void }).__setPageUrl(new URL(url));
}

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	eventpublicdiscoveryListEvents: vi.fn(),
	organizationadminticketsTicketAttributionBreakdown: vi.fn()
}));

type EventsResult = Awaited<ReturnType<typeof eventpublicdiscoveryListEvents>>;
type BreakdownResult = Awaited<
	ReturnType<typeof organizationadminticketsTicketAttributionBreakdown>
>;

function ev(overrides: Partial<EventInListSchema>): EventInListSchema {
	return {
		id: '11111111-1111-4111-8111-111111111111',
		name: 'Summer Gala',
		slug: 'summer-gala',
		start: '2026-09-01T18:00:00Z',
		end: '2026-09-01T22:00:00Z',
		status: 'open',
		requires_ticket: true,
		timezone: 'UTC',
		...overrides
	} as EventInListSchema;
}

function bucket(
	overrides: Partial<TicketAttributionBucketSchema> = {}
): TicketAttributionBucketSchema {
	return {
		utm_source: null,
		utm_medium: null,
		utm_campaign: null,
		utm_content: null,
		count: 3,
		...overrides
	};
}

/**
 * bits-ui positions its Select/DropdownMenu popovers with floating-ui, which
 * needs real layout. jsdom never lays out, so the popover keeps floating-ui's
 * pre-positioning `visibility: hidden`, excluding it from the accessibility
 * tree. Reveal it — what the browser does once floating-ui settles — so
 * `getByRole` can find the items. (Recipe mirrored from the former tickets
 * page test / MembersTab.test.ts.)
 */
async function revealOpenPopover(selector: string) {
	const content = await waitFor(() => {
		const el = document.querySelector(selector);
		if (!el) throw new Error(`the popover for ${selector} never opened`);
		return el;
	});
	const floatingWrapper = content.parentElement;
	if (floatingWrapper instanceof HTMLElement) {
		floatingWrapper.style.visibility = 'visible';
	}
}

beforeAll(() => {
	// bits-ui 2's Select captures the pointer and scrolls the highlighted
	// option into view; jsdom implements neither API.
	const noop = (): void => {
		// no-op: jsdom has no layout and no pointer capture
	};
	if (typeof Element.prototype.hasPointerCapture !== 'function') {
		Element.prototype.hasPointerCapture = (): boolean => false;
		Element.prototype.setPointerCapture = noop;
		Element.prototype.releasePointerCapture = noop;
	}
	if (typeof Element.prototype.scrollIntoView !== 'function') {
		Element.prototype.scrollIntoView = noop;
	}
});

afterEach(async () => {
	vi.clearAllMocks();
	setPageUrl('http://localhost/org/acme/admin/financials');
	// bits-ui's body-scroll-lock schedules a ~24ms setTimeout on unmount to
	// restore `document.body`'s inline style (see the former tickets page test).
	await new Promise((resolve) => setTimeout(resolve, 50));
	document.body.removeAttribute('style');
});

function renderSection() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: AttributionBreakdownSection,
			componentProps: { slug: 'acme', organizationId: 'org-1' }
		}
	});
}

describe('AttributionBreakdownSection', () => {
	it('renders a closed <details> with the heading in the summary, and never fetches before it opens', () => {
		vi.mocked(eventpublicdiscoveryListEvents).mockResolvedValue({
			data: { results: [] },
			error: undefined
		} as unknown as EventsResult);
		vi.mocked(organizationadminticketsTicketAttributionBreakdown).mockResolvedValue({
			data: [],
			error: undefined
		} as unknown as BreakdownResult);

		renderSection();

		const details = document.querySelector('details') as HTMLDetailsElement;
		expect(details.open).toBe(false);
		// The heading lives in the <summary>, which stays visible/clickable even
		// closed — it's the body's controls that are hidden until opened.
		expect(screen.getByRole('heading', { name: 'Sales by source' })).toBeVisible();
		expect(screen.getByLabelText('Time range')).not.toBeVisible();
		expect(eventpublicdiscoveryListEvents).not.toHaveBeenCalled();
		expect(organizationadminticketsTicketAttributionBreakdown).not.toHaveBeenCalled();
	});

	it('opening the disclosure reveals the controls and fetches events + the breakdown', async () => {
		const user = userEvent.setup();
		vi.mocked(eventpublicdiscoveryListEvents).mockResolvedValue({
			data: { results: [ev({})] },
			error: undefined
		} as unknown as EventsResult);
		vi.mocked(organizationadminticketsTicketAttributionBreakdown).mockResolvedValue({
			data: [bucket({ utm_source: 'instagram', count: 5 })],
			error: undefined
		} as unknown as BreakdownResult);

		renderSection();
		await user.click(screen.getByRole('heading', { name: 'Sales by source' }));

		const details = document.querySelector('details') as HTMLDetailsElement;
		expect(details.open).toBe(true);
		await waitFor(() => expect(screen.getByLabelText('Time range')).toBeVisible());
		expect(screen.getByLabelText('Filter by event')).toBeVisible();

		await waitFor(() => expect(eventpublicdiscoveryListEvents).toHaveBeenCalledTimes(1));
		expect(eventpublicdiscoveryListEvents).toHaveBeenCalledWith(
			expect.objectContaining({
				query: {
					organization: 'org-1',
					requires_ticket: true,
					include_past: true,
					next_events: false,
					page_size: 100
				}
			})
		);
		await waitFor(() =>
			expect(organizationadminticketsTicketAttributionBreakdown).toHaveBeenCalledTimes(1)
		);
		expect(organizationadminticketsTicketAttributionBreakdown).toHaveBeenCalledWith(
			expect.objectContaining({
				path: { slug: 'acme' },
				query: { since: undefined, event_ids: undefined }
			})
		);

		await waitFor(() => expect(screen.getByText('instagram')).toBeVisible());
	});

	it('derives `since`/`event_ids` from the URL and passes them to the breakdown query', async () => {
		const user = userEvent.setup();
		setPageUrl(
			'http://localhost/org/acme/admin/financials?since=2026-08-01T00:00:00.000Z&event_ids=11111111-1111-4111-8111-111111111111'
		);
		vi.mocked(eventpublicdiscoveryListEvents).mockResolvedValue({
			data: { results: [ev({})] },
			error: undefined
		} as unknown as EventsResult);
		vi.mocked(organizationadminticketsTicketAttributionBreakdown).mockResolvedValue({
			data: [bucket()],
			error: undefined
		} as unknown as BreakdownResult);

		renderSection();
		await user.click(screen.getByRole('heading', { name: 'Sales by source' }));

		await waitFor(() =>
			expect(organizationadminticketsTicketAttributionBreakdown).toHaveBeenCalledWith(
				expect.objectContaining({
					path: { slug: 'acme' },
					query: {
						since: '2026-08-01T00:00:00.000Z',
						event_ids: ['11111111-1111-4111-8111-111111111111']
					}
				})
			)
		);
		expect(screen.getByLabelText('Filter by event')).toHaveTextContent('1 event');
	});

	it('ignores a non-UUID event_ids value in the URL', async () => {
		const user = userEvent.setup();
		setPageUrl('http://localhost/org/acme/admin/financials?event_ids=not-a-uuid');
		vi.mocked(eventpublicdiscoveryListEvents).mockResolvedValue({
			data: { results: [] },
			error: undefined
		} as unknown as EventsResult);
		vi.mocked(organizationadminticketsTicketAttributionBreakdown).mockResolvedValue({
			data: [],
			error: undefined
		} as unknown as BreakdownResult);

		renderSection();
		await user.click(screen.getByRole('heading', { name: 'Sales by source' }));

		await waitFor(() =>
			expect(organizationadminticketsTicketAttributionBreakdown).toHaveBeenCalledWith(
				expect.objectContaining({ query: { since: undefined, event_ids: undefined } })
			)
		);
	});

	it('shows a muted "no results" line when the breakdown resolves empty', async () => {
		const user = userEvent.setup();
		vi.mocked(eventpublicdiscoveryListEvents).mockResolvedValue({
			data: { results: [] },
			error: undefined
		} as unknown as EventsResult);
		vi.mocked(organizationadminticketsTicketAttributionBreakdown).mockResolvedValue({
			data: [],
			error: undefined
		} as unknown as BreakdownResult);

		renderSection();
		await user.click(screen.getByRole('heading', { name: 'Sales by source' }));

		await waitFor(() => expect(screen.getByText('No results for these filters.')).toBeVisible());
	});

	it('shows a muted failed-to-load line when the breakdown query errors, without breaking the page', async () => {
		const user = userEvent.setup();
		vi.mocked(eventpublicdiscoveryListEvents).mockResolvedValue({
			data: { results: [] },
			error: undefined
		} as unknown as EventsResult);
		vi.mocked(organizationadminticketsTicketAttributionBreakdown).mockResolvedValue({
			data: undefined,
			error: { detail: 'boom' }
		} as unknown as BreakdownResult);

		renderSection();
		await user.click(screen.getByRole('heading', { name: 'Sales by source' }));

		await waitFor(() => expect(screen.getByText("Couldn't load financials.")).toBeVisible());
	});

	it('selecting a since preset navigates with the corresponding ISO `since` param, preserving other params', async () => {
		const user = userEvent.setup();
		setPageUrl('http://localhost/org/acme/admin/financials?year=2026');
		vi.mocked(eventpublicdiscoveryListEvents).mockResolvedValue({
			data: { results: [] },
			error: undefined
		} as unknown as EventsResult);
		vi.mocked(organizationadminticketsTicketAttributionBreakdown).mockResolvedValue({
			data: [],
			error: undefined
		} as unknown as BreakdownResult);

		renderSection();
		await user.click(screen.getByRole('heading', { name: 'Sales by source' }));
		await waitFor(() => expect(screen.getByLabelText('Time range')).toBeVisible());

		await user.click(screen.getByLabelText('Time range'));
		await revealOpenPopover('[data-select-content]');
		await user.click(await screen.findByRole('option', { name: 'Last 30 days' }));

		expect(goto).toHaveBeenCalledTimes(1);
		const [url, opts] = vi.mocked(goto).mock.calls[0];
		expect(url).toContain('year=2026');
		const sinceParam = new URL(url as string, 'http://localhost').searchParams.get('since');
		expect(sinceParam).not.toBeNull();
		const daysAgo = (Date.now() - new Date(sinceParam as string).getTime()) / 86_400_000;
		expect(daysAgo).toBeGreaterThan(25);
		expect(daysAgo).toBeLessThan(35);
		expect(opts).toMatchObject({ replaceState: true, keepFocus: true, noScroll: true });
	});

	it('toggling an event checkbox navigates with the event_ids param set', async () => {
		const user = userEvent.setup();
		vi.mocked(eventpublicdiscoveryListEvents).mockResolvedValue({
			data: {
				results: [ev({ id: '22222222-2222-4222-8222-222222222222', name: 'Workshop Night' })]
			},
			error: undefined
		} as unknown as EventsResult);
		vi.mocked(organizationadminticketsTicketAttributionBreakdown).mockResolvedValue({
			data: [],
			error: undefined
		} as unknown as BreakdownResult);

		renderSection();
		await user.click(screen.getByRole('heading', { name: 'Sales by source' }));
		await waitFor(() => expect(screen.getByLabelText('Filter by event')).toBeVisible());

		await user.click(screen.getByLabelText('Filter by event'));
		await revealOpenPopover('[data-dropdown-menu-content]');
		await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Workshop Night' }));

		expect(goto).toHaveBeenCalledTimes(1);
		const [url] = vi.mocked(goto).mock.calls[0];
		const params = new URL(url as string, 'http://localhost').searchParams.getAll('event_ids');
		expect(params).toEqual(['22222222-2222-4222-8222-222222222222']);
	});
});
