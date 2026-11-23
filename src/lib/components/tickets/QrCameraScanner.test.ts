import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QrCameraScanner from './QrCameraScanner.svelte';

const start = vi.hoisted(() => vi.fn());
const stop = vi.hoisted(() => vi.fn());
vi.mock('html5-qrcode', () => ({
	Html5Qrcode: class {
		start = start;
		stop = stop;
		clear = vi.fn();
	}
}));

const onScan = vi.fn(() => Promise.resolve());

beforeEach(() => {
	vi.clearAllMocks();
	start.mockResolvedValue(undefined);
	stop.mockResolvedValue(undefined);
	Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
});

describe('QrCameraScanner', () => {
	it('keeps auto-start and the destructive alert by default (ticket check-in)', async () => {
		start.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
		render(QrCameraScanner, { props: { active: true, onScan } });
		await waitFor(() => expect(start).toHaveBeenCalled());
		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('ticket code');
		expect(screen.queryByRole('button', { name: /scan with camera/i })).toBeNull();
	});

	describe('manualStart', () => {
		it('does not request the camera on load and offers a start button', () => {
			render(QrCameraScanner, { props: { active: true, manualStart: true, onScan } });
			expect(start).not.toHaveBeenCalled();
			expect(screen.getByRole('button', { name: /scan with camera/i })).toBeTruthy();
			expect(screen.queryByRole('alert')).toBeNull();
		});

		it('starts the camera on click and lets the user stop it', async () => {
			const user = userEvent.setup();
			render(QrCameraScanner, { props: { active: true, manualStart: true, onScan } });
			await user.click(screen.getByRole('button', { name: /scan with camera/i }));
			await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
			await user.click(await screen.findByRole('button', { name: /stop camera/i }));
			await waitFor(() => expect(stop).toHaveBeenCalled());
			expect(screen.getByRole('button', { name: /scan with camera/i })).toBeTruthy();
		});

		it('shows a denied camera as a neutral hint with card wording', async () => {
			start.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
			const user = userEvent.setup();
			render(QrCameraScanner, {
				props: { active: true, manualStart: true, codeNoun: 'card', onScan }
			});
			await user.click(screen.getByRole('button', { name: /scan with camera/i }));
			const hint = await screen.findByRole('status');
			expect(hint.textContent).toContain('card code');
			expect(hint.textContent).not.toContain('ticket');
			expect(screen.queryByRole('alert')).toBeNull();
			// The button comes back so the user can retry.
			expect(screen.getByRole('button', { name: /scan with camera/i })).toBeTruthy();
		});
	});
});
