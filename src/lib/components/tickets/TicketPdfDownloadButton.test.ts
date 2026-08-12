import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TicketPdfDownloadButton from './TicketPdfDownloadButton.svelte';

const ticketwalletDownloadPdf = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({ ticketwalletDownloadPdf }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock('svelte-sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

const BASE = { ticketId: 'ticket-uuid-1', eventName: 'Acme Warehouse Party!' };

function okResponse() {
	return {
		response: {
			ok: true,
			status: 200,
			blob: () => Promise.resolve(new Blob(['pdf'], { type: 'application/pdf' }))
		}
	};
}

describe('TicketPdfDownloadButton', () => {
	let anchorClick: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		window.URL.createObjectURL = vi.fn(() => 'blob:mock');
		window.URL.revokeObjectURL = vi.fn();
		anchorClick = vi
			.spyOn(HTMLAnchorElement.prototype, 'click')
			.mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('downloads through the endpoint and names the file after the event', async () => {
		ticketwalletDownloadPdf.mockResolvedValue(okResponse());
		const user = userEvent.setup();
		render(TicketPdfDownloadButton, { props: BASE });

		await user.click(screen.getByRole('button', { name: 'Download PDF' }));

		await waitFor(() => {
			expect(ticketwalletDownloadPdf).toHaveBeenCalledWith({
				path: { ticket_id: 'ticket-uuid-1' },
				parseAs: 'stream'
			});
			expect(anchorClick).toHaveBeenCalled();
		});
		// Trailing punctuation must not survive as a dangling hyphen.
		const anchor = anchorClick.mock.instances[0] as HTMLAnchorElement;
		expect(anchor.download).toBe('acme-warehouse-party-ticket.pdf');
	});

	/**
	 * The pre-signed `pdf_url` fast path used to open a new tab instead, which
	 * popup blockers ate and which named the file after the storage key.
	 */
	it('never opens a new tab', async () => {
		ticketwalletDownloadPdf.mockResolvedValue(okResponse());
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);
		const user = userEvent.setup();
		render(TicketPdfDownloadButton, { props: BASE });

		await user.click(screen.getByRole('button', { name: 'Download PDF' }));

		await waitFor(() => expect(anchorClick).toHaveBeenCalled());
		expect(open).not.toHaveBeenCalled();
	});

	it('reports a 404 as a missing ticket rather than a generic failure', async () => {
		ticketwalletDownloadPdf.mockResolvedValue({ response: { ok: false, status: 404 } });
		const user = userEvent.setup();
		render(TicketPdfDownloadButton, { props: BASE });

		await user.click(screen.getByRole('button', { name: 'Download PDF' }));

		await waitFor(() => expect(toastError).toHaveBeenCalledWith('Ticket not found'));
	});

	it('never surfaces raw error text from an unexpected failure', async () => {
		ticketwalletDownloadPdf.mockRejectedValue(new Error('ECONNRESET from upstream'));
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const user = userEvent.setup();
		render(TicketPdfDownloadButton, { props: BASE });

		await user.click(screen.getByRole('button', { name: 'Download PDF' }));

		await waitFor(() => expect(toastError).toHaveBeenCalled());
		expect(toastError.mock.calls[0][0]).not.toContain('ECONNRESET');
	});
});
