import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { MembershipRecordSchema, MembershipTierSchema } from '$lib/api/generated/types.gen';

const sdk = vi.hoisted(() => ({
	organizationadminmemberregisterCreateMemberRegisterRecord: vi.fn(),
	organizationadminmemberregisterDeleteMemberRegisterRecord: vi.fn(),
	organizationadminmemberregisterEndMemberRegisterRecord: vi.fn(),
	organizationadminmemberregisterExportMemberRegister: vi.fn(),
	organizationadminmemberregisterListMemberRegister: vi.fn(),
	organizationadminmemberregisterUpdateMemberRegisterRecord: vi.fn()
}));
vi.mock('$lib/api', () => sdk);
vi.mock('$lib/api/client', () => ({ client: {} }));

import RegisterTable from './RegisterTable.svelte';
import RegisterCards from './RegisterCards.svelte';
import RegisterRowActions from './RegisterRowActions.svelte';
import RecordFormDialog from './RecordFormDialog.svelte';
import EndRecordDialog from './EndRecordDialog.svelte';
import DeleteRecordDialog from './DeleteRecordDialog.svelte';
import CalendarDayPicker from './CalendarDayPicker.svelte';
import RegisterFilters from './RegisterFilters.svelte';
import RegisterExportDialog from './RegisterExportDialog.svelte';
import { DEFAULT_FILTERS } from '$lib/member-register/filters';

function record(extra: Partial<MembershipRecordSchema> = {}): MembershipRecordSchema {
	return {
		id: 'r1',
		full_name: 'Ada Lovelace',
		email: 'ada@example.org',
		tier_name: 'Full',
		tier_id: 'tier-1',
		kind: 'standard',
		source: 'manual',
		valid_from: '2026-01-10T09:30:00Z',
		valid_until: null,
		created_at: '2026-01-10T09:30:00Z',
		has_account: false,
		invite_status: 'not_invited',
		can_invite: true,
		invite_blocked_reason: null,
		has_duplicate_claim: false,
		...extra
	};
}

const tiers: MembershipTierSchema[] = [
	{ id: 'tier-1', name: 'Full', kind: 'standard' },
	{ id: 'tier-2', name: 'Supporter', kind: 'standard' }
];

function renderIn(component: unknown, componentProps: Record<string, unknown>) {
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: component as never,
			componentProps
		}
	});
}

const noop = vi.fn();

afterEach(() => {
	// bits-ui locks body pointer events while a menu is open; do not leak it across tests.
	document.body.style.pointerEvents = '';
});

beforeEach(() => {
	for (const fn of Object.values(sdk)) fn.mockReset();
});

describe('register list rendering', () => {
	const records = [
		record(),
		record({
			id: 'r2',
			full_name: 'Grace Hopper',
			has_account: true,
			invite_status: 'linked',
			linked_via: 'auto_email',
			kind: 'temporary',
			source: 'backfill',
			has_duplicate_claim: true,
			merged_into_id: 'r9',
			valid_until: '2026-02-01T00:00:00Z'
		})
	];

	it('renders real table semantics and ONE status badge per row', () => {
		renderIn(RegisterTable, { records, isOwner: false, onEdit: noop, onEnd: noop, onDelete: noop });
		const table = screen.getByRole('table');
		expect(within(table).getAllByRole('columnheader').length).toBeGreaterThanOrEqual(8);
		expect(within(table).getAllByRole('row')).toHaveLength(3);
		expect(table.querySelectorAll('[data-testid^="register-status-"]')).toHaveLength(2);
		expect(screen.getByTestId('register-status-no-account')).toBeInTheDocument();
		// The closed day membership reads "Ended"; the secondary badges moved to the sheet.
		expect(screen.getByTestId('register-status-ended')).toBeInTheDocument();
		for (const id of ['approximate-dates', 'merged', 'linked-auto', 'duplicate-claim']) {
			expect(screen.queryByTestId(`register-badge-${id}`)).not.toBeInTheDocument();
		}
	});

	it('renders the same entries as cards on mobile', () => {
		renderIn(RegisterCards, { records, isOwner: false, onEdit: noop, onEnd: noop, onDelete: noop });
		expect(screen.getAllByTestId('register-card')).toHaveLength(2);
		expect(screen.getByTestId('register-status-no-account')).toBeInTheDocument();
	});
});

describe('row actions permissions', () => {
	// The floating menu is `visibility: hidden` in jsdom (no layout), which also blanks
	// the accessible names of its items: read the items by their text instead.
	async function menuItems(isOwner: boolean, rec = record()): Promise<string[]> {
		renderIn(RegisterRowActions, {
			record: rec,
			isOwner,
			onEdit: noop,
			onEnd: noop,
			onDelete: noop
		});
		screen.getByTestId('register-row-actions').focus();
		await userEvent.keyboard('{Enter}');
		await waitFor(() =>
			expect(screen.queryAllByRole('menuitem', { hidden: true }).length).toBeGreaterThan(0)
		);
		return screen
			.queryAllByRole('menuitem', { hidden: true })
			.map((el) => el.textContent?.trim() ?? '');
	}

	it('hides Delete from non-owners', async () => {
		const items = await menuItems(false);
		expect(items).toContain('Edit');
		expect(items).not.toContain('Delete');
	});

	it('offers Delete to owners', async () => {
		expect(await menuItems(true)).toContain('Delete');
	});

	it('does not offer End for an entry that already ended', async () => {
		const items = await menuItems(true, record({ valid_until: '2026-02-01T00:00:00Z' }));
		expect(items).toContain('Edit');
		expect(items).not.toContain('End membership');
	});
});

describe('edit form', () => {
	const props = (rec: MembershipRecordSchema | null) => ({
		open: true,
		record: rec,
		slug: 'acme',
		accessToken: 'tok',
		tiers,
		onClose: noop
	});

	it('disables tier and valid-until for linked open entries and explains why', () => {
		renderIn(RecordFormDialog, props(record({ has_account: true })));
		expect(screen.getByLabelText(/^tier$/i)).toBeDisabled();
		expect(screen.getByLabelText(/valid until/i)).toBeDisabled();
		expect(screen.getByLabelText(/full name/i)).toBeEnabled();
		expect(screen.getByLabelText(/^email/i)).toBeEnabled();
		expect(screen.getByLabelText(/valid from/i)).toBeEnabled();
		expect(screen.getByText(/change the tier through the member's tier settings/i)).toBeVisible();
		expect(screen.getByTestId('linked-entry-note')).toBeInTheDocument();
	});

	it('keeps every field editable for unlinked entries', () => {
		renderIn(RecordFormDialog, props(record()));
		expect(screen.getByLabelText(/^tier$/i)).toBeEnabled();
		expect(screen.getByLabelText(/valid until/i)).toBeEnabled();
		expect(screen.queryByTestId('linked-entry-note')).not.toBeInTheDocument();
	});

	it('sends only the changed field and surfaces a stale 409 inline', async () => {
		sdk.organizationadminmemberregisterUpdateMemberRegisterRecord.mockResolvedValue({
			error: { detail: 'A linked membership cannot be reopened from the register.' },
			response: { status: 409 }
		});
		renderIn(RecordFormDialog, props(record()));
		const name = screen.getByLabelText(/full name/i);
		await userEvent.clear(name);
		await userEvent.type(name, 'Ada King');
		await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

		await waitFor(() =>
			expect(sdk.organizationadminmemberregisterUpdateMemberRegisterRecord).toHaveBeenCalledTimes(1)
		);
		expect(
			sdk.organizationadminmemberregisterUpdateMemberRegisterRecord.mock.calls[0][0]
		).toMatchObject({
			path: { slug: 'acme', record_id: 'r1' },
			body: { full_name: 'Ada King' }
		});
		const alert = await screen.findByTestId('register-error');
		expect(alert).toHaveTextContent(/linked or changed since you loaded the page/i);
		expect(alert).toHaveTextContent(/cannot be reopened/i);
	});

	it('creates an entry with a trimmed name and no null fields', async () => {
		sdk.organizationadminmemberregisterCreateMemberRegisterRecord.mockResolvedValue({
			data: record()
		});
		renderIn(RecordFormDialog, props(null));
		await userEvent.type(screen.getByLabelText(/full name/i), '  Ada Lovelace ');
		await userEvent.selectOptions(screen.getByLabelText(/^tier$/i), 'tier-2');
		await userEvent.type(screen.getByLabelText(/valid from/i), '2026-01-10T09:30');
		await userEvent.click(screen.getByRole('button', { name: /^add entry$/i }));

		await waitFor(() =>
			expect(sdk.organizationadminmemberregisterCreateMemberRegisterRecord).toHaveBeenCalledTimes(1)
		);
		const { body } = sdk.organizationadminmemberregisterCreateMemberRegisterRecord.mock.calls[0][0];
		expect(body).toMatchObject({ full_name: 'Ada Lovelace', tier_id: 'tier-2' });
		expect(body).not.toHaveProperty('email');
		expect(body).not.toHaveProperty('valid_until');
	});

	it('shows validation errors instead of calling the API', async () => {
		renderIn(RecordFormDialog, props(null));
		await userEvent.click(screen.getByRole('button', { name: /^add entry$/i }));
		expect(await screen.findByText(/enter a name/i)).toBeInTheDocument();
		expect(sdk.organizationadminmemberregisterCreateMemberRegisterRecord).not.toHaveBeenCalled();
	});
});

describe('end dialog', () => {
	const props = (rec: MembershipRecordSchema) => ({
		open: true,
		record: rec,
		slug: 'acme',
		accessToken: 'tok',
		onClose: noop
	});

	it('warns that ending a linked entry cancels the membership', () => {
		renderIn(EndRecordDialog, props(record({ has_account: true })));
		expect(screen.getByTestId('end-linked-warning')).toHaveTextContent(
			/cancels the person's membership and any subscriptions/i
		);
		expect(screen.getByRole('button', { name: /end and cancel membership/i })).toBeInTheDocument();
	});

	it('shows no loss-of-access warning for an unlinked entry', () => {
		renderIn(EndRecordDialog, props(record()));
		expect(screen.queryByTestId('end-linked-warning')).not.toBeInTheDocument();
	});

	it('offers only cancelled and removed as reasons', () => {
		renderIn(EndRecordDialog, props(record()));
		expect(screen.getAllByRole('radio')).toHaveLength(2);
	});
});

describe('delete dialog', () => {
	it('explains a 409 as "remove the member first"', async () => {
		sdk.organizationadminmemberregisterDeleteMemberRegisterRecord.mockResolvedValue({
			error: {
				detail: 'Remove the member from the organization before deleting their open register entry.'
			},
			response: { status: 409 }
		});
		renderIn(DeleteRecordDialog, {
			open: true,
			record: record({ has_account: true }),
			slug: 'acme',
			accessToken: 'tok',
			onClose: noop
		});
		await userEvent.click(screen.getByRole('button', { name: /delete entry/i }));
		expect(await screen.findByTestId('register-error')).toHaveTextContent(
			/remove the member first/i
		);
	});
});

describe('review fixes (components)', () => {
	const formProps = (rec: MembershipRecordSchema | null, extra: Record<string, unknown> = {}) => ({
		open: true,
		record: rec,
		slug: 'acme',
		accessToken: 'tok',
		tiers,
		onClose: noop,
		...extra
	});

	it('refuses to clear the end date of a closed linked entry, inline', async () => {
		renderIn(
			RecordFormDialog,
			formProps(record({ has_account: true, valid_until: '2026-02-01T10:00:00Z' }))
		);
		await userEvent.clear(screen.getByLabelText(/valid until/i));
		await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
		const err = await screen.findByText(/can't be reopened/i);
		expect(screen.getByLabelText(/valid until/i)).toHaveAttribute('aria-invalid', 'true');
		expect(screen.getByLabelText(/valid until/i).getAttribute('aria-describedby')).toContain(
			err.id
		);
		expect(sdk.organizationadminmemberregisterUpdateMemberRegisterRecord).not.toHaveBeenCalled();
	});

	it('closes the form with a message when a stale 404 finds the entry gone', async () => {
		sdk.organizationadminmemberregisterUpdateMemberRegisterRecord.mockResolvedValue({
			error: { detail: 'Not found' },
			response: { status: 404 }
		});
		const onClose = vi.fn();
		renderIn(RecordFormDialog, formProps(record(), { recordPresent: false, onClose }));
		const name = screen.getByLabelText(/full name/i);
		await userEvent.clear(name);
		await userEvent.type(name, 'Ada King');
		await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
		await waitFor(() => expect(onClose).toHaveBeenCalled());
	});

	it('closes the end dialog when the entry is gone after a 404', async () => {
		sdk.organizationadminmemberregisterEndMemberRegisterRecord.mockResolvedValue({
			error: { detail: 'Not found' },
			response: { status: 404 }
		});
		const onClose = vi.fn();
		renderIn(EndRecordDialog, {
			open: true,
			record: record(),
			recordPresent: false,
			slug: 'acme',
			accessToken: 'tok',
			onClose
		});
		await userEvent.click(screen.getByRole('button', { name: /^end membership$/i }));
		await waitFor(() => expect(onClose).toHaveBeenCalled());
	});

	it('closes the delete dialog when the entry is gone after a 404', async () => {
		sdk.organizationadminmemberregisterDeleteMemberRegisterRecord.mockResolvedValue({
			error: { detail: 'Not found' },
			response: { status: 404 }
		});
		const onClose = vi.fn();
		renderIn(DeleteRecordDialog, {
			open: true,
			record: record(),
			recordPresent: false,
			slug: 'acme',
			accessToken: 'tok',
			onClose
		});
		await userEvent.click(screen.getByRole('button', { name: /delete entry/i }));
		await waitFor(() => expect(onClose).toHaveBeenCalled());
	});

	it('day picker uses the generic organization-timezone label when the zone is unknown', () => {
		const props = { id: 'd', label: 'Day', timezone: null, onChange: vi.fn() };
		const { unmount } = render(CalendarDayPicker, { props: { ...props, value: '' } });
		expect(screen.getByTestId('calendar-day-readback')).toHaveTextContent(
			"read in the organization's timezone"
		);
		unmount();
		render(CalendarDayPicker, { props: { ...props, value: '2026-03-12' } });
		expect(screen.getByTestId('calendar-day-readback')).toHaveTextContent(
			/Members on .* \(organization's timezone\)/
		);
		expect(screen.getByTestId('calendar-day-readback').textContent).not.toContain('Vienna');
	});

	it('day picker ignores half-typed values and applies complete ones and explicit clears', () => {
		const onChange = vi.fn();
		renderIn(CalendarDayPicker, {
			id: 'd',
			label: 'Day',
			value: '2026-03-12',
			timezone: 'Europe/Rome',
			onChange
		});
		expect(screen.getByTestId('calendar-day-readback')).toHaveTextContent(
			/Members on .* \(Europe\/Rome\)/
		);
		const input = screen.getByLabelText('Day') as HTMLInputElement;
		input.value = '0002-03-12';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new Event('change', { bubbles: true }));
		expect(onChange).not.toHaveBeenCalled();
		input.value = '2026-04-01';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(onChange).not.toHaveBeenCalled();
		input.dispatchEvent(new Event('change', { bubbles: true }));
		expect(onChange).toHaveBeenCalledWith('2026-04-01');
		onChange.mockClear();
		input.value = '';
		input.dispatchEvent(new Event('change', { bubbles: true }));
		expect(onChange).toHaveBeenCalledWith('');
	});

	it('cancels a pending search debounce when filters change from outside', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		try {
			const onChange = vi.fn();
			const base = { tiers: [], timezone: 'Europe/Rome', onChange };
			const { rerender } = render(RegisterFilters, {
				props: { ...base, filters: { ...DEFAULT_FILTERS } }
			});
			const search = screen.getByLabelText(/search/i);
			await userEvent.type(search, 'ada');
			await rerender({ ...base, filters: { ...DEFAULT_FILTERS, search: 'grace' } });
			await vi.advanceTimersByTimeAsync(1000);
			expect(onChange).not.toHaveBeenCalled();
			expect(search).toHaveValue('grace');
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('beta smoke fixes', () => {
	it('shows the export day readback and timezone exactly once', () => {
		renderIn(RegisterExportDialog, {
			open: true,
			slug: 'acme',
			accessToken: 'tok',
			timezone: 'Europe/Vienna',
			initialDay: '2026-11-09',
			onClose: noop
		});
		expect(screen.getByTestId('calendar-day-readback')).toHaveTextContent(
			/Members on .*2026.*\(Europe\/Vienna\)/
		);
		expect(screen.queryByTestId('export-summary')).not.toBeInTheDocument();
		expect(document.body.textContent?.match(/\(Europe\/Vienna\)/g)).toHaveLength(1);
	});
});
