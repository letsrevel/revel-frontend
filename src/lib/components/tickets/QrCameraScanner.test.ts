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

		it('keeps the status region mounted while empty, then fills it', async () => {
			start.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
			const user = userEvent.setup();
			render(QrCameraScanner, { props: { active: true, manualStart: true, onScan } });
			const region = screen.getByRole('status');
			expect(region.textContent).toBe('');
			await user.click(screen.getByRole('button', { name: /scan with camera/i }));
			await waitFor(() => expect(region.textContent).toContain('camera'));
			// Same node, not a new one.
			expect(screen.getByRole('status')).toBe(region);
		});

		it('shows a processing failure as the destructive alert, not the hint', async () => {
			const failing = vi.fn(() => Promise.reject(new Error('boom')));
			const user = userEvent.setup();
			render(QrCameraScanner, {
				props: { active: true, manualStart: true, codeNoun: 'card', onScan: failing }
			});
			await user.type(screen.getByRole('textbox'), 'ABC');
			await user.keyboard('{Enter}');
			const alert = await screen.findByRole('alert');
			expect(alert.textContent).toContain('card');
			expect(screen.getByRole('status').textContent).toBe('');
		});

		describe('start/stop race', () => {
			function deferredStart() {
				let resolveStart: () => void = () => undefined;
				start.mockImplementation(
					() =>
						new Promise<void>((resolve) => {
							resolveStart = () => resolve();
						})
				);
				return () => resolveStart();
			}

			it('stops the camera once a start that was stopped meanwhile resolves', async () => {
				const resolveStart = deferredStart();
				const user = userEvent.setup();
				render(QrCameraScanner, { props: { active: true, manualStart: true, onScan } });
				await user.click(screen.getByRole('button', { name: /scan with camera/i }));
				await waitFor(() => expect(start).toHaveBeenCalledTimes(1));

				// Stop while start() is still pending: not a no-op.
				await user.click(screen.getByRole('button', { name: /stop camera/i }));
				expect(stop).not.toHaveBeenCalled();

				resolveStart();
				await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
			});

			it('disables Scan while a start is pending, so it cannot start twice', async () => {
				const resolveStart = deferredStart();
				const user = userEvent.setup();
				render(QrCameraScanner, { props: { active: true, manualStart: true, onScan } });
				await user.click(screen.getByRole('button', { name: /scan with camera/i }));
				await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
				await user.click(screen.getByRole('button', { name: /stop camera/i }));

				const scan = screen.getByRole('button', { name: /scan with camera/i });
				expect(scan).toBeDisabled();
				await user.click(scan);
				expect(start).toHaveBeenCalledTimes(1);

				resolveStart();
				await waitFor(() => expect(scan).not.toBeDisabled());
				expect(screen.queryByRole('status')?.textContent).toBe('');
			});

			it('keeps the camera running when a start resolves and it is still wanted', async () => {
				const resolveStart = deferredStart();
				const user = userEvent.setup();
				render(QrCameraScanner, { props: { active: true, manualStart: true, onScan } });
				await user.click(screen.getByRole('button', { name: /scan with camera/i }));
				await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
				resolveStart();
				await screen.findByRole('button', { name: /stop camera/i });
				expect(stop).not.toHaveBeenCalled();
			});

			describe('stop in flight', () => {
				function deferredStop() {
					let resolveStop: () => void = () => undefined;
					stop.mockImplementation(
						() =>
							new Promise<void>((resolve) => {
								resolveStop = () => resolve();
							})
					);
					return () => resolveStop();
				}

				it('starts again when the camera is wanted during a pending stop', async () => {
					const resolveStop = deferredStop();
					const { rerender } = render(QrCameraScanner, { props: { active: true, onScan } });
					await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
					await screen.findByRole('textbox');
					await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
					await new Promise((r) => setTimeout(r, 0));

					await rerender({ active: false, onScan });
					await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
					// Wanted again while the stop has not resolved: must not be lost.
					await rerender({ active: true, onScan });
					expect(start).toHaveBeenCalledTimes(1);

					resolveStop();
					await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
					expect(stop).toHaveBeenCalledTimes(1);
				});

				it('calls scanner.stop() once for overlapping stops', async () => {
					const resolveStop = deferredStop();
					const user = userEvent.setup();
					const { rerender } = render(QrCameraScanner, { props: { active: true, onScan } });
					await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
					await new Promise((r) => setTimeout(r, 0));

					await rerender({ active: false, onScan });
					await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
					// A manual submit also asks for a stop while the first is pending.
					await user.type(screen.getByRole('textbox'), 'ABC');
					await user.keyboard('{Enter}');
					expect(stop).toHaveBeenCalledTimes(1);

					resolveStop();
					await waitFor(() => expect(onScan).toHaveBeenCalledWith('ABC'));
					expect(stop).toHaveBeenCalledTimes(1);
				});
			});
		});
	});
});
