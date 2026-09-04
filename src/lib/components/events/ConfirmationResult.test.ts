import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConfirmationResult from './ConfirmationResult.svelte';

const eventpublicdiscoveryConfirmGuestAction = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicdiscoveryConfirmGuestAction
}));

interface MockResult {
	data?: unknown;
	error?: unknown;
	response: { ok: boolean; status: number };
}

function errorResult(status: number, body: unknown): MockResult {
	return { data: undefined, error: body, response: { ok: false, status } };
}

// Prod incident 2026-09-04 ("Kitts Meets"): the client does NOT throw on
// non-2xx — it resolves with { error } and data undefined. Only checking
// `response.data` turned EVERY backend rejection (403 tier rule, 400
// eligibility, expired token, …) into the meaningless hard-coded
// "No data returned from confirmation".
describe('ConfirmationResult — backend rejections surface the real error', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders the backend detail for a 403 tier-access rejection', async () => {
		eventpublicdiscoveryConfirmGuestAction.mockResolvedValue(
			errorResult(403, { detail: 'You are not allowed to purchase from this tier.' })
		);
		render(ConfirmationResult, { props: { token: 'tok-403' } });

		expect(
			await screen.findByText('You are not allowed to purchase from this tier.')
		).toBeInTheDocument();
		expect(screen.queryByText(/no data returned from confirmation/i)).not.toBeInTheDocument();
	});

	it('renders the eligibility reason for a 400 { allowed: false, reason } body', async () => {
		eventpublicdiscoveryConfirmGuestAction.mockResolvedValue(
			errorResult(400, { allowed: false, reason: 'You must complete the questionnaire first.' })
		);
		render(ConfirmationResult, { props: { token: 'tok-400' } });

		expect(
			await screen.findByText('You must complete the questionnaire first.')
		).toBeInTheDocument();
		expect(screen.queryByText(/no data returned from confirmation/i)).not.toBeInTheDocument();
	});

	it('localizes a recognized backend message (expired token)', async () => {
		eventpublicdiscoveryConfirmGuestAction.mockResolvedValue(
			errorResult(400, { detail: 'This token has expired' })
		);
		render(ConfirmationResult, { props: { token: 'tok-expired' } });

		expect(
			await screen.findByText('This confirmation link has expired. Please request a new one.')
		).toBeInTheDocument();
	});

	it('keeps the no-data message only for a truly empty 2xx response', async () => {
		eventpublicdiscoveryConfirmGuestAction.mockResolvedValue({
			data: undefined,
			error: undefined,
			response: { ok: true, status: 200 }
		});
		render(ConfirmationResult, { props: { token: 'tok-empty' } });

		// Appears in both the visible alert and the sr-only live region.
		expect(
			(await screen.findAllByText(/no data returned from confirmation/i)).length
		).toBeGreaterThan(0);
	});
});
