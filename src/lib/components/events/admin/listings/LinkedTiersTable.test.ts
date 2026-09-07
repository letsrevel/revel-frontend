import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import LinkedTiersTable from './LinkedTiersTable.svelte';
import type { EventLinkSchema, TierLinkSchema } from '$lib/api/generated/types.gen';
import { eventintegrationsPause, eventintegrationsResume } from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	eventintegrationsPause: vi.fn(),
	eventintegrationsResume: vi.fn()
}));

type PauseResult = Awaited<ReturnType<typeof eventintegrationsPause>>;

function tierLink(overrides: Partial<TierLinkSchema> = {}): TierLinkSchema {
	return {
		tier_id: 't1',
		tier_name: 'General',
		remote_id: 'tc-1',
		remote_quantity_sold: 17,
		counts_updated_at: new Date(Date.now() - 3 * 60_000).toISOString(),
		remote_paused: false,
		...overrides
	};
}

function link(tiers: TierLinkSchema[]): EventLinkSchema {
	return {
		provider: 'eventbrite',
		display_name: 'Eventbrite',
		remote_id: 'ev-1',
		remote_url: 'https://www.eventbrite.com/e/ev-1',
		remote_status: 'live',
		sync_state: 'in_sync',
		origin: 'pushed',
		auto_sync: null,
		effective_auto_sync: false,
		sync_report: [],
		tiers
	};
}

function ok(data: unknown) {
	return { data, error: undefined, response: { ok: true } as Response } as unknown as PauseResult;
}

function renderTable(
	tiers: TierLinkSchema[],
	revelTiers: { id: string; sales_paused?: boolean }[] = []
) {
	const onChanged = vi.fn();
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: LinkedTiersTable,
			componentProps: {
				eventId: 'event-1',
				provider: 'eventbrite',
				platform: 'Eventbrite',
				link: link(tiers),
				tiers: revelTiers,
				onChanged
			}
		}
	});
	return { onChanged };
}

describe('LinkedTiersTable', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		const l = link([tierLink({ remote_paused: true })]);
		vi.mocked(eventintegrationsPause).mockResolvedValue(
			ok({ paused: true, updated: ['t1'], failed: [], link: l })
		);
		vi.mocked(eventintegrationsResume).mockResolvedValue(
			ok({ paused: false, updated: ['t1'], failed: [], link: l })
		);
	});

	it('shows sold counts with their freshness and the on-sale state', () => {
		renderTable([
			tierLink(),
			tierLink({
				tier_id: 't2',
				tier_name: 'VIP',
				remote_quantity_sold: 3,
				counts_updated_at: null
			})
		]);
		expect(screen.getByText('17')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();
		expect(screen.getByText(/updated .*ago/)).toBeInTheDocument();
		expect(screen.getByText('not yet')).toBeInTheDocument();
		expect(screen.getAllByText('On sale')).toHaveLength(2);
	});

	it('pauses one ticket by id and reports the change', async () => {
		const user = userEvent.setup();
		const { onChanged } = renderTable([tierLink()]);
		await user.click(screen.getByRole('button', { name: 'Pause General on Eventbrite' }));
		await waitFor(() =>
			expect(vi.mocked(eventintegrationsPause)).toHaveBeenCalledWith(
				expect.objectContaining({
					path: { event_id: 'event-1', provider: 'eventbrite' },
					body: { tier_id: 't1' }
				})
			)
		);
		await waitFor(() => expect(onChanged).toHaveBeenCalled());
	});

	it('pauses every ticket with no body from the header action', async () => {
		const user = userEvent.setup();
		renderTable([tierLink(), tierLink({ tier_id: 't2', tier_name: 'VIP' })]);
		await user.click(screen.getByRole('button', { name: 'Pause all on Eventbrite' }));
		await waitFor(() => expect(vi.mocked(eventintegrationsPause)).toHaveBeenCalled());
		const call = vi.mocked(eventintegrationsPause).mock.calls.at(-1)?.[0] as { body?: unknown };
		expect(call.body).toBeUndefined();
	});

	it('offers Resume all when every ticket is paused', () => {
		renderTable([
			tierLink({ remote_paused: true }),
			tierLink({ tier_id: 't2', remote_paused: true })
		]);
		expect(screen.getByRole('button', { name: 'Resume all on Eventbrite' })).toBeInTheDocument();
	});

	it('shows a per-ticket failure under its row', async () => {
		const user = userEvent.setup();
		vi.mocked(eventintegrationsPause).mockResolvedValue(
			ok({
				paused: true,
				updated: [],
				failed: [
					{
						tier_id: 't1',
						tier_name: 'General',
						code: 'pause_failed',
						detail: 'x',
						provider_message: 'nope'
					}
				],
				link: link([tierLink()])
			})
		);
		renderTable([tierLink()]);
		await user.click(screen.getByRole('button', { name: 'Pause General on Eventbrite' }));
		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('Eventbrite did not change this ticket.')
		);
		expect(screen.getByText('nope')).toBeInTheDocument();
	});

	it('explains a ticket hidden by a Revel pause and disables Resume for it', () => {
		renderTable([tierLink({ remote_paused: true })], [{ id: 't1', sales_paused: true }]);
		expect(screen.getByText(/while sales are paused on Revel/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Resume General on Eventbrite' })).toBeDisabled();
	});

	it('carries the promo-code caveat', () => {
		renderTable([tierLink()]);
		expect(screen.getByText(/promo code/)).toBeInTheDocument();
	});
});
