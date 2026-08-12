import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PdfDownloadButton from './PdfDownloadButton.svelte';

describe('PdfDownloadButton', () => {
	it('defaults to the shared "Download PDF" label and takes an override', () => {
		const { unmount } = render(PdfDownloadButton, {
			props: { onDownload: () => Promise.resolve() }
		});
		expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
		unmount();

		render(PdfDownloadButton, {
			props: { onDownload: () => Promise.resolve(), label: 'Download membership PDF' }
		});
		expect(screen.getByRole('button', { name: 'Download membership PDF' })).toBeInTheDocument();
	});

	/**
	 * `disabled` alone loses the race between the click and the first await, so a
	 * fast double-click used to fire two downloads and write the file twice.
	 *
	 * Both clicks are dispatched in ONE tick, deliberately not through
	 * `userEvent`: the guard only matters in the window before Svelte has
	 * flushed `disabled`, and any route that waits for that flush first — a
	 * second `user.click()`, or a bare `.click()` after `toBeDisabled()` —
	 * passes with the guard deleted, because jsdom refuses to dispatch a click
	 * on a disabled control at all. (Verified by deleting the guard: the
	 * previous version of this test still passed.)
	 */
	it('ignores a second click while a download is in flight', async () => {
		let release!: () => void;
		const onDownload = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					release = resolve;
				})
		);
		render(PdfDownloadButton, { props: { onDownload } });

		const button = screen.getByRole('button', { name: 'Download PDF' });
		button.click();
		button.click();
		expect(onDownload).toHaveBeenCalledTimes(1);

		await waitFor(() => expect(button).toBeDisabled());
		release();
		await waitFor(() => expect(button).not.toBeDisabled());
	});

	/**
	 * Callers report their own failures, so a rejection here is a caller bug —
	 * but it must not leave the button stuck spinning, nor escape as an unhandled
	 * rejection.
	 */
	it('logs and recovers when the download callback rejects', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const onDownload = vi.fn(() => Promise.reject(new Error('boom')));
		const user = userEvent.setup();
		render(PdfDownloadButton, { props: { onDownload } });

		const button = screen.getByRole('button', { name: 'Download PDF' });
		await user.click(button);

		await waitFor(() => expect(button).not.toBeDisabled());
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});
});
