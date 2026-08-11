import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MembershipCardDownloads from './MembershipCardDownloads.svelte';

const membershipwalletDownloadPdf = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', () => ({ membershipwalletDownloadPdf }));

const membershipwalletDownloadApplePass = vi.hoisted(() => vi.fn());
const membershipwalletGoogleWalletSaveLink = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	membershipwalletDownloadApplePass,
	membershipwalletGoogleWalletSaveLink,
	// The two wallet badges import their sibling operations unconditionally.
	ticketwalletDownloadApplePass: vi.fn(),
	seriespassDownloadSeriesPassPkpass: vi.fn(),
	ticketwalletGoogleWalletSaveLink: vi.fn(),
	seriespassGoogleWalletSaveLink: vi.fn()
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock('svelte-sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

const BASE = {
	slug: 'acme-collective',
	organizationName: 'Acme Collective',
	applePassAvailable: true,
	googlePassAvailable: true
};

describe('MembershipCardDownloads', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.URL.createObjectURL = vi.fn(() => 'blob:mock');
		window.URL.revokeObjectURL = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('always offers the PDF — it is the fallback when no wallet is configured', () => {
		render(MembershipCardDownloads, {
			props: { ...BASE, applePassAvailable: false, googlePassAvailable: false }
		});
		expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
	});

	/**
	 * The availability flags are already status-aware server-side, so the
	 * component must obey them literally rather than re-deriving anything: a
	 * second, drifting source of truth is exactly what this contract avoids.
	 */
	it('hides the Apple badge when the backend says the pass is unavailable', () => {
		render(MembershipCardDownloads, { props: { ...BASE, applePassAvailable: false } });
		expect(screen.queryByRole('button', { name: 'Add to Apple Wallet' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Add to Google Wallet' })).toBeInTheDocument();
	});

	it('hides the Google badge when the backend says the pass is unavailable', () => {
		render(MembershipCardDownloads, { props: { ...BASE, googlePassAvailable: false } });
		expect(screen.queryByRole('button', { name: 'Add to Google Wallet' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Add to Apple Wallet' })).toBeInTheDocument();
	});

	it('shows both badges when both are available', () => {
		render(MembershipCardDownloads, { props: BASE });
		expect(screen.getByRole('button', { name: 'Add to Apple Wallet' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Add to Google Wallet' })).toBeInTheDocument();
	});

	it('downloads the PDF for the organization slug', async () => {
		membershipwalletDownloadPdf.mockResolvedValue({
			response: {
				ok: true,
				status: 200,
				blob: () => Promise.resolve(new Blob(['pdf'], { type: 'application/pdf' }))
			}
		});
		const user = userEvent.setup();
		render(MembershipCardDownloads, { props: BASE });

		await user.click(screen.getByRole('button', { name: 'Download PDF' }));

		await waitFor(() => {
			expect(membershipwalletDownloadPdf).toHaveBeenCalledWith({
				path: { slug: 'acme-collective' },
				parseAs: 'stream'
			});
			expect(window.URL.createObjectURL).toHaveBeenCalled();
		});
	});

	it('reports a 404 as a missing card rather than a generic failure', async () => {
		membershipwalletDownloadPdf.mockResolvedValue({ response: { ok: false, status: 404 } });
		const user = userEvent.setup();
		render(MembershipCardDownloads, { props: BASE });

		await user.click(screen.getByRole('button', { name: 'Download PDF' }));

		await waitFor(() => expect(toastError).toHaveBeenCalledWith('Membership card not found'));
	});

	it('never surfaces raw error text from an unexpected failure', async () => {
		membershipwalletDownloadPdf.mockRejectedValue(new Error('ECONNRESET from upstream'));
		const user = userEvent.setup();
		render(MembershipCardDownloads, { props: BASE });

		await user.click(screen.getByRole('button', { name: 'Download PDF' }));

		await waitFor(() => expect(toastError).toHaveBeenCalled());
		expect(toastError.mock.calls[0][0]).not.toContain('ECONNRESET');
	});
});
