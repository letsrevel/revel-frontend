import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import EventCombobox from './EventCombobox.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { eventpublicdiscoveryListEvents } from '$lib/api/generated/sdk.gen';
import type { EventInListSchema } from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicdiscoveryListEvents: vi.fn()
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

function makeEvent(name: string, id: string): EventInListSchema {
	return {
		id,
		name,
		slug: name.toLowerCase().replace(/\s+/g, '-'),
		start: '2026-09-01T18:00:00Z',
		event_type: 'public',
		visibility: 'public',
		status: 'open',
		organization: { id: 'org-1', name: 'Acme', slug: 'acme' }
	} as EventInListSchema;
}

/** Every call resolves with whatever the current `search` term matches. */
function mockSearch(catalogue: EventInListSchema[]) {
	vi.mocked(eventpublicdiscoveryListEvents).mockImplementation((async (options?: {
		query?: { search?: string };
	}) => {
		const term = (options?.query?.search ?? '').toLowerCase();
		const results = term
			? catalogue.filter((e) => e.name.toLowerCase().includes(term))
			: // Mirror the endpoint's paging: only the first 20 rows come back
				// unsearched, which is the whole point of #815.
				catalogue.slice(0, 20);
		return { data: { count: catalogue.length, results }, error: undefined };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}) as any);
}

describe('EventCombobox', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false, gcTime: 0 } }
		});
	});

	afterEach(() => {
		queryClient.clear();
	});

	function renderCombobox(props: Record<string, unknown> = {}) {
		const onSelect = vi.fn();
		const result = render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: EventCombobox,
				componentProps: {
					organizationSlug: 'acme',
					value: null,
					valueLabel: null,
					onSelect,
					...props
				}
			}
		});
		return { ...result, onSelect };
	}

	it('exposes combobox semantics on the search field', () => {
		mockSearch([]);
		renderCombobox();

		const input = screen.getByRole('combobox');
		expect(input).toHaveAttribute('aria-expanded', 'false');
		expect(input).toHaveAttribute('aria-autocomplete', 'list');
		// The listbox is unmounted while collapsed, so aria-controls must not
		// dangle at an id that is nowhere in the document.
		expect(input).not.toHaveAttribute('aria-controls');
		const describedBy = input.getAttribute('aria-describedby');
		expect(describedBy).toBeTruthy();
		expect(document.getElementById(describedBy as string)).toHaveTextContent(
			m['announcements.form.eventSearchHint']()
		);
	});

	it('queries the paginated endpoint upcoming-first when the list opens', async () => {
		const user = userEvent.setup();
		mockSearch([makeEvent('Launch Party', 'e-1')]);
		renderCombobox();

		await user.click(screen.getByRole('combobox'));

		await waitFor(() => {
			expect(vi.mocked(eventpublicdiscoveryListEvents)).toHaveBeenCalledWith({
				query: {
					organization_slug: 'acme',
					search: undefined,
					include_past: false,
					order_by: 'start',
					page_size: 20
				}
			});
		});
		const option = await screen.findByRole('option', { name: /Launch Party/ });
		expect(screen.getByRole('combobox')).toHaveAttribute(
			'aria-controls',
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			option.closest('[role="listbox"]')!.id
		);
	});

	it('flips to newest-first once past events are included', async () => {
		const user = userEvent.setup();
		mockSearch([makeEvent('Launch Party', 'e-1')]);
		renderCombobox({ includePast: true });

		await user.click(screen.getByRole('combobox'));

		await waitFor(() => {
			expect(vi.mocked(eventpublicdiscoveryListEvents)).toHaveBeenCalledWith(
				expect.objectContaining({
					query: expect.objectContaining({ include_past: true, order_by: '-start' })
				})
			);
		});
	});

	// The bug this component exists for: the 101st event was unreachable in the
	// old capped <select>, and only a server-side search can surface it.
	it('reaches an event far beyond the first page by searching for it', async () => {
		const user = userEvent.setup();
		const catalogue = [
			...Array.from({ length: 100 }, (_, i) => makeEvent(`Filler Event ${i}`, `f-${i}`)),
			makeEvent('Summer Sunset Music Festival', 'e-late')
		];
		mockSearch(catalogue);
		const { onSelect } = renderCombobox();

		const input = screen.getByRole('combobox');
		await user.click(input);
		await waitFor(() =>
			expect(screen.queryByRole('option', { name: /Summer Sunset/ })).not.toBeInTheDocument()
		);

		await user.type(input, 'Sunset');

		await waitFor(() => {
			expect(vi.mocked(eventpublicdiscoveryListEvents)).toHaveBeenCalledWith(
				expect.objectContaining({ query: expect.objectContaining({ search: 'Sunset' }) })
			);
		});
		const option = await screen.findByRole('option', { name: /Summer Sunset Music Festival/ });
		await user.click(option);

		expect(onSelect).toHaveBeenCalledWith({ id: 'e-late', name: 'Summer Sunset Music Festival' });
	});

	it('picks the active option with the keyboard', async () => {
		const user = userEvent.setup();
		mockSearch([makeEvent('Alpha', 'e-1'), makeEvent('Beta', 'e-2')]);
		const { onSelect } = renderCombobox();

		const input = screen.getByRole('combobox');
		await user.click(input);
		await screen.findByRole('option', { name: /Alpha/ });

		await user.keyboard('{ArrowDown}{ArrowDown}');
		await waitFor(() =>
			expect(input.getAttribute('aria-activedescendant')).toBe(
				screen.getByRole('option', { name: /Beta/ }).id
			)
		);

		await user.keyboard('{Enter}');
		expect(onSelect).toHaveBeenCalledWith({ id: 'e-2', name: 'Beta' });
	});

	it('shows the selected label even when the event is not in the results', async () => {
		mockSearch([makeEvent('Something Else', 'e-other')]);
		renderCombobox({ value: 'e-late', valueLabel: 'Summer Sunset Music Festival' });

		await waitFor(() =>
			expect(screen.getByRole('combobox')).toHaveValue('Summer Sunset Music Festival')
		);
	});

	it('clears the selection and keeps the list open for the next pick', async () => {
		const user = userEvent.setup();
		mockSearch([makeEvent('Alpha', 'e-1')]);
		const { onSelect } = renderCombobox({ value: 'e-1', valueLabel: 'Alpha' });

		const input = screen.getByRole('combobox');
		await user.click(input);
		await screen.findByRole('option', { name: /Alpha/ });
		await user.click(
			screen.getByRole('button', { name: m['announcements.form.clearEventSelection']() })
		);

		expect(onSelect).toHaveBeenCalledWith(null);
		// The blur that clicking the button caused must not slam the reopened list
		// shut a beat later (the 150ms grace timer has to be cancelled).
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(screen.getByRole('listbox')).toBeInTheDocument();
		expect(input).toHaveFocus();
	});

	it('reports "no match" for a search that finds nothing', async () => {
		const user = userEvent.setup();
		mockSearch([makeEvent('Alpha', 'e-1')]);
		renderCombobox();

		const input = screen.getByRole('combobox');
		await user.click(input);
		await user.type(input, 'zzz');

		expect(await screen.findByText(m['announcements.form.noEventsMatch']())).toBeInTheDocument();
	});
});
