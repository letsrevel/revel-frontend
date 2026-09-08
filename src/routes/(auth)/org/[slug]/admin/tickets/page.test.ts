import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { readable } from 'svelte/store';
import type {
	EventInListSchema,
	TicketAttributionBucketSchema
} from '$lib/api/generated/types.gen';
import { goto } from '$app/navigation';
import Page from './+page.svelte';

const organization = { slug: 'acme', name: 'Acme' };

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

// `$app/stores`'s `page` outside a real SvelteKit navigation reflects nothing
// on its own, so mock it directly. The unrelated `foo=bar` param is there to
// prove the page's URL-update helper preserves params it doesn't touch.
vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('http://localhost/org/acme/admin/tickets?foo=bar') })
}));

function ev(overrides: Partial<EventInListSchema>): EventInListSchema {
	return {
		id: 'e1',
		name: 'Summer Gala',
		slug: 'summer-gala',
		start: '2026-09-01T18:00:00Z',
		end: '2026-09-01T22:00:00Z',
		status: 'open',
		requires_ticket: true,
		attendee_count: 12,
		timezone: 'UTC',
		...overrides
	} as EventInListSchema;
}

function bucket(
	overrides: Partial<TicketAttributionBucketSchema> = {}
): TicketAttributionBucketSchema {
	return { count: 3, ...overrides } as TicketAttributionBucketSchema;
}

/**
 * bits-ui positions its Select popover with floating-ui, which needs real
 * layout. jsdom never lays out, so the popover keeps floating-ui's
 * pre-positioning `visibility: hidden`, which excludes it from the
 * accessibility tree. Reveal it — exactly what the browser does once
 * floating-ui settles — so `getByRole('option', ...)` can find the items.
 * (Recipe mirrored from MembersTab.test.ts.)
 */
async function revealOpenSelectPopover() {
	const content = await waitFor(() => {
		const el = document.querySelector('[data-select-content]');
		if (!el) throw new Error('the select popover never opened');
		return el;
	});
	const floatingWrapper = content.parentElement;
	if (floatingWrapper instanceof HTMLElement) {
		floatingWrapper.style.visibility = 'visible';
	}
}

/** Same floating-ui pre-positioning problem as `revealOpenSelectPopover`, for
 * bits-ui's DropdownMenu (the event filter). */
async function revealOpenDropdownMenuPopover() {
	const content = await waitFor(() => {
		const el = document.querySelector('[data-dropdown-menu-content]');
		if (!el) throw new Error('the dropdown menu popover never opened');
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
	// bits-ui's body-scroll-lock (shared module-level state across every
	// Select/DropdownMenu instance in the process) schedules a ~24ms
	// setTimeout on unmount to restore `document.body`'s inline style.
	// Waiting it out isn't reliable enough on its own here (multiple
	// overlays opened across this file's tests can push the scheduled
	// cleanup later), so force the reset directly too — this suite doesn't
	// care about faithfully restoring scroll-lock styles between tests, only
	// that a lock left by one test's overlay never blocks the next test's
	// click with a stray `pointer-events: none`.
	await new Promise((resolve) => setTimeout(resolve, 50));
	document.body.removeAttribute('style');
});

describe('Tickets tab page', () => {
	it('renders the empty state with a link to events when no events', () => {
		render(Page, { props: { data: { organization, events: [] } as never } });
		expect(screen.getByText('No ticketed events yet')).toBeInTheDocument();
		const cta = screen.getByRole('link', { name: 'Go to Events' });
		expect(cta).toHaveAttribute('href', '/org/acme/admin/events');
	});

	it('renders one card per event linking to the per-event tickets page', () => {
		const events = [ev({ id: 'A', name: 'Summer Gala' }), ev({ id: 'B', name: 'Workshop Night' })];
		render(Page, { props: { data: { organization, events } as never } });

		const galaLink = screen.getByRole('link', { name: /Summer Gala/ });
		expect(galaLink).toHaveAttribute('href', '/org/acme/admin/events/A/tickets');
		const workshopLink = screen.getByRole('link', { name: /Workshop Night/ });
		expect(workshopLink).toHaveAttribute('href', '/org/acme/admin/events/B/tickets');
	});
});

describe('Sales by source section', () => {
	it('is not rendered when there is no breakdown data and no active filter', () => {
		const events = [ev({ id: 'A' })];
		render(Page, {
			props: {
				data: {
					organization,
					events,
					attributionBreakdown: null,
					since: null,
					eventIds: []
				} as never
			}
		});
		expect(screen.queryByText('Sales by source')).not.toBeInTheDocument();
	});

	it('renders the card when there is breakdown data', () => {
		const events = [ev({ id: 'A' })];
		render(Page, {
			props: {
				data: {
					organization,
					events,
					attributionBreakdown: [bucket({ utm_source: 'instagram', count: 5 })],
					since: null,
					eventIds: []
				} as never
			}
		});
		// The card is rendered with `showHeading={false}` so only the SectionHeader's
		// heading reads "Sales by source" — not a duplicate.
		expect(screen.getAllByText('Sales by source')).toHaveLength(1);
		expect(screen.getByRole('heading', { name: 'Sales by source' })).toBeInTheDocument();
		expect(screen.getByText('instagram')).toBeInTheDocument();
	});

	it('renders controls and a "no results" line when a filter is active but the breakdown is empty', () => {
		const events = [ev({ id: 'A' })];
		render(Page, {
			props: {
				data: {
					organization,
					events,
					attributionBreakdown: [],
					since: null,
					eventIds: ['11111111-1111-1111-1111-111111111111']
				} as never
			}
		});
		expect(screen.getByText('Sales by source')).toBeInTheDocument();
		expect(screen.getByText('No results for these filters.')).toBeInTheDocument();
	});

	it('shows "Custom" when `since` matches no preset', () => {
		const events = [ev({ id: 'A' })];
		render(Page, {
			props: {
				data: {
					organization,
					events,
					attributionBreakdown: [bucket()],
					since: '2020-01-01T00:00:00.000Z',
					eventIds: []
				} as never
			}
		});
		expect(screen.getByLabelText('Time range')).toHaveTextContent('Custom');
	});

	it('shows the matching preset label when `since` is close to a computed preset value', () => {
		const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
		const events = [ev({ id: 'A' })];
		render(Page, {
			props: {
				data: {
					organization,
					events,
					attributionBreakdown: [bucket()],
					since,
					eventIds: []
				} as never
			}
		});
		expect(screen.getByLabelText('Time range')).toHaveTextContent('Last 30 days');
	});

	it('selecting a since preset navigates with the corresponding ISO `since` param', async () => {
		const user = userEvent.setup();
		const events = [ev({ id: 'A' })];
		render(Page, {
			props: {
				data: {
					organization,
					events,
					attributionBreakdown: [bucket()],
					since: null,
					eventIds: []
				} as never
			}
		});

		await user.click(screen.getByLabelText('Time range'));
		await revealOpenSelectPopover();
		await user.click(await screen.findByRole('option', { name: 'Last 30 days' }));

		expect(goto).toHaveBeenCalledTimes(1);
		const [url, opts] = vi.mocked(goto).mock.calls[0];
		expect(url).toContain('/org/acme/admin/tickets');
		expect(url).toContain('foo=bar'); // unrelated params survive
		expect(url).toMatch(/since=/);
		const sinceParam = new URL(url as string, 'http://localhost').searchParams.get('since');
		expect(sinceParam).not.toBeNull();
		// finite and close to "30 days ago" (loose bound — just proves it's the last30 preset, not "all"/"last7").
		const daysAgo = (Date.now() - new Date(sinceParam as string).getTime()) / 86_400_000;
		expect(daysAgo).toBeGreaterThan(25);
		expect(daysAgo).toBeLessThan(35);
		expect(opts).toMatchObject({ replaceState: true, keepFocus: true, noScroll: true });
	});

	it('selecting "All time" navigates with `since` removed', async () => {
		const user = userEvent.setup();
		const events = [ev({ id: 'A' })];
		render(Page, {
			props: {
				data: {
					organization,
					events,
					attributionBreakdown: [bucket()],
					since: new Date().toISOString(),
					eventIds: []
				} as never
			}
		});

		await user.click(screen.getByLabelText('Time range'));
		await revealOpenSelectPopover();
		await user.click(await screen.findByRole('option', { name: 'All time' }));

		expect(goto).toHaveBeenCalledTimes(1);
		const [url] = vi.mocked(goto).mock.calls[0];
		expect(url).not.toMatch(/since=/);
	});

	it('toggling an event checkbox navigates with repeated `event_ids` params', async () => {
		const user = userEvent.setup();
		const events = [
			ev({ id: '11111111-1111-1111-1111-111111111111', name: 'Summer Gala' }),
			ev({ id: '22222222-2222-2222-2222-222222222222', name: 'Workshop Night' })
		];
		render(Page, {
			props: {
				data: {
					organization,
					events,
					attributionBreakdown: [bucket()],
					since: null,
					eventIds: ['11111111-1111-1111-1111-111111111111']
				} as never
			}
		});

		await user.click(screen.getByLabelText('Filter by event'));
		await revealOpenDropdownMenuPopover();
		await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Workshop Night' }));

		expect(goto).toHaveBeenCalledTimes(1);
		const [url] = vi.mocked(goto).mock.calls[0];
		const params = new URL(url as string, 'http://localhost').searchParams.getAll('event_ids');
		expect(params).toEqual([
			'11111111-1111-1111-1111-111111111111',
			'22222222-2222-2222-2222-222222222222'
		]);
	});

	it('unchecking an event checkbox removes it from the `event_ids` params', async () => {
		const user = userEvent.setup();
		const events = [
			ev({ id: '11111111-1111-1111-1111-111111111111', name: 'Summer Gala' }),
			ev({ id: '22222222-2222-2222-2222-222222222222', name: 'Workshop Night' })
		];
		render(Page, {
			props: {
				data: {
					organization,
					events,
					attributionBreakdown: [bucket()],
					since: null,
					eventIds: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']
				} as never
			}
		});

		await user.click(screen.getByLabelText('Filter by event'));
		await revealOpenDropdownMenuPopover();
		await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Summer Gala' }));

		expect(goto).toHaveBeenCalledTimes(1);
		const [url] = vi.mocked(goto).mock.calls[0];
		const params = new URL(url as string, 'http://localhost').searchParams.getAll('event_ids');
		expect(params).toEqual(['22222222-2222-2222-2222-222222222222']);
	});

	it('event filter trigger shows a count once events are selected', () => {
		const events = [ev({ id: '11111111-1111-1111-1111-111111111111', name: 'Summer Gala' })];
		render(Page, {
			props: {
				data: {
					organization,
					events,
					attributionBreakdown: [bucket()],
					since: null,
					eventIds: ['11111111-1111-1111-1111-111111111111']
				} as never
			}
		});
		expect(screen.getByText('1 event')).toBeInTheDocument();
	});
});
