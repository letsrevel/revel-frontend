import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import {
	eventadminticketsCreateTicketTier,
	organizationadminmembersCreateMembershipTier,
	questionnaireAssignEvent,
	questionnaireCreateOrgQuestionnaire
} from '$lib/api/generated/sdk.gen';
import type { MembershipTierSchema } from '$lib/api/generated/types.gen';
import VereinPresetDialog from './VereinPresetDialog.svelte';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventadminticketsCreateTicketTier: vi.fn(),
	organizationadminmembersCreateMembershipTier: vi.fn(),
	questionnaireAssignEvent: vi.fn(),
	questionnaireCreateOrgQuestionnaire: vi.fn()
}));

const ok = <T>(data: T) => ({ data, error: undefined });

function renderDialog(props: Record<string, unknown> = {}) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: VereinPresetDialog,
			componentProps: {
				open: true,
				eventId: 'evt-1',
				organizationId: 'org-1',
				organizationSlug: 'verein',
				dayTiers: [] as MembershipTierSchema[],
				currency: 'EUR',
				canChargeOnline: true,
				orgVat: null,
				...props
			}
		}
	});
}

describe('VereinPresetDialog', () => {
	beforeEach(() => vi.clearAllMocks());

	it('previews exactly what will be created before anything runs', () => {
		renderDialog();
		const preview = screen.getByTestId('verein-preset-preview');
		const items = Array.from(preview.querySelectorAll('li')).map((li) => li.textContent ?? '');
		expect(items).toHaveLength(5);
		expect(items[0]).toContain('Day membership');
		expect(items[3]).toMatch(/25/);
		expect(items[4]).toMatch(/20/);
		expect(items[4]).toMatch(/members only/i);
		expect(questionnaireCreateOrgQuestionnaire).not.toHaveBeenCalled();
	});

	it('previews the non-members audience when picked', async () => {
		renderDialog();
		await userEvent.click(screen.getByRole('radio', { name: /not members/i }));
		const items = screen.getByTestId('verein-preset-preview').querySelectorAll('li');
		expect(items[3].textContent).toMatch(/non-members only/i);
	});

	it('lets the user reuse an existing day tier and drops the create step', () => {
		renderDialog({ dayTiers: [{ id: 'day-9', name: 'Gast', kind: 'temporary' }] });
		const items = screen.getByTestId('verein-preset-preview').querySelectorAll('li');
		expect(items).toHaveLength(5);
		expect(items[0].textContent).toContain('Gast');
		expect(items[0].textContent).toMatch(/nothing new/i);
	});

	it('blocks the confirm button when paid tiers cannot be charged', () => {
		renderDialog({ canChargeOnline: false });
		expect(screen.getByTestId('verein-preset-online-blocked')).toBeInTheDocument();
		expect(screen.getByTestId('verein-preset-confirm')).toBeDisabled();
	});

	it('reports what was created when a step fails, and offers to open it', async () => {
		vi.mocked(organizationadminmembersCreateMembershipTier).mockResolvedValue(
			ok({ id: 'day-1' }) as never
		);
		vi.mocked(questionnaireCreateOrgQuestionnaire).mockResolvedValue(ok({ id: 'q-1' }) as never);
		vi.mocked(questionnaireAssignEvent).mockResolvedValue({
			data: undefined,
			error: { detail: 'Event not found' }
		} as never);

		renderDialog();
		await userEvent.click(screen.getByTestId('verein-preset-confirm'));

		const failure = await screen.findByTestId('verein-preset-failure');
		expect(failure.textContent).toMatch(/Attach questionnaire to event/);
		expect(failure.textContent).toMatch(/still there/i);
		expect(screen.getByTestId('verein-step-dayTier').textContent).toMatch(/Done/);
		expect(screen.getByTestId('verein-step-questionnaire').textContent).toMatch(/Done/);
		expect(screen.getByTestId('verein-step-assign').textContent).toMatch(/Event not found/);
		expect(screen.getByTestId('verein-step-publicTier').textContent).toMatch(/Waiting/);
		expect(screen.getByRole('link', { name: /Open the membership tiers/i })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Open the questionnaire/i })).toHaveAttribute(
			'href',
			expect.stringContaining('/questionnaires/q-1')
		);
		expect(eventadminticketsCreateTicketTier).not.toHaveBeenCalled();
	});

	it('retries only the remaining steps', async () => {
		vi.mocked(organizationadminmembersCreateMembershipTier).mockResolvedValue(
			ok({ id: 'day-1' }) as never
		);
		vi.mocked(questionnaireCreateOrgQuestionnaire).mockResolvedValue(ok({ id: 'q-1' }) as never);
		vi.mocked(questionnaireAssignEvent)
			.mockResolvedValueOnce({ data: undefined, error: { detail: 'Boom' } } as never)
			.mockResolvedValueOnce(ok({}) as never);
		vi.mocked(eventadminticketsCreateTicketTier).mockResolvedValue(ok({ id: 't' }) as never);

		renderDialog();
		await userEvent.click(screen.getByTestId('verein-preset-confirm'));
		await userEvent.click(await screen.findByTestId('verein-preset-retry'));

		await waitFor(() => expect(screen.getByTestId('verein-preset-success')).toBeInTheDocument());
		expect(organizationadminmembersCreateMembershipTier).toHaveBeenCalledTimes(1);
		expect(questionnaireCreateOrgQuestionnaire).toHaveBeenCalledTimes(1);
		expect(questionnaireAssignEvent).toHaveBeenCalledTimes(2);
		expect(eventadminticketsCreateTicketTier).toHaveBeenCalledTimes(2);
	});

	it('says plainly when the very first step fails and nothing exists', async () => {
		vi.mocked(organizationadminmembersCreateMembershipTier).mockResolvedValue({
			data: undefined,
			error: { detail: 'Forbidden' }
		} as never);
		renderDialog();
		await userEvent.click(screen.getByTestId('verein-preset-confirm'));
		const failure = await screen.findByTestId('verein-preset-failure');
		expect(failure.textContent).toMatch(/Nothing was created/i);
		expect(screen.queryByRole('link', { name: /Open the questionnaire/i })).not.toBeInTheDocument();
	});
});
