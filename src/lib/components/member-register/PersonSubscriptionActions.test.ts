import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type {
	MembershipRecordSchema,
	OrganizationAdminDetailSchema
} from '$lib/api/generated/types.gen';
import { makeRecord, makeUnlinked } from './person-fixtures';
import { sheetStateFor } from '$lib/member-register/person-target';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_API_URL: '' } }));
vi.mock('$lib/api/client', () => ({ client: {} }));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));

const periods = vi.hoisted(() => ({ list: vi.fn(), merged: vi.fn() }));
vi.mock('$lib/member-register/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/member-register/api')>()),
	listPersonPeriods: periods.list,
	listMergedInto: periods.merged
}));

const sdk = vi.hoisted(() => ({
	getMember: vi.fn(),
	getRecordNote: vi.fn(),
	getSub: vi.fn(),
	listPayments: vi.fn(),
	listPlans: vi.fn(),
	listMembers: vi.fn()
}));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminmembersGetMember: sdk.getMember,
	organizationadminmembersListMembers: sdk.listMembers,
	organizationadminusernotesGetRecordNote: sdk.getRecordNote,
	organizationadminsubscriptionsGetSubscription: sdk.getSub,
	organizationadminsubscriptionsListSubscriptionPayments: sdk.listPayments,
	organizationadminsubscriptionsListOrganizationPlans: sdk.listPlans
}));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import PersonSheet from './PersonSheet.svelte';

const organization = {
	id: 'org-1',
	slug: 'acme',
	name: 'Acme'
} as unknown as OrganizationAdminDetailSchema;

const baseMember = {
	status: 'active',
	tier: { id: 't1', name: 'Gold' },
	member_since: '2026-01-01T00:00:00Z',
	subscription: null,
	tier_locked_by_subscription: false,
	subscription_id: null,
	user: { id: 'u1', email: 'ada@example.org', first_name: 'Ada', last_name: 'Rossi' }
};

const ok = <T>(data: T) => ({ data, error: undefined, response: { status: 200 } });

function renderSheet(
	record: MembershipRecordSchema,
	extra: { canManageSubscriptions?: boolean; withOrg?: boolean } = {}
) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: PersonSheet as never,
			componentProps: {
				sheet: sheetStateFor(record),
				rows: [record],
				slug: 'acme',
				accessToken: 'tok',
				tiers: [],
				staffUserIds: new Set<string>(),
				isOwner: true,
				canOpenPayments: false,
				organization: extra.withOrg === false ? null : organization,
				canManageSubscriptions: extra.canManageSubscriptions ?? true,
				onClose: vi.fn(),
				onOpenRecord: vi.fn(),
				onEdit: vi.fn(),
				onEnd: vi.fn(),
				onDelete: vi.fn(),
				onInvite: vi.fn(),
				onUnlink: vi.fn(),
				onOpenPayments: vi.fn()
			}
		}
	});
}

beforeEach(() => {
	document.body.style.pointerEvents = '';
	periods.list.mockReset().mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
	periods.merged
		.mockReset()
		.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
	sdk.getMember.mockReset().mockResolvedValue(ok(baseMember));
	sdk.listMembers.mockReset();
	sdk.getRecordNote
		.mockReset()
		.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
	sdk.getSub.mockReset().mockResolvedValue(new Promise(() => undefined));
	sdk.listPayments.mockReset().mockResolvedValue(ok({ results: [], count: 0 }));
	sdk.listPlans.mockReset().mockResolvedValue(ok([]));
});

describe('person sheet subscription button', () => {
	it('reads "Manage subscription" when the member has a live subscription', async () => {
		sdk.getMember.mockResolvedValue(ok({ ...baseMember, subscription_id: 'sub-9' }));
		renderSheet(makeRecord());
		expect(await screen.findByRole('button', { name: 'Manage subscription' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Add subscription' })).not.toBeInTheDocument();
	});

	it('reads "Add subscription" when there is none', async () => {
		renderSheet(makeRecord());
		expect(await screen.findByRole('button', { name: 'Add subscription' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Manage subscription' })).not.toBeInTheDocument();
	});

	it('sits next to "Manage membership"', async () => {
		renderSheet(makeRecord());
		const manage = await screen.findByTestId('person-manage-membership');
		const add = await screen.findByTestId('person-manage-subscription');
		expect(manage.parentElement).toBe(add.parentElement);
	});

	it('is hidden from viewers without manage_subscriptions', async () => {
		sdk.getMember.mockResolvedValue(ok({ ...baseMember, subscription_id: 'sub-9' }));
		renderSheet(makeRecord(), { canManageSubscriptions: false });
		const manage = await screen.findByTestId('person-manage-membership');
		await waitFor(() => expect(manage).toBeEnabled());
		expect(screen.queryByTestId('person-manage-subscription')).not.toBeInTheDocument();
	});

	it('is hidden without the organization (nothing to open it against)', async () => {
		renderSheet(makeRecord(), { withOrg: false });
		const manage = await screen.findByTestId('person-manage-membership');
		await waitFor(() => expect(manage).toBeEnabled());
		expect(screen.queryByTestId('person-manage-subscription')).not.toBeInTheDocument();
	});

	it('is hidden for an account-less register entry', async () => {
		renderSheet(makeUnlinked());
		await screen.findByTestId('person-register-actions');
		expect(screen.queryByTestId('person-manage-subscription')).not.toBeInTheDocument();
	});

	it('Manage opens the subscription drawer for that subscription', async () => {
		sdk.getMember.mockResolvedValue(ok({ ...baseMember, subscription_id: 'sub-9' }));
		renderSheet(makeRecord());
		await userEvent.click(await screen.findByRole('button', { name: 'Manage subscription' }));
		await waitFor(() =>
			expect(sdk.getSub).toHaveBeenCalledWith(
				expect.objectContaining({ path: { slug: 'acme', sub_id: 'sub-9' } })
			)
		);
	});

	it('Add opens the create modal with the member preselected and no member picker', async () => {
		renderSheet(makeRecord());
		await userEvent.click(await screen.findByRole('button', { name: 'Add subscription' }));
		const dialogs = await screen.findAllByRole('dialog');
		const create = dialogs.find((d) => within(d).queryByTestId('subscription-fixed-member'));
		expect(create).toBeDefined();
		expect(
			within(create as HTMLElement).getByTestId('subscription-fixed-member')
		).toHaveTextContent('Ada Rossi');
		// The only combobox left is the plan select: the member picker is gone.
		expect(within(create as HTMLElement).getAllByRole('combobox')).toHaveLength(1);
		expect(within(create as HTMLElement).getByLabelText('Plan')).toBeInTheDocument();
	});
});
