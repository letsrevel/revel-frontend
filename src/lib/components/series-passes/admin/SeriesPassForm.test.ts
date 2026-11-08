import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import SeriesPassForm from './SeriesPassForm.svelte';
import type { SeriesPassAdminSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api')>()),
	seriespassadminUpdateSeriesPass: vi.fn(),
	seriespassadminCreateSeriesPass: vi.fn(),
	eventadminticketsListTicketTiers: vi.fn()
}));
import { seriespassadminUpdateSeriesPass } from '$lib/api';

vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const pass = {
	id: 'pass-1',
	name: 'Season',
	description: null,
	price: '30.00',
	pro_rata_discount: '0',
	currency: 'EUR',
	payment_method: 'online',
	purchasable_by: 'public',
	visibility: 'public',
	sales_start_at: null,
	sales_end_at: null,
	total_quantity: null,
	tier_links: [],
	holder_count: 0
} as unknown as SeriesPassAdminSchema;

function renderForm(p: SeriesPassAdminSchema = pass) {
	const onClose = vi.fn();
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({
				defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
			}),
			component: SeriesPassForm,
			componentProps: {
				seriesId: 'series-1',
				accessToken: 'tok',
				pass: p,
				upcomingEvents: [],
				onClose
			}
		}
	});
	return { onClose };
}

describe('SeriesPassForm — non-members rule and stricter-link 400 (#1172)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('offers "Non-members only" and documents that it blocks all active members', async () => {
		renderForm();
		const select = screen.getByLabelText('Who can buy');
		expect(screen.getByRole('option', { name: 'Non-members only' })).toBeInTheDocument();

		await userEvent.selectOptions(select, 'non_members');

		const help = screen.getByTestId('pass-non-members-help');
		expect(help).toHaveTextContent('Blocks every active member');
		expect(help).toHaveTextContent('no tier-level exclusion');
		expect(select.getAttribute('aria-describedby')).toContain('pass-non-members-help');
	});

	it('saves non_members as the new rule', async () => {
		vi.mocked(seriespassadminUpdateSeriesPass).mockResolvedValue({
			data: { ...pass, purchasable_by: 'non_members' },
			error: undefined,
			response: { ok: true, status: 200 } as Response
		} as never);
		const { onClose } = renderForm();

		await userEvent.selectOptions(screen.getByLabelText('Who can buy'), 'non_members');
		await userEvent.click(screen.getByRole('button', { name: /save/i }));

		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(vi.mocked(seriespassadminUpdateSeriesPass).mock.calls[0][0].body).toMatchObject({
			purchasable_by: 'non_members'
		});
	});

	it('shows the 400 for a rule change that would strand a link beside the select, once', async () => {
		const message =
			'A covered tier has a stricter purchase rule; change the tier or unlink it first.';
		vi.mocked(seriespassadminUpdateSeriesPass).mockResolvedValue({
			data: undefined,
			error: { errors: { purchasable_by: [message] } },
			response: { ok: false, status: 400 } as Response
		} as never);
		const { onClose } = renderForm();

		await userEvent.selectOptions(screen.getByLabelText('Who can buy'), 'non_members');
		await userEvent.click(screen.getByRole('button', { name: /save/i }));

		const inline = await screen.findByTestId('pass-purchasable-by-error');
		expect(inline).toHaveTextContent(message);
		expect(screen.getByLabelText('Who can buy').getAttribute('aria-describedby')).toContain(
			inline.id
		);
		// Not duplicated in the form-level alert, and the dialog stays open.
		expect(screen.getAllByText(message)).toHaveLength(1);
		expect(onClose).not.toHaveBeenCalled();
	});

	it('still raises a non-field error at form level', async () => {
		vi.mocked(seriespassadminUpdateSeriesPass).mockResolvedValue({
			data: undefined,
			error: { detail: 'Something else went wrong.' },
			response: { ok: false, status: 400 } as Response
		} as never);
		renderForm();

		await userEvent.click(screen.getByRole('button', { name: /save/i }));

		expect(await screen.findByText('Something else went wrong.')).toBeInTheDocument();
	});
});
