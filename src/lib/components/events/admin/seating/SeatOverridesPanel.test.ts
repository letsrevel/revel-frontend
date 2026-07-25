import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import SeatOverridesPanel from './SeatOverridesPanel.svelte';
import {
	eventadminseatingApplyOverrides,
	eventpublicseatingGetAvailability,
	eventpublicseatingGetChart
} from '$lib/api/generated/sdk.gen';

// The panel imports its three ops via `$lib/api` (a re-export of the generated
// sdk), so mocking sdk.gen intercepts them all.
vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicseatingGetChart: vi.fn(),
	eventpublicseatingGetAvailability: vi.fn(),
	eventadminseatingApplyOverrides: vi.fn()
}));

/** Typed helper over the generated ops' {data, error, response} envelope. */
function mockResult<T extends (...args: never[]) => unknown>(
	op: T,
	result: { data?: unknown; error?: unknown; status?: number }
) {
	vi.mocked(op).mockResolvedValue({
		data: result.data,
		error: result.error,
		response: { status: result.status ?? (result.error === undefined ? 200 : 409) }
	} as never);
}

function chartData() {
	return {
		venue_id: 'venue-1',
		venue_name: 'Test Hall',
		updated_at: '2026-07-18T00:00:00Z',
		price_categories: [],
		sectors: [
			{
				id: 'sec-stalls',
				name: 'Stalls',
				kind: 'seated',
				display_order: 0,
				seats: [
					{ id: 's1', label: 'A1', row_label: 'A', row_order: 0, number: 1, adjacency_index: 0 },
					{ id: 's2', label: 'A2', row_label: 'A', row_order: 0, number: 2, adjacency_index: 1 },
					{ id: 's3', label: 'B1', row_label: 'B', row_order: 1, number: 1, adjacency_index: 0 }
				]
			}
		]
	};
}

function availabilityData(seats: Record<string, string> = {}) {
	return { seats, standing: {}, my_holds: [], my_holds_expire_at: null };
}

function setup() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: SeatOverridesPanel,
			props: { eventId: 'event-1', accessToken: 'token-1' }
		}
	});
}

describe('SeatOverridesPanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockResult(eventpublicseatingGetChart, { data: chartData() });
		mockResult(eventpublicseatingGetAvailability, { data: availabilityData({ s3: 'blocked' }) });
	});

	it('renders the sector list with per-seat checkboxes and the blocked summary', async () => {
		setup();
		expect(await screen.findByText('Stalls')).toBeTruthy();
		expect(screen.getByRole('checkbox', { name: 'Seat A1' })).toBeTruthy();
		expect(screen.getByRole('checkbox', { name: /Seat B1, unavailable/ })).toBeTruthy();
		expect(screen.getByText('Blocked seats (overrides and decommissioned)')).toBeTruthy();
	});

	it('applies a hold with the kind-prefixed reason for the selected seats', async () => {
		mockResult(eventadminseatingApplyOverrides, {
			data: { applied: 2, released: 0, rejected: {} }
		});
		const user = userEvent.setup();
		setup();
		await screen.findByText('Stalls');

		await user.click(screen.getByRole('checkbox', { name: 'Seat A1' }));
		await user.click(screen.getByRole('checkbox', { name: 'Seat A2' }));
		await user.type(screen.getByLabelText('Reason (required)'), 'camera platform');
		await user.click(screen.getByRole('button', { name: 'Apply override' }));

		await waitFor(() => {
			expect(eventadminseatingApplyOverrides).toHaveBeenCalledExactlyOnceWith({
				path: { event_id: 'event-1' },
				body: {
					set: [
						{ seat_id: 's1', status: 'held', reason: '[house] camera platform' },
						{ seat_id: 's2', status: 'held', reason: '[house] camera platform' }
					]
				},
				headers: { Authorization: 'Bearer token-1' }
			});
		});
	});

	it('sends only currently-blocked seats as release_seat_ids on release', async () => {
		mockResult(eventadminseatingApplyOverrides, {
			data: { applied: 0, released: 1, rejected: {} }
		});
		const user = userEvent.setup();
		setup();
		await screen.findByText('Stalls');

		// One available (s1) and one blocked (s3) seat selected — only s3 goes out.
		await user.click(screen.getByRole('checkbox', { name: 'Seat A1' }));
		await user.click(screen.getByRole('checkbox', { name: /Seat B1, unavailable/ }));
		await user.click(screen.getByRole('radio', { name: /Release/ }));
		await user.click(screen.getByRole('button', { name: 'Release selected seats' }));

		await waitFor(() => {
			expect(eventadminseatingApplyOverrides).toHaveBeenCalledExactlyOnceWith({
				path: { event_id: 'event-1' },
				body: { release_seat_ids: ['s3'] },
				headers: { Authorization: 'Bearer token-1' }
			});
		});
	});

	it('selects a whole row via the row select-all checkbox', async () => {
		mockResult(eventadminseatingApplyOverrides, {
			data: { applied: 2, released: 0, rejected: {} }
		});
		const user = userEvent.setup();
		setup();
		await screen.findByText('Stalls');

		await user.click(screen.getByRole('checkbox', { name: 'Select all seats in row A of Stalls' }));
		await user.type(screen.getByLabelText('Reason (required)'), 'promoter block');
		await user.click(screen.getByRole('button', { name: 'Apply override' }));

		await waitFor(() => {
			const call = vi.mocked(eventadminseatingApplyOverrides).mock.calls[0]?.[0];
			expect(call?.body.set?.map((item) => item.seat_id).sort()).toEqual(['s1', 's2']);
		});
	});

	it('renders per-seat rejections inline (never a whole-batch failure) and refetches availability', async () => {
		mockResult(eventadminseatingApplyOverrides, {
			data: { applied: 1, released: 0, rejected: { s2: 'ticketed', ghost: 'unknown_seat' } }
		});
		const user = userEvent.setup();
		setup();
		await screen.findByText('Stalls');
		await waitFor(() => {
			expect(eventpublicseatingGetAvailability).toHaveBeenCalled();
		});
		const availabilityCalls = vi.mocked(eventpublicseatingGetAvailability).mock.calls.length;

		await user.click(screen.getByRole('checkbox', { name: 'Seat A1' }));
		await user.click(screen.getByRole('checkbox', { name: 'Seat A2' }));
		await user.type(screen.getByLabelText('Reason (required)'), 'why');
		await user.click(screen.getByRole('button', { name: 'Apply override' }));

		const status = await screen.findByRole('status');
		expect(status.textContent).toContain('1 override(s) applied, 0 released.');
		expect(status.textContent).toContain('A2');
		expect(status.textContent).toContain('has a ticket on this event');
		expect(status.textContent).toContain('ghost');
		expect(status.textContent).toContain('not on this venue');

		// Focus lands on the result region for keyboard/AT users.
		await waitFor(() => {
			expect(document.activeElement).toBe(status);
		});

		// Availability is invalidated (and thus refetched) after every apply.
		await waitFor(() => {
			expect(vi.mocked(eventpublicseatingGetAvailability).mock.calls.length).toBeGreaterThan(
				availabilityCalls
			);
		});
	});

	it('disables apply until the form is submittable (selection + reason)', async () => {
		const user = userEvent.setup();
		setup();
		await screen.findByText('Stalls');

		const applyButton = screen.getByRole('button', { name: 'Apply override' });
		expect(applyButton.hasAttribute('disabled')).toBe(true);

		await user.click(screen.getByRole('checkbox', { name: 'Seat A1' }));
		expect(applyButton.hasAttribute('disabled')).toBe(true);

		await user.type(screen.getByLabelText('Reason (required)'), 'why');
		await waitFor(() => {
			expect(applyButton.hasAttribute('disabled')).toBe(false);
		});
	});

	it('shows the no-seating empty state when the chart 404s', async () => {
		mockResult(eventpublicseatingGetChart, { error: { detail: 'no venue' }, status: 404 });
		setup();
		expect(
			await screen.findByText(
				'This event has no seated venue chart, so there are no seats to override.'
			)
		).toBeTruthy();
	});
});
