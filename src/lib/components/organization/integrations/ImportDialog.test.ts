import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import ImportDialog from './ImportDialog.svelte';
import type { ImportJobSchema, RemoteEventSummarySchema } from '$lib/api/generated/types.gen';
import {
	organizationintegrationsImportEvents,
	organizationintegrationsImportJobs,
	organizationintegrationsRemoteEvents
} from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	organizationintegrationsRemoteEvents: vi.fn(),
	organizationintegrationsImportEvents: vi.fn(),
	organizationintegrationsImportJobs: vi.fn()
}));

type ListResult = Awaited<ReturnType<typeof organizationintegrationsRemoteEvents>>;
type ImportResult = Awaited<ReturnType<typeof organizationintegrationsImportEvents>>;
type JobsResult = Awaited<ReturnType<typeof organizationintegrationsImportJobs>>;

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

function job(overrides: Partial<ImportJobSchema> & Pick<ImportJobSchema, 'id'>): ImportJobSchema {
	return { remote_id: 'r1', status: 'queued', ...overrides };
}

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
	return { onOpenChange, client };
}

describe('ImportDialog', () => {
	beforeEach(() => {
		vi.mocked(organizationintegrationsRemoteEvents).mockResolvedValue(
			ok(events) as unknown as ListResult
		);
		vi.mocked(organizationintegrationsImportEvents).mockResolvedValue(
			ok({
				jobs: [job({ id: 'j1', remote_id: 'r1' }), job({ id: 'j2', remote_id: 'r2' })],
				skipped: []
			}) as unknown as ImportResult
		);
		vi.mocked(organizationintegrationsImportJobs).mockResolvedValue(
			ok([]) as unknown as JobsResult
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

	it('submits the selected ids, then reports done once every job settles', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationintegrationsImportJobs).mockResolvedValue(
			ok([
				job({ id: 'j1', remote_id: 'r1', status: 'done', event_id: 'e1', event_slug: 'autumn' }),
				job({ id: 'j2', remote_id: 'r2', status: 'done', event_id: 'e2', event_slug: 'gala' })
			]) as unknown as JobsResult
		);
		const { client } = renderDialog();
		const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
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
			expect(vi.mocked(organizationintegrationsImportJobs)).toHaveBeenCalledWith(
				expect.objectContaining({ query: { ids: ['j1', 'j2'] } })
			)
		);
		await waitFor(() =>
			expect(screen.getByText('2 events imported as drafts.')).toBeInTheDocument()
		);
		// Per-job rows carry the remote names and a link to each draft.
		expect(screen.getByText('Autumn Market')).toBeInTheDocument();
		expect(screen.getByText('Winter Gala')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Open draft for Autumn Market' })).toHaveAttribute(
			'href',
			'/org/acme/admin/events/e1/edit'
		);
		expect(screen.getByRole('link', { name: 'Open draft for Winter Gala' })).toHaveAttribute(
			'href',
			'/org/acme/admin/events/e2/edit'
		);
		expect(screen.getByRole('link', { name: 'Go to events' })).toHaveAttribute(
			'href',
			'/org/acme/admin/events'
		);
		// The settled poll refreshes the picker's flags and any cached event lists.
		await waitFor(() =>
			expect(invalidateSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					queryKey: ['org-integration-remote-events', 'acme', 'eventbrite']
				})
			)
		);
		expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['events'] }));
	});

	it('renders a failed job with its error copy and the provider message', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationintegrationsImportJobs).mockResolvedValue(
			ok([
				job({ id: 'j1', remote_id: 'r1', status: 'done', event_id: 'e1', event_slug: 'autumn' }),
				job({
					id: 'j2',
					remote_id: 'r2',
					status: 'failed',
					error_code: 'import_failed',
					error_message: 'boom',
					provider_message: 'Eventbrite said: ticket class invalid'
				})
			]) as unknown as JobsResult
		);
		renderDialog();
		await waitFor(() => expect(screen.getByText('Winter Gala')).toBeInTheDocument());
		await user.click(screen.getByRole('checkbox', { name: 'Select Autumn Market' }));
		await user.click(screen.getByRole('checkbox', { name: 'Select Winter Gala' }));
		await user.click(screen.getByRole('button', { name: 'Import 2 events' }));

		// One draft made it, the other failed with the localized copy for its code.
		await waitFor(() =>
			expect(screen.getByText('1 event imported as a draft.')).toBeInTheDocument()
		);
		expect(
			screen.getByText(/The import failed on Revel's side\. Try again — we have been notified\./)
		).toBeInTheDocument();
		expect(screen.getByText('Eventbrite said: ticket class invalid')).toBeInTheDocument();
		expect(screen.getByText('Details from Eventbrite')).toBeInTheDocument();
		// The failure is summarized in the status region, not only in its row.
		expect(screen.getByText('1 import failed.')).toBeInTheDocument();
		// The failed job offers no draft link.
		expect(screen.getByRole('link', { name: 'Open draft for Autumn Market' })).toBeInTheDocument();
		expect(
			screen.queryByRole('link', { name: 'Open draft for Winter Gala' })
		).not.toBeInTheDocument();
	});

	it('treats a done job without an event as done, but offers no draft link', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationintegrationsImportEvents).mockResolvedValue(
			ok({ jobs: [job({ id: 'j1', remote_id: 'r1' })], skipped: [] }) as unknown as ImportResult
		);
		vi.mocked(organizationintegrationsImportJobs).mockResolvedValue(
			ok([
				job({ id: 'j1', remote_id: 'r1', status: 'done', event_id: null, event_slug: null })
			]) as unknown as JobsResult
		);
		renderDialog();
		await waitFor(() => expect(screen.getByText('Autumn Market')).toBeInTheDocument());
		await user.click(screen.getByRole('checkbox', { name: 'Select Autumn Market' }));
		await user.click(screen.getByRole('button', { name: 'Import 1 event' }));

		await waitFor(() =>
			expect(screen.getByText('1 event imported as a draft.')).toBeInTheDocument()
		);
		expect(screen.getByText(/Imported as a draft/)).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: /Open draft/ })).not.toBeInTheDocument();
	});

	// Flush pending timers plus the promise/render microtasks they queue.
	async function tick(ms = 0) {
		await vi.advanceTimersByTimeAsync(ms);
		await vi.advanceTimersByTimeAsync(0);
	}

	it('keeps showing progress until a later tick settles every job', async () => {
		vi.useFakeTimers();
		try {
			const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
			const doneJ1 = job({
				id: 'j1',
				remote_id: 'r1',
				status: 'done',
				event_id: 'e1',
				event_slug: 'autumn'
			});
			vi.mocked(organizationintegrationsImportJobs)
				.mockResolvedValueOnce(
					// First check: one settled, one still queued.
					ok([doneJ1, job({ id: 'j2', remote_id: 'r2' })]) as unknown as JobsResult
				)
				.mockResolvedValue(
					ok([
						doneJ1,
						job({ id: 'j2', remote_id: 'r2', status: 'done', event_id: 'e2', event_slug: 'gala' })
					]) as unknown as JobsResult
				);
			renderDialog();
			await tick();
			await user.click(screen.getByRole('checkbox', { name: 'Select Autumn Market' }));
			await user.click(screen.getByRole('checkbox', { name: 'Select Winter Gala' }));
			await user.click(screen.getByRole('button', { name: 'Import 2 events' }));
			await tick();
			expect(screen.getByText('Importing… 1 of 2')).toBeInTheDocument();

			// The next 3 s poll tick settles the last job.
			await tick(3000);
			expect(screen.getByText('2 events imported as drafts.')).toBeInTheDocument();
		} finally {
			vi.useRealTimers();
		}
	});

	it('shows the timeout note with pending rows when jobs stay queued past the deadline', async () => {
		vi.useFakeTimers();
		try {
			const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
			vi.mocked(organizationintegrationsImportEvents).mockResolvedValue(
				ok({ jobs: [job({ id: 'j1', remote_id: 'r1' })], skipped: [] }) as unknown as ImportResult
			);
			// The job never settles.
			vi.mocked(organizationintegrationsImportJobs).mockResolvedValue(
				ok([job({ id: 'j1', remote_id: 'r1' })]) as unknown as JobsResult
			);
			renderDialog();
			await tick();
			await user.click(screen.getByRole('checkbox', { name: 'Select Autumn Market' }));
			await user.click(screen.getByRole('button', { name: 'Import 1 event' }));
			await tick();
			expect(screen.getByText('Importing… 0 of 1')).toBeInTheDocument();

			await tick(121_000);
			expect(
				screen.getByText('Still importing. The new drafts will appear under Events.')
			).toBeInTheDocument();
			// The pending row still names the event, marked as in flight.
			expect(screen.getByText('Autumn Market')).toBeInTheDocument();
			expect(screen.getByText(/Still importing…/)).toBeInTheDocument();
		} finally {
			vi.useRealTimers();
		}
	});

	it('surfaces a failing progress check while the poll keeps trying', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationintegrationsImportJobs).mockRejectedValue(new TypeError('fetch failed'));
		renderDialog();
		await waitFor(() => expect(screen.getByText('Autumn Market')).toBeInTheDocument());
		await user.click(screen.getByRole('checkbox', { name: 'Select Autumn Market' }));
		await user.click(screen.getByRole('button', { name: 'Import 1 event' }));

		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent(
				'Something went wrong with Eventbrite. Try again in a moment.'
			)
		);
		// Still importing: the interval keeps trying until the deadline.
		expect(screen.getByText('Importing… 0 of 2')).toBeInTheDocument();
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
