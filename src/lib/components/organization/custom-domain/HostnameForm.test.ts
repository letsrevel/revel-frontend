import { render, screen, act } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

vi.mock('$lib/api/client', () => ({ client: {} }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./custom-domain-api', async (importOriginal) => ({
	...(await importOriginal<typeof import('./custom-domain-api')>()),
	requestCustomDomain: vi.fn()
}));

import HostnameForm from './HostnameForm.svelte';
import { CustomDomainApiError, requestCustomDomain } from './custom-domain-api';
import { toast } from 'svelte-sonner';

function setup(componentProps: Record<string, unknown> = {}) {
	const user = userEvent.setup();
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: HostnameForm,
			componentProps: { slug: 'acme', ...componentProps }
		}
	});
	return user;
}

async function settle() {
	await act(async () => {
		await Promise.resolve();
	});
}

const input = () => screen.getByLabelText('Domain name') as HTMLInputElement;
const submit = () => screen.getByRole('button', { name: 'Connect domain' });

describe('HostnameForm (#1058)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('normalizes a pasted URL before sending', async () => {
		vi.mocked(requestCustomDomain).mockResolvedValue({
			hostname: 'events.example.com',
			status: 'pending',
			verification_records: [],
			cname_target: null,
			verified_at: null,
			errors: []
		});
		const onRequested = vi.fn();
		const user = setup({ onRequested });

		await user.type(input(), '  HTTPS://Events.Example.com/  ');
		await user.click(submit());

		expect(requestCustomDomain).toHaveBeenCalledWith('acme', 'events.example.com');
		await vi.waitFor(() => expect(onRequested).toHaveBeenCalled());
	});

	it('requires a value without calling the API', async () => {
		const user = setup();
		await user.click(submit());

		expect(requestCustomDomain).not.toHaveBeenCalled();
		expect(screen.getByText('Enter the domain name you want to use.')).toBeInTheDocument();
		expect(input()).toHaveAttribute('aria-invalid', 'true');
	});

	it('maps 400 errors.hostname onto the field, wired with aria-describedby', async () => {
		vi.mocked(requestCustomDomain).mockRejectedValue(
			new CustomDomainApiError('x', 400, ['Not a valid hostname.', 'Ports are not allowed.'])
		);
		const user = setup();

		await user.type(input(), 'bad_host:8080');
		await user.click(submit());
		await settle();

		expect(screen.getByText('Not a valid hostname.')).toBeInTheDocument();
		expect(screen.getByText('Ports are not allowed.')).toBeInTheDocument();
		expect(input()).toHaveAttribute('aria-invalid', 'true');
		const described = input().getAttribute('aria-describedby') ?? '';
		expect(described).toContain('custom-domain-hostname-errors');
		expect(described).toContain('custom-domain-hostname-help');
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(toast.error).not.toHaveBeenCalled();
	});

	it('clears the field errors when the user edits', async () => {
		vi.mocked(requestCustomDomain).mockRejectedValue(
			new CustomDomainApiError('x', 400, ['Not a valid hostname.'])
		);
		const user = setup();
		await user.type(input(), 'bad');
		await user.click(submit());
		await settle();
		expect(screen.getByText('Not a valid hostname.')).toBeInTheDocument();

		await vi.waitFor(() => expect(input()).toBeEnabled());
		await user.type(input(), 'x');
		await vi.waitFor(() =>
			expect(screen.queryByText('Not a valid hostname.')).not.toBeInTheDocument()
		);
		expect(screen.queryByText('Not a valid hostname.')).not.toBeInTheDocument();
	});

	it('shows a 409 detail in an alert', async () => {
		vi.mocked(requestCustomDomain).mockRejectedValue(
			new CustomDomainApiError('x', 409, [], 'This hostname is already in use.')
		);
		const user = setup();
		await user.type(input(), 'taken.example.com');
		await user.click(submit());
		await settle();

		expect(screen.getByRole('alert')).toHaveTextContent('This hostname is already in use.');
		expect(input()).not.toHaveAttribute('aria-invalid');
	});

	it('shows a 502 detail in an alert', async () => {
		vi.mocked(requestCustomDomain).mockRejectedValue(
			new CustomDomainApiError('x', 502, [], 'Upstream failure')
		);
		const user = setup();
		await user.type(input(), 'events.example.com');
		await user.click(submit());
		await settle();

		expect(screen.getByRole('alert')).toHaveTextContent('Upstream failure');
	});

	it('falls back to a generic message for unexpected errors', async () => {
		vi.mocked(requestCustomDomain).mockRejectedValue(new Error('network'));
		const user = setup();
		await user.type(input(), 'events.example.com');
		await user.click(submit());
		await settle();

		expect(screen.getByRole('alert')).toHaveTextContent("couldn't connect this domain");
	});
});
