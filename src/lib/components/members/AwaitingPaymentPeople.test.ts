import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type {
	OrganizationAdminDetailSchema,
	OrganizationMemberSchema
} from '$lib/api/generated/types.gen';

const sdk = vi.hoisted(() => ({ listMembers: vi.fn() }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminmembersListMembers: sdk.listMembers
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));
vi.mock('./SubscriptionDrawer.svelte', async () => ({
	default: (await import('$lib/test-utils/SubscriptionDrawerStub.svelte')).default
}));

import AwaitingPaymentPeople from './AwaitingPaymentPeople.svelte';

const organization = { id: 'o1', slug: 'acme' } as unknown as OrganizationAdminDetailSchema;

function member(id: string, name: string, subId: string | null): OrganizationMemberSchema {
	return {
		user: { id, display_name: name, email: `${id}@example.com`, bio: '' },
		member_since: '2026-11-01T00:00:00Z',
		status: 'awaiting_payment',
		tier: { id: 't1', name: 'Gold', kind: 'standard' },
		subscription_id: subId
	} as unknown as OrganizationMemberSchema;
}

function renderIt(canManageSubscriptions = true) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: AwaitingPaymentPeople,
			componentProps: { organization, canManageSubscriptions }
		}
	});
}

describe('AwaitingPaymentPeople', () => {
	beforeEach(() => {
		sdk.listMembers.mockReset();
	});

	it('asks the members list for awaiting_payment and renders one row per person', async () => {
		sdk.listMembers.mockResolvedValue({
			data: { count: 2, results: [member('u1', 'Ada', 's1'), member('u2', 'Bo', 's2')] }
		});
		renderIt();
		expect(await screen.findByText('Ada')).toBeInTheDocument();
		expect(screen.getByText('Bo')).toBeInTheDocument();
		expect(screen.getByText('u1@example.com')).toBeInTheDocument();
		expect(screen.getAllByText('Gold')).toHaveLength(2);
		expect(screen.getAllByText('Awaiting payment')).toHaveLength(2);
		expect(sdk.listMembers.mock.calls[0][0].query.status).toBe('awaiting_payment');
		expect(screen.getByRole('heading', { name: /Awaiting first payment/ })).toBeInTheDocument();
	});

	it('renders nothing when nobody is awaiting', async () => {
		sdk.listMembers.mockResolvedValue({ data: { count: 0, results: [] } });
		const { container } = renderIt();
		await waitFor(() => expect(sdk.listMembers).toHaveBeenCalled());
		await waitFor(() => expect(sdk.listMembers.mock.results[0].value).resolves.toBeDefined());
		expect(container.querySelector('section')).toBeNull();
	});

	it('fires no request and renders nothing without subscription rights', async () => {
		sdk.listMembers.mockResolvedValue({ data: { count: 1, results: [member('u1', 'Ada', 's1')] } });
		const { container } = renderIt(false);
		await new Promise((r) => setTimeout(r, 50));
		expect(sdk.listMembers).not.toHaveBeenCalled();
		expect(container.querySelector('section')).toBeNull();
	});

	it('uses the server count and notes truncation', async () => {
		sdk.listMembers.mockResolvedValue({
			data: { count: 130, results: [member('u1', 'Ada', 's1')] }
		});
		renderIt();
		expect(await screen.findByRole('heading', { name: /\(130\)/ })).toBeInTheDocument();
		expect(screen.getByText('Showing the first 1.')).toBeInTheDocument();
	});

	it('renders nothing and warns on error', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		sdk.listMembers.mockResolvedValue({ error: { detail: 'x' } });
		const { container } = renderIt();
		await waitFor(() => expect(warn).toHaveBeenCalled());
		expect(container.querySelector('section')).toBeNull();
		warn.mockRestore();
	});

	it('opens the drawer for the right subscription', async () => {
		sdk.listMembers.mockResolvedValue({
			data: { count: 2, results: [member('u1', 'Ada', 's1'), member('u2', 'Bo', 's2')] }
		});
		renderIt();
		await screen.findByText('Bo');
		await userEvent.click(screen.getByRole('button', { name: /Record payment.*Bo/ }));
		expect(await screen.findByTestId('drawer-stub')).toHaveTextContent('s2');
	});
});
