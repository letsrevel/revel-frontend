import { describe, it, expect, vi, beforeEach } from 'vitest';

const payloadMock = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock('$lib/api', () => ({
	eventadminticketsCheckInTicket: vi.fn(),
	eventadminticketsGetTicket: vi.fn()
}));
vi.mock('svelte-sonner', () => ({ toast: { success: toastSuccess, error: vi.fn() } }));
vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));
// A mutation stand-in: `mutate` resolves to the scripted check-in payload and
// fires the mutation-level then the call-level onSuccess, like TanStack does.
vi.mock('@tanstack/svelte-query', () => ({
	createMutation: (build: () => { onSuccess: (d: unknown) => void }) => ({
		isPending: false,
		mutate: async (_vars: unknown, callOpts?: { onSuccess?: (d: unknown) => void }) => {
			const data = payloadMock();
			build().onSuccess(data);
			callOpts?.onSuccess?.(data);
		}
	})
}));

import { eventadminticketsGetTicket } from '$lib/api';
import { createTicketScanCheckIn } from './ticket-scan-checkin.svelte';

const SERIES_SCAN = 'series:11111111-1111-4111-8111-111111111111';

function checkedIn(extra: Record<string, unknown>) {
	return { kind: 'checked_in', user: { first_name: 'Ada', last_name: 'L' }, ...extra };
}

function make() {
	return createTicketScanCheckIn({ getEventId: () => 'evt', getAccessToken: () => 'tok' });
}

describe('createTicketScanCheckIn feedback', () => {
	beforeEach(() => {
		payloadMock.mockReset();
		toastSuccess.mockReset();
	});

	it('opens no dialog for a membership without a note; the membership rides in the toast', async () => {
		payloadMock.mockReturnValue(
			checkedIn({ membership: { kind: 'temporary', tier_name: 'Door', valid_until: null } })
		);
		const flow = make();
		await flow.handleQRScan(SERIES_SCAN);

		expect(flow.scanNote).toBeNull();
		expect(toastSuccess).toHaveBeenCalledTimes(1);
		expect(toastSuccess.mock.calls[0][1]).toEqual({
			description: expect.stringContaining('Day member.')
		});
	});

	it('opens the dialog with the membership inside it when there is a note, and keeps the toast plain', async () => {
		payloadMock.mockReturnValue(
			checkedIn({
				private_note: 'Needs step-free',
				membership: { kind: 'standard', tier_name: 'Gold' }
			})
		);
		const flow = make();
		await flow.handleQRScan(SERIES_SCAN);

		expect(flow.scanNote?.body).toBe('Needs step-free');
		expect(flow.scanNote?.membership?.body).toBe('Member: Gold');
		expect(toastSuccess.mock.calls[0][1]).toEqual({});
	});

	it('shows neither dialog nor description for a plain check-in', async () => {
		payloadMock.mockReturnValue(checkedIn({}));
		const flow = make();
		await flow.handleQRScan(SERIES_SCAN);

		expect(flow.scanNote).toBeNull();
		expect(toastSuccess.mock.calls[0][1]).toEqual({});
	});

	it('toasts the membership for a confirm-dialog check-in with no note', async () => {
		payloadMock.mockReturnValue(checkedIn({ membership: { kind: 'standard', tier_name: 'Gold' } }));
		const flow = make();
		flow.openCheckIn({ id: 't1', status: 'active', user: { first_name: 'Ada' } } as never);
		flow.submitCheckIn();
		await Promise.resolve();

		expect(flow.scanNote).toBeNull();
		expect(toastSuccess).toHaveBeenCalledWith('Checked in', { description: 'Member: Gold' });
	});
});

// #1305: a failed ticket lookup must reject, so QrCameraScanner shows its
// "could not process" error and resumes the camera instead of "Scan successful".
describe('createTicketScanCheckIn ticket lookup failure', () => {
	const TICKET_SCAN = '22222222-2222-4222-8222-222222222222';

	beforeEach(() => {
		vi.mocked(eventadminticketsGetTicket).mockReset();
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	it('rejects and keeps the scanner open when the ticket is not found', async () => {
		vi.mocked(eventadminticketsGetTicket).mockResolvedValue({
			error: { detail: 'Not found.' },
			data: undefined
		} as never);
		const flow = make();
		flow.showQRScanner = true;

		await expect(flow.handleQRScan(TICKET_SCAN)).rejects.toThrow();
		expect(flow.showCheckInDialog).toBe(false);
		expect(flow.ticketToCheckIn).toBeNull();
		expect(flow.showQRScanner).toBe(true);
	});

	it('rejects and keeps the scanner open when the lookup request throws', async () => {
		vi.mocked(eventadminticketsGetTicket).mockRejectedValue(new Error('network down'));
		const flow = make();
		flow.showQRScanner = true;

		await expect(flow.handleQRScan(TICKET_SCAN)).rejects.toThrow('network down');
		expect(flow.showCheckInDialog).toBe(false);
		expect(flow.showQRScanner).toBe(true);
	});

	it('opens the confirm dialog and closes the scanner when the ticket is found', async () => {
		vi.mocked(eventadminticketsGetTicket).mockResolvedValue({
			data: { id: TICKET_SCAN, status: 'active', user: { first_name: 'Ada' } },
			error: undefined
		} as never);
		const flow = make();
		flow.showQRScanner = true;

		await flow.handleQRScan(TICKET_SCAN);
		expect(flow.showCheckInDialog).toBe(true);
		expect(flow.ticketToCheckIn?.id).toBe(TICKET_SCAN);
		expect(flow.showQRScanner).toBe(false);
	});
});
