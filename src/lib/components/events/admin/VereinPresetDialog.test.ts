import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import {
	eventadminticketsCreateTicketTier,
	organizationadminmembersCreateMembershipTier,
	organizationadminmembersListMembershipTiers,
	questionnaireAssignEvent,
	questionnaireCreateOrgQuestionnaire
} from '$lib/api/generated/sdk.gen';
import type { MembershipTierSchema } from '$lib/api/generated/types.gen';
import VereinPresetDialog from './VereinPresetDialog.svelte';
import { forgetVereinRun } from './verein-preset-state';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventadminticketsCreateTicketTier: vi.fn(),
	organizationadminmembersCreateMembershipTier: vi.fn(),
	organizationadminmembersListMembershipTiers: vi.fn(),
	questionnaireAssignEvent: vi.fn(),
	questionnaireCreateOrgQuestionnaire: vi.fn()
}));

const ok = <T>(data: T) => ({ data, error: undefined });

function allOk() {
	vi.mocked(organizationadminmembersCreateMembershipTier).mockResolvedValue(
		ok({ id: 'day-1' }) as never
	);
	vi.mocked(questionnaireCreateOrgQuestionnaire).mockResolvedValue(ok({ id: 'q-1' }) as never);
	vi.mocked(questionnaireAssignEvent).mockResolvedValue(ok({}) as never);
	vi.mocked(eventadminticketsCreateTicketTier).mockResolvedValue(ok({ id: 't' }) as never);
}

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
	beforeEach(() => {
		vi.clearAllMocks();
		forgetVereinRun('evt-1');
	});

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

	function propsWith(extra: Record<string, unknown>) {
		return {
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
				...extra
			}
		};
	}

	it('keeps the success state when the dayTiers prop updates after a run', async () => {
		allOk();
		const view = renderDialog();
		await userEvent.click(screen.getByTestId('verein-preset-confirm'));
		await screen.findByTestId('verein-preset-success');

		await view.rerender(
			propsWith({ dayTiers: [{ id: 'day-1', name: 'Day membership', kind: 'temporary' }] })
		);

		expect(screen.getByTestId('verein-preset-success')).toBeInTheDocument();
		expect(screen.queryByTestId('verein-preset-confirm')).not.toBeInTheDocument();
		expect(organizationadminmembersCreateMembershipTier).toHaveBeenCalledTimes(1);
	});

	it('keeps typed fields when the dayTiers prop updates before a run', async () => {
		const view = renderDialog();
		const inputs = screen.getAllByRole('textbox');
		await userEvent.clear(inputs[1]);
		await userEvent.type(inputs[1], 'My public ticket');
		await view.rerender(
			propsWith({ dayTiers: [{ id: 'day-1', name: 'Day membership', kind: 'temporary' }] })
		);
		expect((screen.getAllByRole('textbox')[1] as HTMLInputElement).value).toBe('My public ticket');
	});

	it('waits for the existing tiers before confirming', () => {
		renderDialog({ dayTiersStatus: 'pending' });
		expect(screen.getByTestId('verein-tiers-loading').textContent).toMatch(
			/Checking your existing day-membership tiers/
		);
		expect(screen.getByTestId('verein-preset-confirm')).toBeDisabled();
	});

	it('shows a retry instead of defaulting to create when the tiers failed to load', async () => {
		const onRetryDayTiers = vi.fn();
		renderDialog({ dayTiersStatus: 'error', onRetryDayTiers });
		expect(screen.getByTestId('verein-tiers-error')).toBeInTheDocument();
		expect(screen.getByTestId('verein-preset-confirm')).toBeDisabled();
		await userEvent.click(screen.getByRole('button', { name: /try again/i }));
		expect(onRetryDayTiers).toHaveBeenCalledTimes(1);
	});

	it('explains why card payment is unavailable', () => {
		renderDialog({ canChargeOnline: false, onlineReason: 'Stripe is not connected.' });
		expect(screen.getByTestId('verein-preset-online-reason').textContent).toMatch(
			/Card payment isn.t available yet: Stripe is not connected\./
		);
	});

	it('marks each offending field and describes it', async () => {
		renderDialog();
		const price = screen.getAllByRole('textbox')[2] as HTMLInputElement;
		await userEvent.clear(price);
		await userEvent.type(price, 'abc');
		expect(price).toHaveAttribute('aria-invalid', 'true');
		const describedBy = price.getAttribute('aria-describedby') ?? '';
		expect(document.getElementById(describedBy)?.textContent).toMatch(/price like 25 or 25.50/);
		expect(screen.getByTestId('verein-preset-issues').textContent).toMatch(/price like 25/);
		const name = screen.getAllByRole('textbox')[1];
		expect(name).not.toHaveAttribute('aria-invalid');
	});

	it('remembers a partial run when closed and reopened, and retries only what is left', async () => {
		vi.mocked(organizationadminmembersCreateMembershipTier).mockResolvedValue(
			ok({ id: 'day-1' }) as never
		);
		vi.mocked(questionnaireCreateOrgQuestionnaire).mockResolvedValue(ok({ id: 'q-1' }) as never);
		vi.mocked(questionnaireAssignEvent)
			.mockResolvedValueOnce({ data: undefined, error: { detail: 'Boom' } } as never)
			.mockResolvedValueOnce(ok({}) as never);
		vi.mocked(eventadminticketsCreateTicketTier).mockResolvedValue(ok({ id: 't' }) as never);

		const view = renderDialog();
		await userEvent.click(screen.getByTestId('verein-preset-confirm'));
		await screen.findByTestId('verein-preset-failure');

		await view.rerender(propsWith({ open: false }));
		await view.rerender(propsWith({ open: true }));

		expect(screen.getByTestId('verein-preset-restored')).toBeInTheDocument();
		expect(screen.getByTestId('verein-step-dayTier').textContent).toMatch(/Done/);
		expect(screen.queryByTestId('verein-preset-confirm')).not.toBeInTheDocument();

		await userEvent.click(screen.getByTestId('verein-preset-retry'));
		await screen.findByTestId('verein-preset-success');
		expect(organizationadminmembersCreateMembershipTier).toHaveBeenCalledTimes(1);
		expect(questionnaireCreateOrgQuestionnaire).toHaveBeenCalledTimes(1);
	});

	it('starts over only after confirmation', async () => {
		vi.mocked(organizationadminmembersCreateMembershipTier).mockResolvedValue(
			ok({ id: 'day-1' }) as never
		);
		vi.mocked(questionnaireCreateOrgQuestionnaire).mockResolvedValue({
			data: undefined,
			error: { detail: 'Boom' }
		} as never);
		const view = renderDialog();
		await userEvent.click(screen.getByTestId('verein-preset-confirm'));
		await screen.findByTestId('verein-preset-failure');

		await view.rerender(propsWith({ open: false }));
		await view.rerender(propsWith({ open: true }));

		await userEvent.click(screen.getByTestId('verein-preset-reset'));
		expect(screen.getByTestId('verein-preset-reset-confirm')).toBeInTheDocument();
		expect(screen.queryByTestId('verein-preset-confirm')).not.toBeInTheDocument();

		await userEvent.click(screen.getByTestId('verein-preset-reset-yes'));
		expect(screen.getByTestId('verein-preset-confirm')).toBeInTheDocument();
	});

	it('looks up the entity by name before retrying a step that failed ambiguously', async () => {
		vi.mocked(organizationadminmembersCreateMembershipTier).mockRejectedValueOnce(
			new Error('offline')
		);
		vi.mocked(organizationadminmembersListMembershipTiers).mockResolvedValue(
			ok([{ id: 'day-found', name: 'Day membership' }]) as never
		);
		vi.mocked(questionnaireCreateOrgQuestionnaire).mockResolvedValue(ok({ id: 'q-1' }) as never);
		vi.mocked(questionnaireAssignEvent).mockResolvedValue(ok({}) as never);
		vi.mocked(eventadminticketsCreateTicketTier).mockResolvedValue(ok({ id: 't' }) as never);

		renderDialog();
		await userEvent.click(screen.getByTestId('verein-preset-confirm'));
		await userEvent.click(await screen.findByTestId('verein-preset-retry'));
		await screen.findByTestId('verein-preset-success');
		expect(organizationadminmembersCreateMembershipTier).toHaveBeenCalledTimes(1);
	});
});
