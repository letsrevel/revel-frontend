import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import QrCameraScanner from './QrCameraScanner.svelte';

const start = vi.hoisted(() => vi.fn());
const stop = vi.hoisted(() => vi.fn());
const getState = vi.hoisted(() => vi.fn());
vi.mock('html5-qrcode', () => ({
	Html5QrcodeScannerState: { UNKNOWN: 0, NOT_STARTED: 1, SCANNING: 2, PAUSED: 3 },
	Html5Qrcode: class {
		start = start;
		stop = stop;
		getState = getState;
		clear = vi.fn();
	}
}));

const onScan = vi.fn(() => Promise.resolve());

beforeEach(() => {
	vi.clearAllMocks();
	start.mockResolvedValue(undefined);
	stop.mockResolvedValue(undefined);
	getState.mockReturnValue(2);
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

		it('keeps keyboard focus on the same button when it toggles Start and Stop', async () => {
			const user = userEvent.setup();
			render(QrCameraScanner, { props: { active: true, manualStart: true, onScan } });
			const button = screen.getByRole('button', { name: /scan with camera/i });
			button.focus();
			await user.keyboard('{Enter}');
			const stopButton = await screen.findByRole('button', { name: /stop camera/i });
			expect(stopButton).toBe(button);
			expect(document.activeElement).toBe(button);
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
		});
	});

	describe('scan handling and lifecycle', () => {
		/** Make `start` capture the decoder's success callback. */
		function captureScanCallback(): () => (text: string) => Promise<void> {
			let cb: (text: string) => Promise<void> = () => Promise.resolve();
			start.mockImplementation(
				(_cfg: unknown, _opts: unknown, onSuccess: (text: string) => Promise<void>) => {
					cb = onSuccess;
					return Promise.resolve();
				}
			);
			return () => cb;
		}

		it('calls onScan once for two back-to-back scan callbacks', async () => {
			const getCb = captureScanCallback();
			let finish: () => void = () => undefined;
			const slow = vi.fn(
				() =>
					new Promise<void>((resolve) => {
						finish = resolve;
					})
			);
			render(QrCameraScanner, { props: { active: true, onScan: slow } });
			await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
			const cb = getCb();
			const first = cb('CODE');
			const second = cb('CODE');
			await waitFor(() => expect(slow).toHaveBeenCalledTimes(1));
			finish();
			await Promise.all([first, second]);
			expect(slow).toHaveBeenCalledTimes(1);
		});

		it('resumes the camera after onScan resolves in continuous mode', async () => {
			const getCb = captureScanCallback();
			render(QrCameraScanner, { props: { active: true, continuous: true, onScan } });
			await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
			await getCb()('CODE');
			expect(onScan).toHaveBeenCalledWith('CODE');
			expect(stop).toHaveBeenCalledTimes(1);
			await waitFor(() => expect(start).toHaveBeenCalledTimes(2), { timeout: 3000 });
		});

		it('does not resume after a scan when not continuous', async () => {
			const getCb = captureScanCallback();
			render(QrCameraScanner, { props: { active: true, onScan } });
			await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
			await getCb()('CODE');
			await new Promise((r) => setTimeout(r, 20));
			expect(start).toHaveBeenCalledTimes(1);
		});

		it('stops and never restarts when unmounted during a pending start', async () => {
			let resolveStart: () => void = () => undefined;
			start.mockImplementation(
				() =>
					new Promise<void>((resolve) => {
						resolveStart = resolve;
					})
			);
			const { unmount } = render(QrCameraScanner, { props: { active: true, onScan } });
			await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
			unmount();
			expect(stop).not.toHaveBeenCalled();
			resolveStart();
			await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
			await new Promise((r) => setTimeout(r, 20));
			expect(start).toHaveBeenCalledTimes(1);
		});
	});

	describe('pacing and robustness', () => {
		function captureCb(): () => (text: string) => Promise<void> {
			let cb: (text: string) => Promise<void> = () => Promise.resolve();
			start.mockImplementation(
				(_c: unknown, _o: unknown, onSuccess: (text: string) => Promise<void>) => {
					cb = onSuccess;
					return Promise.resolve();
				}
			);
			return () => cb;
		}

		describe('with fake timers', () => {
			beforeEach(() => {
				vi.useFakeTimers({ shouldAdvanceTime: true });
			});
			afterEach(() => {
				vi.useRealTimers();
			});

			it('resumes 1200 ms after a success, not immediately', async () => {
				const getCb = captureCb();
				render(QrCameraScanner, { props: { active: true, continuous: true, onScan } });
				await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
				await getCb()('CODE');
				await vi.advanceTimersByTimeAsync(1000);
				expect(start).toHaveBeenCalledTimes(1);
				await vi.advanceTimersByTimeAsync(300);
				await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
			});

			it('ignores the same text within the dedupe window, accepts it after', async () => {
				const getCb = captureCb();
				render(QrCameraScanner, { props: { active: true, continuous: true, onScan } });
				await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
				await getCb()('CODE');
				await getCb()('CODE');
				expect(onScan).toHaveBeenCalledTimes(1);
				await vi.advanceTimersByTimeAsync(2100);
				await getCb()('CODE');
				expect(onScan).toHaveBeenCalledTimes(2);
			});

			it('resumes 2000 ms after a failure even when not continuous', async () => {
				const getCb = captureCb();
				const failing = vi.fn(() => Promise.reject(new Error('boom')));
				render(QrCameraScanner, { props: { active: true, onScan: failing } });
				await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
				await getCb()('CODE');
				await vi.advanceTimersByTimeAsync(1500);
				expect(start).toHaveBeenCalledTimes(1);
				await vi.advanceTimersByTimeAsync(600);
				await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
			});

			it('keeps a failed code deduped for a full window after the camera resumes', async () => {
				// #1305: the resume delay and the dedupe window are both 2000 ms, so a bad
				// code held in frame was processed again on the first frame after resume.
				// The camera here takes 1000 ms to start, so the window must count from
				// the moment it is live, not from the resume timer.
				let cb: (text: string) => Promise<void> = async () => undefined;
				start.mockImplementation(
					(_c: unknown, _o: unknown, onSuccess: (text: string) => Promise<void>) => {
						cb = onSuccess;
						return start.mock.calls.length === 1
							? Promise.resolve()
							: new Promise<void>((resolve) => setTimeout(resolve, 1000));
					}
				);
				const failing = vi.fn(() => Promise.reject(new Error('boom')));
				render(QrCameraScanner, { props: { active: true, onScan: failing } });
				await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
				await cb('CODE');
				expect(failing).toHaveBeenCalledTimes(1);
				// Resume timer fires at 2000 ms; the camera is live at about 3000 ms.
				await vi.advanceTimersByTimeAsync(2100);
				await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
				await vi.advanceTimersByTimeAsync(1000);
				// 1900 ms of live camera: still deduped.
				await vi.advanceTimersByTimeAsync(1800);
				await cb('CODE');
				expect(failing).toHaveBeenCalledTimes(1);
				await vi.advanceTimersByTimeAsync(300);
				await cb('CODE');
				expect(failing).toHaveBeenCalledTimes(2);
			});

			it('does not extend the dedupe after a failed manual entry', async () => {
				const getCb = captureCb();
				const failing = vi.fn(() => Promise.reject(new Error('boom')));
				const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
				render(QrCameraScanner, { props: { active: true, onScan: failing } });
				await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
				await user.type(screen.getByRole('textbox'), 'CODE');
				await user.keyboard('{Enter}');
				await waitFor(() => expect(failing).toHaveBeenCalledTimes(1));
				await vi.advanceTimersByTimeAsync(2100);
				await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
				await getCb()('CODE');
				expect(failing).toHaveBeenCalledTimes(2);
			});

			it('does not resume after unmount', async () => {
				const getCb = captureCb();
				const { unmount } = render(QrCameraScanner, {
					props: { active: true, continuous: true, onScan }
				});
				await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
				await getCb()('CODE');
				unmount();
				await vi.advanceTimersByTimeAsync(3000);
				expect(start).toHaveBeenCalledTimes(1);
			});

			it('does not resume after the camera is stopped by the user', async () => {
				const getCb = captureCb();
				const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
				render(QrCameraScanner, {
					props: { active: true, manualStart: true, continuous: true, onScan }
				});
				await user.click(screen.getByRole('button', { name: /scan with camera/i }));
				await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
				await getCb()('CODE');
				await user.click(screen.getByRole('button', { name: /stop camera/i }));
				await vi.advanceTimersByTimeAsync(3000);
				expect(start).toHaveBeenCalledTimes(1);
			});

			it('a new success restarts the banner timer instead of being cut short', async () => {
				const getCb = captureCb();
				render(QrCameraScanner, { props: { active: true, continuous: true, onScan } });
				await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
				await getCb()('A');
				await vi.advanceTimersByTimeAsync(1100);
				await getCb()('B');
				await vi.advanceTimersByTimeAsync(300);
				// The first timer would have fired by now; the banner must survive.
				expect(screen.getByText(/scan/i, { selector: '[role="status"]' })).toBeTruthy();
				await vi.advanceTimersByTimeAsync(1000);
				await waitFor(() => expect(document.querySelector('.bg-success')).toBeNull());
			});
		});

		it('treats a failed stop as stopped when the scanner is NOT_STARTED', async () => {
			const user = userEvent.setup();
			stop.mockRejectedValue(new Error('not running'));
			getState.mockReturnValue(1);
			render(QrCameraScanner, { props: { active: true, manualStart: true, onScan } });
			await user.click(screen.getByRole('button', { name: /scan with camera/i }));
			await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
			await user.click(await screen.findByRole('button', { name: /stop camera/i }));
			await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
			await user.click(screen.getByRole('button', { name: /scan with camera/i }));
			await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
		});

		describe('failed stop', () => {
			async function startThenFailStop() {
				const user = userEvent.setup();
				stop.mockRejectedValue(new Error('still running'));
				getState.mockReturnValue(2);
				const view = render(QrCameraScanner, {
					props: { active: true, manualStart: true, onScan }
				});
				await user.click(screen.getByRole('button', { name: /scan with camera/i }));
				await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
				await user.click(await screen.findByRole('button', { name: /stop camera/i }));
				await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
				return { user, view };
			}

			it('keeps the viewfinder, a Stop button and a message while the scanner still runs', async () => {
				const { view } = await startThenFailStop();
				const hint = await screen.findByRole('status');
				await waitFor(() => expect(hint.textContent).toContain('could not be turned off'));
				expect(screen.getByRole('button', { name: /stop camera/i })).not.toBeDisabled();
				expect(view.container.querySelector('.relative.mb-4')?.classList.contains('hidden')).toBe(
					false
				);
				expect(screen.queryByRole('alert')).toBeNull();
			});

			it('retries stop on every click and recovers when it succeeds', async () => {
				const { user, view } = await startThenFailStop();
				await screen.findByText(/could not be turned off/i);
				stop.mockResolvedValue(undefined);
				await user.click(screen.getByRole('button', { name: /stop camera/i }));
				await waitFor(() => expect(stop).toHaveBeenCalledTimes(2));
				await screen.findByRole('button', { name: /scan with camera/i });
				expect(screen.queryByText(/could not be turned off/i)).toBeNull();
				expect(view.container.querySelector('.relative.mb-4')?.classList.contains('hidden')).toBe(
					true
				);
			});
		});

		it('keeps Stop enabled while the camera is requested but still starting', async () => {
			start.mockImplementation(() => new Promise<void>(() => undefined));
			const user = userEvent.setup();
			render(QrCameraScanner, { props: { active: true, manualStart: true, onScan } });
			await user.click(screen.getByRole('button', { name: /scan with camera/i }));
			await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
			expect(screen.getByRole('button', { name: /stop camera/i })).not.toBeDisabled();
		});

		it('disables manual submit while a scan is being handled', async () => {
			let finish: () => void = () => undefined;
			const slow = vi.fn(
				() =>
					new Promise<void>((resolve) => {
						finish = resolve;
					})
			);
			const user = userEvent.setup();
			render(QrCameraScanner, { props: { active: true, manualStart: true, onScan: slow } });
			const input = screen.getByRole('textbox');
			await user.type(input, 'ABC');
			const submit = screen.getByRole('button', { name: /check in/i });
			await user.click(submit);
			await waitFor(() => expect(slow).toHaveBeenCalledTimes(1));
			await user.type(input, 'D');
			expect(submit).toBeDisabled();
			finish();
			await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
			await user.type(input, 'E');
			expect(submit).not.toBeDisabled();
		});

		it('manual submit does not wait for an unanswered camera permission prompt', async () => {
			start.mockImplementation(() => new Promise<void>(() => undefined));
			const user = userEvent.setup();
			render(QrCameraScanner, { props: { active: true, manualStart: true, onScan } });
			await user.click(screen.getByRole('button', { name: /scan with camera/i }));
			await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
			await user.type(screen.getByRole('textbox'), 'ABC');
			await user.keyboard('{Enter}');
			await waitFor(() => expect(onScan).toHaveBeenCalledWith('ABC'));
		});

		it('shows the initializing overlay only while starting, not after a camera error', async () => {
			start.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
			const user = userEvent.setup();
			render(QrCameraScanner, { props: { active: true, manualStart: true, onScan } });
			await user.click(screen.getByRole('button', { name: /scan with camera/i }));
			await waitFor(() => expect(screen.getByRole('status').textContent).toContain('camera'));
			await user.type(screen.getByRole('textbox'), 'ABC');
			await user.keyboard('{Enter}');
			await waitFor(() => expect(onScan).toHaveBeenCalled());
			expect(screen.queryByText(/initializing/i)).toBeNull();
		});
	});
});
