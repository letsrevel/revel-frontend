import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { MembershipRecordSchema, PossibleDuplicateSchema } from '$lib/api/generated/types.gen';

const sdk = vi.hoisted(() => ({
	organizationadminmemberregisterlinkingMergeMemberRegisterRecord: vi.fn(),
	organizationadminmemberregisterlinkingUnlinkMemberRegisterRecord: vi.fn()
}));
vi.mock('$lib/api', () => sdk);
vi.mock('$lib/api/client', () => ({ client: {} }));

const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));

import { isSameName } from '$lib/member-register/reconcile';
import DuplicatesList from './DuplicatesList.svelte';
import MergeRecordsDialog from './MergeRecordsDialog.svelte';
import UnlinkRecordDialog from './UnlinkRecordDialog.svelte';

function record(extra: Partial<MembershipRecordSchema> = {}): MembershipRecordSchema {
	return {
		id: 'r1',
		full_name: 'Ada Lovelace',
		email: 'ada@example.org',
		tier_name: 'Full',
		tier_id: 'tier-1',
		kind: 'standard',
		source: 'manual',
		valid_from: '2026-03-10T09:30:00Z',
		valid_until: null,
		created_at: '2026-03-10T09:30:00Z',
		has_account: false,
		invite_status: 'not_invited',
		has_duplicate_claim: false,
		...extra
	};
}

const pair: PossibleDuplicateSchema = {
	unlinked: record({ id: 'U', full_name: 'Ada L.', valid_from: '2025-01-15T09:30:00Z' }),
	linked: record({
		id: 'L',
		full_name: 'Ada Lovelace',
		tier_name: 'Gold',
		has_account: true,
		invite_status: 'linked'
	}),
	reasons: ['email', 'name']
};

function renderIn(component: unknown, componentProps: Record<string, unknown>) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(QueryClientTestWrapper, {
		props: { client, component: component as never, componentProps }
	});
}

beforeEach(() => {
	for (const fn of Object.values(sdk)) fn.mockReset();
	for (const fn of Object.values(toast)) fn.mockReset();
});
afterEach(() => {
	document.body.style.pointerEvents = '';
});

describe('DuplicatesList', () => {
	it('shows both entries and the reason chips, and starts a merge', async () => {
		const onMerge = vi.fn();
		renderIn(DuplicatesList, { pairs: [pair], onMerge });
		const card = screen.getByTestId('duplicate-pair');
		expect(within(screen.getByTestId('duplicate-unlinked')).getByText('Ada L.')).toBeTruthy();
		expect(within(screen.getByTestId('duplicate-linked')).getByText('Ada Lovelace')).toBeTruthy();
		expect(within(card).getByTestId('register-reason-email').textContent).toContain('Same email');
		expect(within(card).getByTestId('register-reason-name').textContent).toContain('Same name');
		expect(within(card).queryByTestId('register-reason-claim')).toBeNull();
		await userEvent.click(screen.getByTestId('duplicate-merge'));
		expect(onMerge).toHaveBeenCalledWith(pair);
	});

	it('labels the merge button by entry kind when both names match', () => {
		const same = { ...pair, unlinked: record({ id: 'U', full_name: 'Ada Lovelace' }) };
		renderIn(DuplicatesList, { pairs: [same], onMerge: vi.fn() });
		expect(
			screen.getByRole('button', {
				name: "Merge the entry without an account into Ada Lovelace's record"
			})
		).toBeInTheDocument();
	});
});

describe('isSameName', () => {
	it('ignores case, spacing and unicode composition', () => {
		expect(isSameName(' Ada  Lovelace', 'ada lovelace ')).toBe(true);
		expect(isSameName('José N', 'José N')).toBe(true);
		expect(isSameName('Ada L.', 'Ada Lovelace')).toBe(false);
	});
	it('never treats two empty names as the same', () => {
		expect(isSameName('', '')).toBe(false);
		expect(isSameName('   ', ' ')).toBe(false);
	});
});

describe('MergeRecordsDialog', () => {
	const props = { open: true, pair, slug: 'org', accessToken: 'tok', onClose: vi.fn() };

	it('previews the outcome for an open absorbed entry', () => {
		renderIn(MergeRecordsDialog, props);
		const text = document.body.textContent ?? '';
		expect(text).toContain(
			"Keeps Ada Lovelace's own start date and current tier (Gold). Ada L.'s period stays on the register as merged."
		);
		expect(text).not.toContain('earliest');
	});

	it('keeps the "X into Y" title when the names differ', () => {
		renderIn(MergeRecordsDialog, props);
		expect(screen.getByText('Merge Ada L. into Ada Lovelace?')).toBeInTheDocument();
	});

	it('names the entry kinds when both names are the same (case and spacing aside)', () => {
		renderIn(MergeRecordsDialog, {
			...props,
			pair: { ...pair, unlinked: record({ id: 'U', full_name: ' ada  lovelace ' }) }
		});
		expect(
			screen.getByText("Merge the entry without an account into Ada Lovelace's record?")
		).toBeInTheDocument();
		expect(screen.queryByText(/Merge .* into Ada Lovelace\?/)).not.toBeInTheDocument();
	});

	it('words the preview without repeating the name when the names match', () => {
		renderIn(MergeRecordsDialog, {
			...props,
			pair: { ...pair, unlinked: record({ id: 'U', full_name: 'Ada Lovelace' }) }
		});
		const text = document.body.textContent ?? '';
		expect(text).toContain(
			'The person keeps their own start date and current tier (Gold). The entry without an account stays on the register as merged.'
		);
		expect(text).not.toContain('earliest');
		expect(text).not.toContain('Ada Lovelace is marked as merged.');
	});

	it('says a closed entry is attached to the account', () => {
		renderIn(MergeRecordsDialog, {
			...props,
			pair: { ...pair, unlinked: record({ id: 'U', valid_until: '2025-06-01T00:00:00Z' }) }
		});
		expect(document.body.textContent).toContain("attached to Ada Lovelace's account");
	});

	it('merges the linked survivor with the absorbed id', async () => {
		sdk.organizationadminmemberregisterlinkingMergeMemberRegisterRecord.mockResolvedValue({
			data: record({ id: 'L' })
		});
		renderIn(MergeRecordsDialog, props);
		await userEvent.click(screen.getByRole('button', { name: 'Merge entries' }));
		await waitFor(() =>
			expect(
				sdk.organizationadminmemberregisterlinkingMergeMemberRegisterRecord
			).toHaveBeenCalledWith(
				expect.objectContaining({
					path: { slug: 'org', record_id: 'L' },
					body: { absorbed_record_id: 'U' }
				})
			)
		);
	});

	it('refetches and closes with the gone toast when a 400 shows the pair is gone', async () => {
		sdk.organizationadminmemberregisterlinkingMergeMemberRegisterRecord.mockResolvedValue({
			error: { detail: 'A merged register entry cannot be merged again.' },
			response: { status: 400 }
		});
		const onClose = vi.fn();
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const spy = vi.spyOn(client, 'invalidateQueries');
		render(QueryClientTestWrapper, {
			props: {
				client,
				component: MergeRecordsDialog as never,
				componentProps: { ...props, pairPresent: false, onClose }
			}
		});
		await userEvent.click(screen.getByRole('button', { name: 'Merge entries' }));
		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(toast.info).toHaveBeenCalled();
		const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);
		expect(keys).toContainEqual(['organization', 'org', 'member-register']);
		expect(keys).toContainEqual(['organization', 'org', 'register-possible-duplicates']);
	});

	it('shows the backend detail on a 400', async () => {
		sdk.organizationadminmemberregisterlinkingMergeMemberRegisterRecord.mockResolvedValue({
			error: { detail: 'A merged register entry cannot be merged again.' },
			response: { status: 400 }
		});
		renderIn(MergeRecordsDialog, props);
		await userEvent.click(screen.getByRole('button', { name: 'Merge entries' }));
		const alert = await screen.findByTestId('register-error');
		expect(alert.textContent).toContain('A merged register entry cannot be merged again.');
	});
});

describe('UnlinkRecordDialog', () => {
	const base = { open: true, slug: 'org', accessToken: 'tok', onClose: vi.fn() };

	it('warns that unlinking an open linked entry removes access', () => {
		renderIn(UnlinkRecordDialog, { ...base, record: record({ has_account: true }) });
		expect(screen.getByTestId('unlink-access-warning').textContent).toContain(
			"This removes the member's access and cancels their subscriptions. They won't be notified."
		);
	});

	it('has no access warning for a closed linked entry or a merged one', () => {
		renderIn(UnlinkRecordDialog, {
			...base,
			record: record({ has_account: true, valid_until: '2026-05-01T00:00:00Z' })
		});
		expect(screen.queryByTestId('unlink-access-warning')).toBeNull();
	});

	it('closes with a toast instead of the clears-user copy when the entry is no longer linked', async () => {
		const onClose = vi.fn();
		renderIn(UnlinkRecordDialog, { ...base, onClose, record: record({ has_account: false }) });
		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(toast.info).toHaveBeenCalledWith('This entry is no longer linked. Nothing to unlink.');
	});

	it('does not show the nothing-to-unlink toast after its own successful unlink', async () => {
		sdk.organizationadminmemberregisterlinkingUnlinkMemberRegisterRecord.mockResolvedValue({
			data: record()
		});
		const onClose = vi.fn();
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		render(QueryClientTestWrapper, {
			props: {
				client,
				component: UnlinkRecordDialog as never,
				componentProps: { ...base, onClose, record: record({ id: 'X', has_account: true }) }
			}
		});
		await userEvent.click(screen.getByRole('button', { name: 'Unlink entry' }));
		await waitFor(() => expect(toast.success).toHaveBeenCalled());
		expect(toast.info).not.toHaveBeenCalled();
	});

	it('calls unlink for the record', async () => {
		sdk.organizationadminmemberregisterlinkingUnlinkMemberRegisterRecord.mockResolvedValue({
			data: record()
		});
		renderIn(UnlinkRecordDialog, { ...base, record: record({ id: 'X', has_account: true }) });
		await userEvent.click(screen.getByRole('button', { name: 'Unlink entry' }));
		await waitFor(() =>
			expect(
				sdk.organizationadminmemberregisterlinkingUnlinkMemberRegisterRecord
			).toHaveBeenCalledWith(expect.objectContaining({ path: { slug: 'org', record_id: 'X' } }))
		);
	});
});
