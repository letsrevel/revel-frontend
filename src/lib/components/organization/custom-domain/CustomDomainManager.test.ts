import { render, screen, waitFor, act, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

vi.mock('$lib/api/client', () => ({ client: {} }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./custom-domain-api', async (importOriginal) => ({
	...(await importOriginal<typeof import('./custom-domain-api')>()),
	getCustomDomain: vi.fn(),
	requestCustomDomain: vi.fn(),
	refreshCustomDomain: vi.fn(),
	deleteCustomDomain: vi.fn()
}));

import CustomDomainManager from './CustomDomainManager.svelte';
import {
	CustomDomainApiError,
	PENDING_POLL_MS,
	deleteCustomDomain,
	getCustomDomain,
	refreshCustomDomain,
	requestCustomDomain,
	type CustomDomain
} from './custom-domain-api';
import { toast } from 'svelte-sonner';

const PENDING: CustomDomain = {
	hostname: 'events.example.com',
	status: 'pending',
	verification_records: [
		{ type: 'TXT', name: '_cf-custom-hostname.events.example.com', value: 'token-abc' },
		{ type: 'TXT', name: '_acme-challenge.events.example.com', value: 'token-def' }
	],
	cname_target: 'customers.revel.example',
	verified_at: null,
	errors: []
};
const ACTIVE: CustomDomain = {
	...PENDING,
	status: 'active',
	verified_at: '2026-10-20T14:30:00Z'
};
const FAILED: CustomDomain = {
	...PENDING,
	status: 'failed',
	errors: ['Certificate validation timed out']
};

function setup() {
	const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, pointerEventsCheck: 0 });
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: CustomDomainManager,
			componentProps: { slug: 'acme' }
		}
	});
	return user;
}

async function settle() {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(0);
	});
}

describe('CustomDomainManager (#1058)', () => {
	beforeEach(() => {
		vi.useFakeTimers({ shouldAdvanceTime: false });
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.useRealTimers();
		document.body.removeAttribute('style');
	});

	it('none: explains the feature and shows the hostname form', async () => {
		vi.mocked(getCustomDomain).mockResolvedValue(null);
		setup();
		await settle();

		expect(screen.getByTestId('state-none')).toBeInTheDocument();
		expect(screen.getByText(/Powered by Revel/)).toBeInTheDocument();
		expect(screen.getByLabelText('Domain name')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Connect domain' })).toBeInTheDocument();
	});

	it('pending: shows the badge, the records with copy buttons and the CNAME target', async () => {
		vi.mocked(getCustomDomain).mockResolvedValue(PENDING);
		const user = setup();
		const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
		await settle();

		expect(screen.getByTestId('domain-hostname')).toHaveTextContent('events.example.com');
		expect(screen.getByTestId('status-badge')).toHaveTextContent('Waiting for DNS');
		const records = screen.getAllByTestId('dns-record');
		expect(records).toHaveLength(2);
		expect(within(records[0]).getByLabelText('Record 1 (TXT) value')).toHaveValue('token-abc');
		expect(screen.getByLabelText('Address to point to')).toHaveValue('customers.revel.example');
		expect(screen.getByText(/minutes to a few hours/)).toBeInTheDocument();

		await user.click(
			within(records[0]).getByRole('button', { name: /Copy Record 1 \(TXT\) value/ })
		);
		expect(writeText).toHaveBeenCalledWith('token-abc');
		expect(toast.success).toHaveBeenCalled();
	});

	it('pending: sync errors appear in a callout, not an alert', async () => {
		vi.mocked(getCustomDomain).mockResolvedValue({
			...PENDING,
			errors: ['Waiting for the record']
		});
		setup();
		await settle();

		const callout = screen.getByTestId('sync-errors');
		expect(callout).toHaveTextContent('Waiting for the record');
		expect(callout).not.toHaveAttribute('role', 'alert');
	});

	it('active: links to the https domain and reads the verified date', async () => {
		vi.mocked(getCustomDomain).mockResolvedValue(ACTIVE);
		setup();
		await settle();

		const link = screen.getByRole('link', { name: /https:\/\/events\.example\.com/ });
		expect(link).toHaveAttribute('href', 'https://events.example.com');
		expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
		expect(screen.getByText(/Verified on .*2026/)).toBeInTheDocument();
		expect(screen.getByText(/redirect to your domain/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Check now' })).not.toBeInTheDocument();
		expect(screen.queryAllByTestId('dns-record')).toHaveLength(0);
	});

	it('failed: shows the errors and offers Check now and a different hostname', async () => {
		vi.mocked(getCustomDomain).mockResolvedValue(FAILED);
		const user = setup();
		await settle();

		expect(screen.getByTestId('status-badge')).toHaveTextContent('Needs attention');
		expect(screen.getByText('Certificate validation timed out')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Check now' })).toBeInTheDocument();

		expect(screen.queryByLabelText('Domain name')).not.toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Use a different domain' }));
		expect(screen.getByLabelText('Domain name')).toBeInTheDocument();

		const next: CustomDomain = { ...PENDING, hostname: 'tickets.example.org' };
		vi.mocked(requestCustomDomain).mockResolvedValue(next);
		await user.type(screen.getByLabelText('Domain name'), 'tickets.example.org');
		await user.click(screen.getByRole('button', { name: 'Connect new domain' }));
		await settle();

		expect(requestCustomDomain).toHaveBeenCalledWith('acme', 'tickets.example.org');
		expect(screen.getByTestId('domain-hostname')).toHaveTextContent('tickets.example.org');
		expect(screen.getByTestId('state-pending')).toBeInTheDocument();
	});

	describe('polling', () => {
		it('re-reads every 45 s while pending', async () => {
			vi.mocked(getCustomDomain).mockResolvedValue(PENDING);
			setup();
			await settle();
			expect(getCustomDomain).toHaveBeenCalledTimes(1);

			await act(async () => {
				await vi.advanceTimersByTimeAsync(PENDING_POLL_MS);
			});
			expect(getCustomDomain).toHaveBeenCalledTimes(2);

			await act(async () => {
				await vi.advanceTimersByTimeAsync(PENDING_POLL_MS);
			});
			expect(getCustomDomain).toHaveBeenCalledTimes(3);
		});

		it('stops once the domain is no longer pending', async () => {
			vi.mocked(getCustomDomain).mockResolvedValueOnce(PENDING).mockResolvedValue(ACTIVE);
			setup();
			await settle();

			await act(async () => {
				await vi.advanceTimersByTimeAsync(PENDING_POLL_MS);
			});
			expect(getCustomDomain).toHaveBeenCalledTimes(2);
			expect(screen.getByTestId('state-active')).toBeInTheDocument();

			await act(async () => {
				await vi.advanceTimersByTimeAsync(PENDING_POLL_MS * 4);
			});
			expect(getCustomDomain).toHaveBeenCalledTimes(2);
		});

		it.each([
			['active', ACTIVE],
			['failed', FAILED],
			['none', null]
		])('does not poll when the state is %s', async (_name, value) => {
			vi.mocked(getCustomDomain).mockResolvedValue(value);
			setup();
			await settle();
			await act(async () => {
				await vi.advanceTimersByTimeAsync(PENDING_POLL_MS * 4);
			});
			expect(getCustomDomain).toHaveBeenCalledTimes(1);
		});

		it('does not poll while the page is hidden', async () => {
			const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
			vi.mocked(getCustomDomain).mockResolvedValue(PENDING);
			setup();
			await settle();
			await act(async () => {
				await vi.advanceTimersByTimeAsync(PENDING_POLL_MS * 3);
			});
			expect(getCustomDomain).toHaveBeenCalledTimes(1);
			hidden.mockRestore();
		});
	});

	describe('refresh', () => {
		it('Check now calls refresh and renders the fresh state', async () => {
			vi.mocked(getCustomDomain).mockResolvedValue(PENDING);
			vi.mocked(refreshCustomDomain).mockResolvedValue(ACTIVE);
			const user = setup();
			await settle();

			await user.click(screen.getByRole('button', { name: 'Check now' }));
			await settle();

			expect(refreshCustomDomain).toHaveBeenCalledWith('acme');
			expect(screen.getByTestId('state-active')).toBeInTheDocument();
		});

		it('shows a 502 detail inline, with no toast', async () => {
			vi.mocked(getCustomDomain).mockResolvedValue(PENDING);
			vi.mocked(refreshCustomDomain).mockRejectedValue(
				new CustomDomainApiError('x', 502, [], 'Could not reach the provider')
			);
			const user = setup();
			await settle();

			await user.click(screen.getByRole('button', { name: 'Check now' }));
			await settle();

			expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the provider');
			expect(toast.error).not.toHaveBeenCalled();
		});
	});

	describe('remove', () => {
		it('asks for confirmation (no browser confirm) and deletes, then returns to the form', async () => {
			const confirmSpy = vi.spyOn(window, 'confirm');
			vi.mocked(getCustomDomain).mockResolvedValueOnce(ACTIVE).mockResolvedValue(null);
			vi.mocked(deleteCustomDomain).mockResolvedValue(undefined);
			const user = setup();
			await settle();

			await user.click(screen.getByRole('button', { name: 'Remove domain' }));
			const dialog = screen.getByRole('dialog');
			expect(dialog).toHaveTextContent('go back to the Revel address');
			expect(deleteCustomDomain).not.toHaveBeenCalled();

			await user.click(within(dialog).getByRole('button', { name: 'Remove domain' }));
			await settle();

			expect(deleteCustomDomain).toHaveBeenCalledWith('acme');
			expect(confirmSpy).not.toHaveBeenCalled();
			expect(screen.getByTestId('state-none')).toBeInTheDocument();
			confirmSpy.mockRestore();
		});

		it('cancel keeps the domain', async () => {
			vi.mocked(getCustomDomain).mockResolvedValue(ACTIVE);
			const user = setup();
			await settle();

			await user.click(screen.getByRole('button', { name: 'Remove domain' }));
			await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
			await settle();

			expect(deleteCustomDomain).not.toHaveBeenCalled();
			await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
			expect(screen.getByTestId('state-active')).toBeInTheDocument();
		});

		it('a failed delete shows the detail and keeps the domain', async () => {
			vi.mocked(getCustomDomain).mockResolvedValue(ACTIVE);
			vi.mocked(deleteCustomDomain).mockRejectedValue(
				new CustomDomainApiError('x', 502, [], 'Provider error')
			);
			const user = setup();
			await settle();

			await user.click(screen.getByRole('button', { name: 'Remove domain' }));
			await user.click(
				within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove domain' })
			);
			await settle();

			expect(screen.getByRole('alert')).toHaveTextContent('Provider error');
			expect(screen.getByTestId('state-active')).toBeInTheDocument();
		});
	});

	it('shows a retry when the read fails', async () => {
		vi.mocked(getCustomDomain).mockRejectedValueOnce(new CustomDomainApiError('x', 500));
		vi.mocked(getCustomDomain).mockResolvedValue(null);
		const user = setup();
		await settle();

		expect(screen.getByRole('alert')).toHaveTextContent("couldn't load");
		await user.click(screen.getByRole('button', { name: 'Try again' }));
		await settle();
		expect(screen.getByTestId('state-none')).toBeInTheDocument();
	});
});
