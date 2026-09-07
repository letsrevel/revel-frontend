import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import AccountPicker from './AccountPicker.svelte';
import {
	organizationintegrationsAccounts,
	organizationintegrationsSelectAccount
} from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	organizationintegrationsAccounts: vi.fn(),
	organizationintegrationsSelectAccount: vi.fn()
}));

type AccountsResult = Awaited<ReturnType<typeof organizationintegrationsAccounts>>;
type SelectResult = Awaited<ReturnType<typeof organizationintegrationsSelectAccount>>;

function renderPicker(onSelected = vi.fn()) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: AccountPicker,
			componentProps: {
				organizationSlug: 'acme',
				provider: 'eventbrite',
				platform: 'Eventbrite',
				onSelected
			}
		}
	});
	return { onSelected };
}

describe('AccountPicker', () => {
	beforeEach(() => {
		vi.mocked(organizationintegrationsAccounts).mockResolvedValue({
			data: [
				{ remote_id: 'a1', name: 'Acme Events' },
				{ remote_id: 'b2', name: 'Acme Workshops' }
			],
			error: undefined,
			response: { ok: true } as Response
		} as unknown as AccountsResult);
		vi.mocked(organizationintegrationsSelectAccount).mockResolvedValue({
			data: { provider: 'eventbrite', display_name: 'Eventbrite', status: 'active' },
			error: undefined,
			response: { ok: true } as Response
		} as unknown as SelectResult);
	});

	it('lists the accounts as radios and submits the chosen one', async () => {
		const user = userEvent.setup();
		const { onSelected } = renderPicker();

		await waitFor(() => expect(screen.getByLabelText('Acme Workshops')).toBeInTheDocument());
		const submit = screen.getByRole('button', { name: 'Use this account' });
		expect(submit).toBeDisabled();

		await user.click(screen.getByLabelText('Acme Workshops'));
		await waitFor(() => expect(submit).toBeEnabled());
		await user.click(submit);

		await waitFor(() => expect(onSelected).toHaveBeenCalled());
		expect(vi.mocked(organizationintegrationsSelectAccount)).toHaveBeenCalledWith(
			expect.objectContaining({
				path: { slug: 'acme', provider: 'eventbrite' },
				body: { remote_id: 'b2' }
			})
		);
	});

	it('explains an empty account list', async () => {
		vi.mocked(organizationintegrationsAccounts).mockResolvedValue({
			data: [],
			error: undefined,
			response: { ok: true } as Response
		} as unknown as AccountsResult);
		renderPicker();
		await waitFor(() => expect(screen.getByText(/returned no accounts/)).toBeInTheDocument());
	});

	it('shows the mapped error when selecting fails', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationintegrationsSelectAccount).mockResolvedValue({
			data: undefined,
			error: { detail: 'x', code: 'account_unknown', provider_message: null },
			response: { ok: false } as Response
		} as unknown as SelectResult);
		renderPicker();
		await waitFor(() => expect(screen.getByLabelText('Acme Events')).toBeInTheDocument());
		await user.click(screen.getByLabelText('Acme Events'));
		await user.click(screen.getByRole('button', { name: 'Use this account' }));
		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('no longer offered by Eventbrite')
		);
	});

	it('shows the mapped error when the account list cannot be loaded', async () => {
		vi.mocked(organizationintegrationsAccounts).mockResolvedValue({
			data: undefined,
			error: { detail: 'x', code: 'connection_pending', provider_message: null },
			response: { ok: false } as Response
		} as unknown as AccountsResult);
		renderPicker();
		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('no account choice waiting')
		);
	});
});
