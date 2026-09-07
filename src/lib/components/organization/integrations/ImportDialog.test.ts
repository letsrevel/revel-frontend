import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import ImportDialog from './ImportDialog.svelte';
import type { RemoteEventSummarySchema } from '$lib/api/generated/types.gen';
import {
	organizationintegrationsImportEvents,
	organizationintegrationsRemoteEvents
} from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	organizationintegrationsRemoteEvents: vi.fn(),
	organizationintegrationsImportEvents: vi.fn()
}));

type ListResult = Awaited<ReturnType<typeof organizationintegrationsRemoteEvents>>;
type ImportResult = Awaited<ReturnType<typeof organizationintegrationsImportEvents>>;

function ok<T>(data: T) {
	return { data, error: undefined, response: { ok: true } as Response };
}

const events: RemoteEventSummarySchema[] = [
	{ remote_id: 'r1', name: 'Autumn Market', start: '2026-10-03T10:00:00Z', status: 'live' },
	{ remote_id: 'r2', name: 'Winter Gala', start: '2026-12-12T19:00:00Z', status: 'draft' },
	{
		remote_id: 'r3',
		name: 'Already Here',
		start: '2026-11-01T18:00:00Z',
		status: 'live',
		already_linked: true
	}
];

function renderDialog(props: Partial<{ stripeConnected: boolean }> = {}) {
	const onOpenChange = vi.fn();
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: ImportDialog,
			componentProps: {
				open: true,
				onOpenChange,
				organizationSlug: 'acme',
				provider: 'eventbrite',
				platform: 'Eventbrite',
				stripeConnected: props.stripeConnected ?? true
			}
		}
	});
	return { onOpenChange };
}

describe('ImportDialog', () => {
	beforeEach(() => {
		vi.mocked(organizationintegrationsRemoteEvents).mockResolvedValue(
			ok(events) as unknown as ListResult
		);
		vi.mocked(organizationintegrationsImportEvents).mockResolvedValue(
			ok({ queued: ['r1', 'r2'], skipped: [] }) as unknown as ImportResult
		);
	});

	it('lists remote events, disables the ones already in Revel, and counts the selection', async () => {
		const user = userEvent.setup();
		renderDialog();
		await waitFor(() => expect(screen.getByText('Autumn Market')).toBeInTheDocument());
		expect(screen.getByText('Already in Revel')).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: 'Select Already Here' })).toBeDisabled();
		expect(screen.getByText('0 of 50 selected')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();

		await user.click(screen.getByRole('checkbox', { name: 'Select Autumn Market' }));
		expect(screen.getByText('1 of 50 selected')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Import 1 event' })).toBeEnabled();
	});

	it('warns about paused paid tickets when Stripe is not connected', async () => {
		renderDialog({ stripeConnected: false });
		await waitFor(() =>
			expect(screen.getByText(/sales paused until you connect Stripe/)).toBeInTheDocument()
		);
	});

	it('submits the selected ids, then reports done once the list shows them linked', async () => {
		const user = userEvent.setup();
		// First call: the picker list. Later calls: the poll sees both linked.
		vi.mocked(organizationintegrationsRemoteEvents)
			.mockResolvedValueOnce(ok(events) as unknown as ListResult)
			.mockResolvedValue(
				ok(events.map((e) => ({ ...e, already_linked: true }))) as unknown as ListResult
			);
		renderDialog();
		await waitFor(() => expect(screen.getByText('Winter Gala')).toBeInTheDocument());
		await user.click(screen.getByRole('checkbox', { name: 'Select Autumn Market' }));
		await user.click(screen.getByRole('checkbox', { name: 'Select Winter Gala' }));
		await user.click(screen.getByRole('button', { name: 'Import 2 events' }));

		await waitFor(() =>
			expect(vi.mocked(organizationintegrationsImportEvents)).toHaveBeenCalledWith(
				expect.objectContaining({ body: { remote_ids: ['r1', 'r2'] } })
			)
		);
		await waitFor(() =>
			expect(screen.getByText('2 events imported as drafts.')).toBeInTheDocument()
		);
		expect(screen.getByRole('link', { name: 'Go to events' })).toHaveAttribute(
			'href',
			'/org/acme/admin/events'
		);
	});

	it('shows the mapped error when the list cannot be loaded', async () => {
		vi.mocked(organizationintegrationsRemoteEvents).mockResolvedValue({
			data: undefined,
			error: { detail: 'x', code: 'connection_revoked', provider_message: null },
			response: { ok: false } as Response
		} as unknown as ListResult);
		renderDialog();
		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent(
				'Revel lost access to your Eventbrite account'
			)
		);
	});
});
