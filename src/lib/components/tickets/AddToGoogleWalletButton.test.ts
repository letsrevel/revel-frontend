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

interface MockResult {
	data?: { save_url: string };
	error?: object;
	response: { ok: boolean; status: number };
}

function okResult(): MockResult {
	return {
		data: { save_url: SAVE_URL },
		response: { ok: true, status: 200 }
	};
}

function errorResult(status: number): MockResult {
	return {
		data: undefined,
		error: {},
		response: { ok: false, status }
	};
}

describe('AddToGoogleWalletButton', () => {
	let openSpy: ReturnType<typeof vi.spyOn>;
	let openedWindow: { opener: unknown };

	beforeEach(() => {
		vi.clearAllMocks();
		openedWindow = { opener: 'parent-window' };
		openSpy = vi.spyOn(window, 'open').mockReturnValue(openedWindow as unknown as Window);
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

	it('fetches the ticket save URL as JSON, opens it, and nulls the opener', async () => {
		ticketwalletGoogleWalletSaveLink.mockResolvedValue(okResult());
		const user = userEvent.setup();
		render(AddToGoogleWalletButton, { props: { id: 'ticket-1' } });

		await user.click(screen.getByRole('button', { name: 'Add to Google Wallet' }));

		await waitFor(() => {
			expect(ticketwalletGoogleWalletSaveLink).toHaveBeenCalledWith({
				path: { ticket_id: 'ticket-1' },
				query: { format: 'json' }
			});
			// No 'noopener' feature: it would force a null return even on
			// success and make the popup-blocked fallback always fire.
			expect(openSpy).toHaveBeenCalledWith(SAVE_URL, '_blank');
			expect(openedWindow.opener).toBeNull();
		});
		expect(seriespassGoogleWalletSaveLink).not.toHaveBeenCalled();
	});

	it('falls back to same-tab navigation when the popup is blocked', async () => {
		ticketwalletGoogleWalletSaveLink.mockResolvedValue(okResult());
		openSpy.mockReturnValue(null);
		const originalLocation = window.location;
		const fakeLocation = { ...originalLocation, href: 'http://localhost/' };
		Object.defineProperty(window, 'location', {
			value: fakeLocation,
			writable: true,
			configurable: true
		});
		try {
			const user = userEvent.setup();
			render(AddToGoogleWalletButton, { props: { id: 'ticket-1' } });

			await user.click(screen.getByRole('button', { name: 'Add to Google Wallet' }));

			await waitFor(() => {
				expect(fakeLocation.href).toBe(SAVE_URL);
			});
		} finally {
			Object.defineProperty(window, 'location', {
				value: originalLocation,
				writable: true,
				configurable: true
			});
		}
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

	it('shows a localized generic failure message on unexpected errors', async () => {
		ticketwalletGoogleWalletSaveLink.mockRejectedValue(new Error('network down'));
		const user = userEvent.setup();
		render(AddToGoogleWalletButton, { props: { id: 'ticket-1' } });

		await user.click(screen.getByRole('button', { name: 'Add to Google Wallet' }));

		// Raw error text (unlocalized, possibly backend detail) must never
		// reach the alert — only the localized generic message.
		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('Failed to open Google Wallet');
		expect(alert.textContent).not.toContain('network down');
	});
});
