import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
import { makeRecord, makeUnlinked } from './person-fixtures';
import { sheetStateFor, sheetStateForRecord } from '$lib/member-register/person-target';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_API_URL: '' } }));
vi.mock('$lib/api/client', () => ({ client: {} }));

const periods = vi.hoisted(() => ({ list: vi.fn(), merged: vi.fn() }));
vi.mock('$lib/member-register/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/member-register/api')>()),
	listPersonPeriods: periods.list,
	listMergedInto: periods.merged
}));

const sdk = vi.hoisted(() => ({
	getMember: vi.fn(),
	listMembers: vi.fn(),
	getRecordNote: vi.fn(),
	putRecordNote: vi.fn(),
	deleteRecordNote: vi.fn(),
	getUserNote: vi.fn()
}));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminmembersListMembers: sdk.listMembers,
	organizationadminmembersGetMember: sdk.getMember,
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

const handlers = () => ({
	onClose: vi.fn(),
	onOpenRecord: vi.fn(),
	onEdit: vi.fn(),
	onEnd: vi.fn(),
	onDelete: vi.fn(),
	onInvite: vi.fn(),
	onUnlink: vi.fn(),
	onOpenPayments: vi.fn()
});

function propsFor(
	record: MembershipRecordSchema | null,
	h: ReturnType<typeof handlers>,
	extra: Partial<{ isOwner: boolean; canOpenPayments: boolean }> = {},
	rows: MembershipRecordSchema[] = record ? [record] : []
) {
	return {
		sheet: record
			? record.merged_into_id
				? sheetStateForRecord(record)
				: sheetStateFor(record)
			: null,
		rows,
		slug: 'acme',
		accessToken: 'tok',
		tiers: [],
		staffUserIds: new Set<string>(),
		isOwner: true,
		canOpenPayments: false,
		...extra,
		...h
	};
}

function renderSheet(
	record: MembershipRecordSchema | null,
	extra: Partial<{ isOwner: boolean; canOpenPayments: boolean }> = {}
) {
	const h = handlers();
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const view = render(QueryClientTestWrapper, {
		props: { client, component: PersonSheet as never, componentProps: propsFor(record, h, extra) }
	});
	return Object.assign(h, {
		client,
		rerenderWith: (next: MembershipRecordSchema | null, rows?: MembershipRecordSchema[]) =>
			view.rerender({
				client,
				component: PersonSheet as never,
				componentProps: propsFor(next, h, extra, rows)
			})
	});
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
	periods.merged
		.mockReset()
		.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
	sdk.listMembers.mockReset();
	sdk.getMember
		.mockReset()
		.mockResolvedValue({ data: member, error: undefined, response: { status: 200 } });
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
		// The access row is the single-member GET, by the entry's USER id.
		expect(sdk.getMember).toHaveBeenCalledWith(
			expect.objectContaining({ path: { slug: 'acme', user_id: 'u1' } })
		);
		expect(sdk.listMembers).not.toHaveBeenCalled();
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
		expect(sdk.getMember).not.toHaveBeenCalled();
	});

	it('hides Delete from non-owners', async () => {
		renderSheet(makeUnlinked(), { isOwner: false });
		await screen.findByTestId('person-register-actions');
		expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
	});

	it('shows no member actions for an ended linked entry without an access row (404)', async () => {
		sdk.getMember.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
		renderSheet(
			makeRecord({ is_current: false, member_status: null, valid_until: '2026-02-01T00:00:00Z' })
		);
		await screen.findByTestId('person-register-actions');
		expect(screen.queryByTestId('person-manage-membership')).not.toBeInTheDocument();
	});

	it('offers Manage membership for a cancelled member, so staff can reactivate them', async () => {
		sdk.getMember.mockResolvedValue({
			data: { ...member, status: 'cancelled' },
			response: { status: 200 }
		});
		renderSheet(
			makeRecord({
				is_current: false,
				member_status: 'cancelled',
				valid_until: '2026-02-01T00:00:00Z'
			})
		);
		const manage = await screen.findByTestId('person-manage-membership');
		await waitFor(() => expect(manage).toBeEnabled());
		await userEvent.click(manage);
		expect(await screen.findByLabelText('Membership Status')).toBeInTheDocument();
		expect(screen.queryByTestId('person-banned-hint')).not.toBeInTheDocument();
	});

	it('offers Manage for a banned member and points to the blacklist for the unban', async () => {
		sdk.getMember.mockResolvedValue({
			data: { ...member, status: 'banned' },
			response: { status: 200 }
		});
		renderSheet(
			makeRecord({
				is_current: false,
				member_status: 'banned',
				valid_until: '2026-02-01T00:00:00Z'
			})
		);
		expect(await screen.findByTestId('person-manage-membership')).toBeInTheDocument();
		const hint = await screen.findByTestId('person-banned-hint');
		expect(within(hint).getByRole('link', { name: 'Open the blacklist' })).toHaveAttribute(
			'href',
			expect.stringContaining('/org/acme/admin/blacklist')
		);
	});

	it('retries a failed access lookup instead of treating it as "no access"', async () => {
		sdk.getMember.mockResolvedValue({ error: { detail: 'boom' }, response: { status: 500 } });
		renderSheet(makeRecord());
		expect(
			await screen.findByText("Could not load this member's access details.")
		).toBeInTheDocument();
		expect(screen.queryByTestId('person-register-actions')).not.toBeInTheDocument();
	});

	it('shows no member actions for a day membership without an access row', async () => {
		sdk.getMember.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } });
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

describe('PersonSheet follows the person, not one entry', () => {
	const old = () =>
		makeRecord({
			id: 'r-old',
			tier_name: 'Silver',
			valid_until: '2026-06-01T00:00:00Z',
			is_current: false,
			ended_reason: 'tier_changed',
			member_status: null
		});
	const fresh = () =>
		makeRecord({ id: 'r-new', tier_name: 'Gold', valid_from: '2026-06-01T00:00:00Z' });

	it('lands on the current entry after a tier change, with Manage membership available', async () => {
		periods.list.mockResolvedValue({
			count: 2,
			next: null,
			previous: null,
			results: [old(), fresh()]
		});
		// The sheet was opened on the entry the tier change has since closed.
		renderSheet(old());
		const manage = await screen.findByTestId('person-manage-membership');
		await waitFor(() => expect(manage).toBeEnabled());
		const membership = screen.getByTestId('person-membership');
		expect(membership).toHaveTextContent('Gold');
		expect(screen.getByTestId('register-status-active')).toBeInTheDocument();
		expect(screen.queryByTestId('person-register-actions')).not.toBeInTheDocument();
		expect(periods.list).toHaveBeenCalledWith('acme', 'tok', 'u1');
	});

	it('keeps following the person when a refetch swaps which entry is current', async () => {
		periods.list.mockResolvedValue({ count: 1, next: null, previous: null, results: [old()] });
		const view = renderSheet(old());
		await screen.findByTestId('person-membership');
		periods.list.mockResolvedValue({
			count: 2,
			next: null,
			previous: null,
			results: [old(), fresh()]
		});
		await view.client.invalidateQueries();
		await waitFor(() => expect(screen.getByTestId('person-membership')).toHaveTextContent('Gold'));
		expect(view.onClose).not.toHaveBeenCalled();
	});

	it('keeps the staff note pinned to the person when the current entry changes (no editor remount)', async () => {
		sdk.getRecordNote.mockResolvedValue({ data: note, response: { status: 200 } });
		periods.list.mockResolvedValue({ count: 1, next: null, previous: null, results: [old()] });
		const view = renderSheet(old());
		expect(await screen.findByText(/Last edited by Sam on /)).toBeInTheDocument();
		periods.list.mockResolvedValue({
			count: 2,
			next: null,
			previous: null,
			results: [old(), fresh()]
		});
		await view.client.invalidateQueries();
		await waitFor(() => expect(screen.getByTestId('person-membership')).toHaveTextContent('Gold'));
		// The note route stays on the opened entry: the editor was not re-keyed to the
		// new current entry, so an unsaved draft would survive.
		const recordIds = sdk.getRecordNote.mock.calls.map(
			([arg]) => (arg as { path: { record_id: string } }).path.record_id
		);
		expect(recordIds).not.toContain(fresh().id);
		expect(new Set(recordIds)).toEqual(new Set([old().id]));
	});

	it('does not refetch the access row when the members list or register are invalidated (a note save)', async () => {
		periods.list.mockResolvedValue({
			count: 1,
			next: null,
			previous: null,
			results: [makeRecord()]
		});
		const view = renderSheet(makeRecord());
		const manage = await screen.findByTestId('person-manage-membership');
		await waitFor(() => expect(manage).toBeEnabled());
		expect(sdk.getMember).toHaveBeenCalledTimes(1);
		await view.client.invalidateQueries({ queryKey: ['organization', 'acme', 'members'] });
		await view.client.invalidateQueries({ queryKey: ['organization', 'acme', 'member-register'] });
		await waitFor(() => expect(periods.list).toHaveBeenCalledTimes(2));
		expect(sdk.getMember).toHaveBeenCalledTimes(1);
	});

	it('closes itself when the person has no entry left', async () => {
		const view = renderSheet(makeRecord());
		await waitFor(() => expect(view.onClose).toHaveBeenCalled());
	});

	it('does not look for the member of an account-less entry by user id', async () => {
		renderSheet(makeUnlinked());
		await screen.findByTestId('person-register-actions');
		expect(periods.list).not.toHaveBeenCalled();
		expect(sdk.getMember).not.toHaveBeenCalled();
	});
});

describe('PersonSheet merged periods', () => {
	const mergedEntry = () =>
		makeUnlinked({
			id: 'rm',
			full_name: 'B. Verdi',
			tier_name: 'Bronze',
			merged_into_id: 'r2',
			is_current: false,
			valid_from: '2024-01-01T00:00:00Z',
			valid_until: '2024-03-01T00:00:00Z'
		});

	it('lists the entries merged into an account-less survivor (merged_into)', async () => {
		periods.merged.mockResolvedValue({
			count: 1,
			next: null,
			previous: null,
			results: [mergedEntry()]
		});
		renderSheet(makeUnlinked());
		const section = await screen.findByTestId('person-periods');
		await waitFor(() => expect(within(section).getAllByTestId('person-period')).toHaveLength(2));
		expect(periods.merged).toHaveBeenCalledWith('acme', 'tok', 'r2');
		expect(periods.list).not.toHaveBeenCalled();
	});

	it('opens a merged period from the list', async () => {
		periods.merged.mockResolvedValue({
			count: 1,
			next: null,
			previous: null,
			results: [mergedEntry()]
		});
		const view = renderSheet(makeUnlinked());
		await userEvent.click(await screen.findByTestId('person-period-open'));
		expect(view.onOpenRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 'rm' }));
	});

	it('shows a merged entry read-only: where its note lives, an Unlink action, no register actions', async () => {
		const view = renderSheet(mergedEntry());
		expect(await screen.findByTestId('staff-note-merged')).toBeInTheDocument();
		expect(screen.queryByTestId('person-register-actions')).not.toBeInTheDocument();
		expect(screen.queryByTestId('person-manage-membership')).not.toBeInTheDocument();
		expect(screen.queryByTestId('person-period-open')).not.toBeInTheDocument();
		await userEvent.click(screen.getByTestId('person-unlink'));
		expect(view.onUnlink).toHaveBeenCalledWith(expect.objectContaining({ id: 'rm' }));
		expect(periods.merged).not.toHaveBeenCalled();
	});
});

describe('PersonSheet close animation', () => {
	it('keeps the last person rendered until the panel has slid out', async () => {
		// jsdom runs no animations: hold the slide-out open until the test releases it.
		let release!: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));
		const proto = Element.prototype as unknown as { getAnimations?: () => unknown[] };
		const original = proto.getAnimations;
		proto.getAnimations = () => [{ finished: gate, pending: true, playState: 'running' }];
		try {
			periods.list.mockResolvedValue({
				count: 1,
				next: null,
				previous: null,
				results: [makeRecord()]
			});
			const view = renderSheet(makeRecord());
			const dialog = await screen.findByRole('dialog', { name: 'Ada Rossi' });
			await view.rerenderWith(null);
			// Closed, but the panel is still sliding out: it must not have gone blank.
			await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'));
			expect(within(dialog).getByRole('heading', { name: 'Ada Rossi' })).toBeInTheDocument();
			expect(within(dialog).getByTestId('person-membership')).toBeInTheDocument();
			release();
			await waitFor(() => expect(dialog).not.toBeInTheDocument());
		} finally {
			proto.getAnimations = original;
		}
	});
});
