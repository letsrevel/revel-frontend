import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AddToGoogleWalletButton from './AddToGoogleWalletButton.svelte';

const ticketwalletGoogleWalletSaveLink = vi.hoisted(() => vi.fn());
const seriespassGoogleWalletSaveLink = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	ticketwalletGoogleWalletSaveLink,
	seriespassGoogleWalletSaveLink
}));

const SAVE_URL = 'https://pay.google.com/gp/v/save/test-jwt';

function okResult() {
	return {
		data: { save_url: SAVE_URL },
		response: { ok: true, status: 200 }
	};
}

function errorResult(status: number) {
	return {
		data: undefined,
		error: {},
		response: { ok: false, status }
	};
}

describe('AddToGoogleWalletButton', () => {
	let openSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
	});

	afterEach(() => {
		openSpy.mockRestore();
	});

	it('renders the official badge as an image-button with an accessible name', () => {
		render(AddToGoogleWalletButton, { props: { id: 'ticket-1' } });
		const button = screen.getByRole('button', { name: 'Add to Google Wallet' });
		const img = button.querySelector('img');
		expect(img).not.toBeNull();
		expect(img?.getAttribute('src')).toBe('/wallet/google-wallet-badge-en.svg');
	});

	it('fetches the ticket save URL as JSON and opens it', async () => {
		ticketwalletGoogleWalletSaveLink.mockResolvedValue(okResult());
		const user = userEvent.setup();
		render(AddToGoogleWalletButton, { props: { id: 'ticket-1' } });

		await user.click(screen.getByRole('button', { name: 'Add to Google Wallet' }));

		await waitFor(() => {
			expect(ticketwalletGoogleWalletSaveLink).toHaveBeenCalledWith({
				path: { ticket_id: 'ticket-1' },
				query: { format: 'json' }
			});
			expect(openSpy).toHaveBeenCalledWith(SAVE_URL, '_blank', 'noopener');
		});
		expect(seriespassGoogleWalletSaveLink).not.toHaveBeenCalled();
	});

	it('uses the series-pass endpoint for kind="series-pass"', async () => {
		seriespassGoogleWalletSaveLink.mockResolvedValue(okResult());
		const user = userEvent.setup();
		render(AddToGoogleWalletButton, { props: { id: 'pass-1', kind: 'series-pass' } });

		await user.click(screen.getByRole('button', { name: 'Add to Google Wallet' }));

		await waitFor(() => {
			expect(seriespassGoogleWalletSaveLink).toHaveBeenCalledWith({
				path: { held_pass_id: 'pass-1' },
				query: { format: 'json' }
			});
		});
		expect(ticketwalletGoogleWalletSaveLink).not.toHaveBeenCalled();
	});

	it('shows the not-configured message on 503', async () => {
		ticketwalletGoogleWalletSaveLink.mockResolvedValue(errorResult(503));
		const user = userEvent.setup();
		render(AddToGoogleWalletButton, { props: { id: 'ticket-1' } });

		await user.click(screen.getByRole('button', { name: 'Add to Google Wallet' }));

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('Google Wallet is not configured');
		expect(openSpy).not.toHaveBeenCalled();
	});

	it('shows a not-found message on 404', async () => {
		ticketwalletGoogleWalletSaveLink.mockResolvedValue(errorResult(404));
		const user = userEvent.setup();
		render(AddToGoogleWalletButton, { props: { id: 'ticket-1' } });

		await user.click(screen.getByRole('button', { name: 'Add to Google Wallet' }));

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('Ticket not found');
	});

	it('shows a generic failure message on other errors', async () => {
		ticketwalletGoogleWalletSaveLink.mockRejectedValue(new Error('network down'));
		const user = userEvent.setup();
		render(AddToGoogleWalletButton, { props: { id: 'ticket-1' } });

		await user.click(screen.getByRole('button', { name: 'Add to Google Wallet' }));

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('network down');
	});
});
