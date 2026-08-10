import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AddToWalletButton from './AddToWalletButton.svelte';

const ticketwalletDownloadApplePass = vi.hoisted(() => vi.fn());
const seriespassDownloadSeriesPassPkpass = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	ticketwalletDownloadApplePass,
	seriespassDownloadSeriesPassPkpass
}));

interface MockResult {
	response: { ok: boolean; status: number; blob?: () => Promise<Blob> };
}

function okResult(): MockResult {
	return {
		response: {
			ok: true,
			status: 200,
			blob: () => Promise.resolve(new Blob(['pass'], { type: 'application/vnd.apple.pkpass' }))
		}
	};
}

function errorResult(status: number): MockResult {
	return { response: { ok: false, status } };
}

describe('AddToWalletButton', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.URL.createObjectURL = vi.fn(() => 'blob:mock');
		window.URL.revokeObjectURL = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders the official badge as an image-button with an accessible name', () => {
		render(AddToWalletButton, { props: { id: 'ticket-1', name: 'My Event' } });
		const button = screen.getByRole('button', { name: 'Add to Apple Wallet' });
		const img = button.querySelector('img');
		expect(img).not.toBeNull();
		expect(img?.getAttribute('src')).toBe('/wallet/apple-wallet-badge-en.svg');
	});

	it('downloads the ticket pkpass with a safe filename', async () => {
		ticketwalletDownloadApplePass.mockResolvedValue(okResult());
		const user = userEvent.setup();
		render(AddToWalletButton, { props: { id: 'abc123-rest', name: 'My Event!' } });

		await user.click(screen.getByRole('button', { name: 'Add to Apple Wallet' }));

		await waitFor(() => {
			expect(ticketwalletDownloadApplePass).toHaveBeenCalledWith({
				path: { ticket_id: 'abc123-rest' },
				parseAs: 'stream'
			});
			expect(window.URL.createObjectURL).toHaveBeenCalled();
		});
		expect(seriespassDownloadSeriesPassPkpass).not.toHaveBeenCalled();
	});

	it('uses the series-pass endpoint for kind="series-pass"', async () => {
		seriespassDownloadSeriesPassPkpass.mockResolvedValue(okResult());
		const user = userEvent.setup();
		render(AddToWalletButton, { props: { id: 'pass-1', kind: 'series-pass', name: 'Season' } });

		await user.click(screen.getByRole('button', { name: 'Add to Apple Wallet' }));

		await waitFor(() => {
			expect(seriespassDownloadSeriesPassPkpass).toHaveBeenCalledWith({
				path: { held_pass_id: 'pass-1' },
				parseAs: 'stream'
			});
		});
		expect(ticketwalletDownloadApplePass).not.toHaveBeenCalled();
	});

	it('shows the not-configured message on 503', async () => {
		ticketwalletDownloadApplePass.mockResolvedValue(errorResult(503));
		const user = userEvent.setup();
		render(AddToWalletButton, { props: { id: 'ticket-1', name: 'My Event' } });

		await user.click(screen.getByRole('button', { name: 'Add to Apple Wallet' }));

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('Apple Wallet is not configured');
	});

	it('shows the per-kind not-found message on 404', async () => {
		seriespassDownloadSeriesPassPkpass.mockResolvedValue(errorResult(404));
		const user = userEvent.setup();
		render(AddToWalletButton, { props: { id: 'pass-1', kind: 'series-pass', name: 'Season' } });

		await user.click(screen.getByRole('button', { name: 'Add to Apple Wallet' }));

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('Pass not found');
	});

	it('shows a localized generic failure message on unexpected errors', async () => {
		ticketwalletDownloadApplePass.mockRejectedValue(new Error('network down'));
		const user = userEvent.setup();
		render(AddToWalletButton, { props: { id: 'ticket-1', name: 'My Event' } });

		await user.click(screen.getByRole('button', { name: 'Add to Apple Wallet' }));

		// Raw error text (unlocalized, possibly backend detail) must never
		// reach the alert — only the localized generic message.
		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('Failed to download wallet pass');
		expect(alert.textContent).not.toContain('network down');
	});
});
