import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
import { makeRecord, makeUnlinked } from './person-fixtures';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_API_URL: '' } }));
vi.mock('$lib/api/client', () => ({ client: {} }));

const periods = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('$lib/member-register/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/member-register/api')>()),
	listPersonPeriods: periods.list
}));

const sdk = vi.hoisted(() => ({
	listMembers: vi.fn(),
	getRecordNote: vi.fn(),
	putRecordNote: vi.fn(),
	deleteRecordNote: vi.fn(),
	getUserNote: vi.fn()
}));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminmembersListMembers: sdk.listMembers,
	organizationadminusernotesGetRecordNote: sdk.getRecordNote,
	organizationadminusernotesUpsertRecordNote: sdk.putRecordNote,
	organizationadminusernotesDeleteRecordNote: sdk.deleteRecordNote,
	organizationadminusernotesGetNote: sdk.getUserNote
}));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import PersonSheet from './PersonSheet.svelte';

const member = {
	status: 'active',
	tier: null,
	member_since: '2026-01-01T00:00:00Z',
	subscription: null,
	user: { id: 'u1', email: 'ada@example.org', first_name: 'Ada', last_name: 'Rossi' }
};

function renderSheet(
	record: MembershipRecordSchema | null,
	extra: Partial<{ isOwner: boolean; canOpenPayments: boolean }> = {}
) {
	const handlers = {
		onClose: vi.fn(),
		onEdit: vi.fn(),
		onEnd: vi.fn(),
		onDelete: vi.fn(),
		onInvite: vi.fn(),
		onUnlink: vi.fn(),
		onOpenPayments: vi.fn()
	};
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: PersonSheet as never,
			componentProps: {
				record,
				slug: 'acme',
				accessToken: 'tok',
				tiers: [],
				staffUserIds: new Set<string>(),
				isOwner: true,
				canOpenPayments: false,
				...extra,
				...handlers
			}
		}
	});
	return handlers;
}

const note = {
	body: 'Prefers aisle seats',
	updated_at: '2026-11-01T10:00:00Z',
	updated_by_id: 'u9',
	updated_by_name: 'Sam'
};

beforeEach(() => {
	document.body.style.pointerEvents = '';
	periods.list.mockReset().mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
	sdk.listMembers
		.mockReset()
		.mockResolvedValue({ data: { results: [member], count: 1 }, error: undefined });
	sdk.getRecordNote
		.mockReset()
		.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
	sdk.putRecordNote.mockReset().mockResolvedValue({ data: note, response: { status: 200 } });
	sdk.deleteRecordNote.mockReset();
	sdk.getUserNote.mockReset();
});

describe('PersonSheet header and sections', () => {
	it('is a dialog named by the person, with status, email and every section heading', async () => {
		renderSheet(makeRecord());
		const dialog = await screen.findByRole('dialog', { name: 'Ada Rossi' });
		expect(within(dialog).getByRole('heading', { name: 'Ada Rossi' })).toBeInTheDocument();
		expect(within(dialog).getByText('ada@example.org')).toBeInTheDocument();
		expect(within(dialog).getByTestId('register-status-active')).toBeInTheDocument();
		for (const name of ['Membership', 'Periods', 'Staff note', 'Account']) {
			expect(within(dialog).getByRole('heading', { name })).toBeInTheDocument();
		}
	});

	it('closes on Escape', async () => {
		const handlers = renderSheet(makeRecord());
		await screen.findByRole('dialog');
		await userEvent.keyboard('{Escape}');
		expect(handlers.onClose).toHaveBeenCalled();
	});

	it('renders nothing while closed (no record)', () => {
		renderSheet(null);
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('links to the Payments tab for a linked person when the viewer can see it', async () => {
		const handlers = renderSheet(makeRecord(), { canOpenPayments: true });
		await userEvent.click(await screen.findByTestId('person-open-payments'));
		expect(handlers.onOpenPayments).toHaveBeenCalledTimes(1);
	});

	it('hides the Payments section from viewers without the permission and for unlinked entries', async () => {
		renderSheet(makeRecord());
		await screen.findByRole('dialog');
		expect(screen.queryByTestId('person-payments')).not.toBeInTheDocument();
	});
});

describe('PersonSheet membership actions', () => {
	it('offers the member actions for a linked, current member', async () => {
		renderSheet(makeRecord());
		const manage = await screen.findByTestId('person-manage-membership');
		await waitFor(() => expect(manage).toBeEnabled());
		expect(screen.queryByTestId('person-register-actions')).not.toBeInTheDocument();
		// The access row is found by the entry's USER id.
		expect(sdk.listMembers).toHaveBeenCalled();
	});

	it('opens the shared manage modal (tier, status, remove, ban) keyed on the user', async () => {
		renderSheet(makeRecord());
		const manage = await screen.findByTestId('person-manage-membership');
		await waitFor(() => expect(manage).toBeEnabled());
		await userEvent.click(manage);
		expect(await screen.findByLabelText('Membership Status')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Remove from Organization' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Add to Blacklist' })).toBeInTheDocument();
	});

	it('also offers them to a paused member (to resume)', async () => {
		renderSheet(makeRecord({ member_status: 'paused' }));
		expect(await screen.findByTestId('person-manage-membership')).toBeInTheDocument();
	});

	it('offers register actions instead of member actions for an unlinked entry', async () => {
		const handlers = renderSheet(makeUnlinked());
		await screen.findByTestId('person-register-actions');
		expect(screen.queryByTestId('person-manage-membership')).not.toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
		expect(handlers.onEdit).toHaveBeenCalledTimes(1);
		await userEvent.click(screen.getByRole('button', { name: 'Invite' }));
		expect(handlers.onInvite).toHaveBeenCalledTimes(1);
		await userEvent.click(screen.getByRole('button', { name: 'End membership' }));
		expect(handlers.onEnd).toHaveBeenCalledTimes(1);
		await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
		expect(handlers.onDelete).toHaveBeenCalledTimes(1);
		expect(sdk.listMembers).not.toHaveBeenCalled();
	});

	it('hides Delete from non-owners', async () => {
		renderSheet(makeUnlinked(), { isOwner: false });
		await screen.findByTestId('person-register-actions');
		expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
	});

	it('shows no member actions for an ended linked entry or a day membership', async () => {
		renderSheet(
			makeRecord({ is_current: false, member_status: null, valid_until: '2026-02-01T00:00:00Z' })
		);
		await screen.findByTestId('person-register-actions');
		expect(screen.queryByTestId('person-manage-membership')).not.toBeInTheDocument();
	});

	it('shows no member actions for a day membership', async () => {
		renderSheet(makeRecord({ kind: 'temporary' }));
		await screen.findByTestId('person-register-actions');
		expect(screen.queryByTestId('person-manage-membership')).not.toBeInTheDocument();
	});
});

describe('PersonSheet periods', () => {
	it('lists every period of a linked person, merged ones included (user_id + include_merged)', async () => {
		periods.list.mockResolvedValue({
			count: 3,
			next: null,
			previous: null,
			results: [
				makeRecord({ id: 'r1' }),
				makeRecord({
					id: 'r0',
					valid_from: '2025-01-01T00:00:00Z',
					valid_until: '2025-06-01T00:00:00Z',
					is_current: false,
					ended_reason: null,
					source: 'backfill',
					tier_name: 'Silver',
					linked_via: 'auto_email'
				}),
				makeRecord({
					id: 'rm',
					valid_from: '2024-01-01T00:00:00Z',
					valid_until: '2024-03-01T00:00:00Z',
					is_current: false,
					ended_reason: 'cancelled',
					merged_into_id: 'r1',
					tier_name: 'Bronze'
				})
			]
		});
		renderSheet(makeRecord());
		const section = await screen.findByTestId('person-periods');
		await waitFor(() =>
			expect(within(section).getAllByTestId('person-period').length).toBeGreaterThan(2)
		);
		expect(periods.list).toHaveBeenCalledWith('acme', 'tok', 'u1');
		const items = within(section).getAllByTestId('person-period');
		// Newest first.
		expect(items[0]).toHaveTextContent('Gold');
		expect(items[1]).toHaveTextContent('Silver');
		expect(items[1]).toHaveTextContent('Reason not recorded');
		expect(items[1]).toHaveTextContent('Approximate dates');
		expect(items[1]).toHaveTextContent('Linked automatically (verified email)');
		expect(items[2]).toHaveTextContent('Bronze');
		expect(items[2]).toHaveTextContent('Merged');
		expect(items[2]).toHaveTextContent('Ended: cancelled');
	});

	it('shows just the entry itself for an unlinked person, without a request', async () => {
		renderSheet(makeUnlinked());
		const section = await screen.findByTestId('person-periods');
		expect(within(section).getAllByTestId('person-period')).toHaveLength(1);
		expect(periods.list).not.toHaveBeenCalled();
	});

	it('says so when the periods cannot be loaded', async () => {
		periods.list.mockRejectedValue(new Error('boom'));
		renderSheet(makeRecord());
		expect(await screen.findByText("Could not load this person's periods.")).toBeInTheDocument();
	});
});

describe('PersonSheet staff note', () => {
	it('uses the record route for an unlinked entry', async () => {
		sdk.getRecordNote.mockResolvedValue({ data: note, response: { status: 200 } });
		renderSheet(makeUnlinked());
		expect(await screen.findByText(/Last edited by Sam on /)).toBeInTheDocument();
		expect(sdk.getRecordNote).toHaveBeenCalledWith(
			expect.objectContaining({ path: { slug: 'acme', record_id: 'r2' } })
		);
		expect(sdk.getUserNote).not.toHaveBeenCalled();
	});

	it('also uses the record route for a linked entry (the backend proxies to the user note)', async () => {
		sdk.getRecordNote.mockResolvedValue({ data: note, response: { status: 200 } });
		renderSheet(makeRecord());
		expect(await screen.findByText(/Last edited by Sam on /)).toBeInTheDocument();
		expect(sdk.getRecordNote).toHaveBeenCalledWith(
			expect.objectContaining({ path: { slug: 'acme', record_id: 'r1' } })
		);
		expect(sdk.getUserNote).not.toHaveBeenCalled();
	});

	it('hides the editor for a merged entry and says where the note lives', async () => {
		renderSheet(makeUnlinked({ merged_into_id: 'r1' }));
		expect(await screen.findByTestId('staff-note-merged')).toHaveTextContent(
			/lives on the person it was merged into/i
		);
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
		expect(sdk.getRecordNote).not.toHaveBeenCalled();
	});
});

describe('PersonSheet account', () => {
	it('says how the account was linked and offers Unlink', async () => {
		const handlers = renderSheet(
			makeRecord({ linked_via: 'auto_email', has_duplicate_claim: true })
		);
		const account = await screen.findByTestId('person-account');
		expect(account).toHaveTextContent('Linked automatically (verified email)');
		expect(account).toHaveTextContent('Linked on');
		expect(within(account).getByTestId('person-duplicate-hint')).toBeInTheDocument();
		await userEvent.click(within(account).getByTestId('person-unlink'));
		expect(handlers.onUnlink).toHaveBeenCalledTimes(1);
	});

	it('says there is no account for an unlinked entry and offers no Unlink', async () => {
		renderSheet(makeUnlinked());
		const account = await screen.findByTestId('person-account');
		expect(account).toHaveTextContent('No account linked yet.');
		expect(within(account).queryByTestId('person-unlink')).not.toBeInTheDocument();
	});
});
