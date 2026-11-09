import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';

const sdk = vi.hoisted(() => ({
	organizationadminmemberregisterlinkingInviteAllMemberRegister: vi.fn(),
	organizationadminmemberregisterlinkingInviteMemberRegisterRecord: vi.fn(),
	organizationadminmemberregisterDeleteMemberRegisterRecord: vi.fn()
}));
vi.mock('$lib/api', () => sdk);
vi.mock('$lib/api/client', () => ({ client: {} }));

const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));

import RegisterRowActions from './RegisterRowActions.svelte';
import InviteRecordDialog from './InviteRecordDialog.svelte';
import InviteAllDialog from './InviteAllDialog.svelte';
import DeleteRecordDialog from './DeleteRecordDialog.svelte';
import NowProbe from '$lib/test-utils/NowProbe.svelte';

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
		has_duplicate_claim: false,
		...extra
	};
}

function renderIn(
	component: unknown,
	componentProps: Record<string, unknown>,
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: component as never,
			componentProps
		}
	});
}

const noop = vi.fn();

beforeEach(() => {
	for (const fn of Object.values(sdk)) fn.mockReset();
	for (const fn of Object.values(toast)) fn.mockReset();
	noop.mockReset();
});
afterEach(() => {
	document.body.style.pointerEvents = '';
});

function renderRow(rec: MembershipRecordSchema, now?: Date) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient(),
			component: RegisterRowActions as never,
			componentProps: {
				record: rec,
				isOwner: false,
				onEdit: noop,
				onEnd: noop,
				onDelete: noop,
				onInvite: noop,
				now
			}
		}
	});
}

async function openMenu() {
	screen.getByTestId('register-row-actions').focus();
	await userEvent.keyboard('{Enter}');
	await waitFor(() =>
		expect(screen.queryAllByRole('menuitem', { hidden: true }).length).toBeGreaterThan(0)
	);
}

async function menuItems(rec: MembershipRecordSchema): Promise<string[]> {
	renderRow(rec);
	await openMenu();
	return screen
		.queryAllByRole('menuitem', { hidden: true })
		.map((el) => el.textContent?.trim() ?? '');
}

describe('row action label', () => {
	it('offers Invite for a never-invited entry', async () => {
		const items = await menuItems(record());
		expect(items).toContain('Invite');
		expect(items).not.toContain('Resend invite');
	});
	it('offers Resend invite once invited', async () => {
		const items = await menuItems(record({ invite_status: 'invited' }));
		expect(items).toContain('Resend invite');
		expect(items).not.toContain('Invite');
	});
	it('offers neither for a linked entry', async () => {
		const items = await menuItems(record({ has_account: true, invite_status: 'linked' }));
		expect(items).not.toContain('Invite');
		expect(items).not.toContain('Resend invite');
	});
});

describe('row action clock', () => {
	it('offers Invite once the passed-in now reaches valid_from', async () => {
		const future = record({ valid_from: '2099-01-01T00:00:00Z' });
		const { unmount } = renderRow(future, new Date('2098-12-31T00:00:00Z'));
		// Open the menu first: with it closed, a negative assertion passes vacuously.
		await openMenu();
		expect(
			screen.queryAllByRole('menuitem', { hidden: true }).map((e) => e.textContent?.trim())
		).not.toContain('Invite');
		unmount();
		renderRow(future, new Date('2099-01-01T00:00:00Z'));
		await openMenu();
		expect(
			screen.queryAllByRole('menuitem', { hidden: true }).map((e) => e.textContent?.trim())
		).toContain('Invite');
	});
});

describe('useNow', () => {
	// Restore in afterEach so a failed assertion can't leave fake timers active
	// for the dialog tests that follow.
	afterEach(() => {
		vi.useRealTimers();
	});

	it('ticks while mounted and stops after unmount', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
		const { unmount } = render(NowProbe);
		const first = screen.getByTestId('now').textContent;
		await vi.advanceTimersByTimeAsync(2000);
		expect(screen.getByTestId('now').textContent).not.toBe(first);
		unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('InviteRecordDialog', () => {
	const props = { open: true, slug: 'org', accessToken: 'tok', onClose: vi.fn() };

	it('confirms a resend, warns the old link dies, and toasts the address', async () => {
		const onClose = vi.fn();
		sdk.organizationadminmemberregisterlinkingInviteMemberRegisterRecord.mockResolvedValue({
			data: record({ invite_status: 'invited', invited_at: '2026-06-01T00:00:00Z' }),
			response: { status: 200 }
		});
		renderIn(InviteRecordDialog, {
			...props,
			onClose,
			record: record({ invite_status: 'invited' })
		});
		expect(screen.getByText(/previous link stops working/i)).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'Resend invitation' }));
		await waitFor(() =>
			expect(toast.success).toHaveBeenCalledWith('Invitation sent to ada@example.org')
		);
		expect(
			sdk.organizationadminmemberregisterlinkingInviteMemberRegisterRecord
		).toHaveBeenCalledWith(expect.objectContaining({ path: { slug: 'org', record_id: 'r1' } }));
		expect(onClose).toHaveBeenCalled();
	});

	it('shows the backend 400 detail inline', async () => {
		sdk.organizationadminmemberregisterlinkingInviteMemberRegisterRecord.mockResolvedValue({
			error: { detail: 'This register entry starts in the future.' },
			response: { status: 400 }
		});
		renderIn(InviteRecordDialog, { ...props, record: record() });
		await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
		expect(
			await screen.findByText('This register entry starts in the future.')
		).toBeInTheDocument();
		expect(toast.success).not.toHaveBeenCalled();
	});

	it('refreshes the register on ANY 400 (the invite endpoint never answers 409)', async () => {
		sdk.organizationadminmemberregisterlinkingInviteMemberRegisterRecord.mockResolvedValue({
			error: { detail: 'This register entry is already linked.' },
			response: { status: 400 }
		});
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const spy = vi.spyOn(client, 'invalidateQueries');
		renderIn(InviteRecordDialog, { ...props, record: record() }, client);
		await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
		expect(await screen.findByText('This register entry is already linked.')).toBeInTheDocument();
		await waitFor(() =>
			expect(spy).toHaveBeenCalledWith({ queryKey: ['organization', 'org', 'member-register'] })
		);
	});
});

describe('DeleteRecordDialog (shared confirm dialog)', () => {
	const props = { open: true, slug: 'org', accessToken: 'tok' };

	it('deletes, toasts and closes', async () => {
		const onClose = vi.fn();
		sdk.organizationadminmemberregisterDeleteMemberRegisterRecord.mockResolvedValue({
			response: { status: 204 }
		});
		renderIn(DeleteRecordDialog, { ...props, onClose, record: record() });
		await userEvent.click(screen.getByRole('button', { name: /delete/i }));
		await waitFor(() => expect(toast.success).toHaveBeenCalled());
		expect(onClose).toHaveBeenCalled();
	});

	it('does not refresh on a 400 (stale-on-400 is opt-in per action)', async () => {
		sdk.organizationadminmemberregisterDeleteMemberRegisterRecord.mockResolvedValue({
			error: { detail: 'bad' },
			response: { status: 400 }
		});
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const spy = vi.spyOn(client, 'invalidateQueries');
		renderIn(DeleteRecordDialog, { ...props, onClose: vi.fn(), record: record() }, client);
		await userEvent.click(screen.getByRole('button', { name: /delete/i }));
		expect(await screen.findByTestId('register-error')).toBeInTheDocument();
		expect(spy).not.toHaveBeenCalled();
	});
});

describe('InviteAllDialog', () => {
	const props = { open: true, slug: 'org', accessToken: 'tok' };

	it('confirms without a number, then toasts the real count', async () => {
		const onClose = vi.fn();
		sdk.organizationadminmemberregisterlinkingInviteAllMemberRegister.mockResolvedValue({
			data: { invited: 3 },
			response: { status: 202 }
		});
		renderIn(InviteAllDialog, { ...props, onClose });
		expect(
			sdk.organizationadminmemberregisterlinkingInviteAllMemberRegister
		).not.toHaveBeenCalled();
		await userEvent.click(screen.getByRole('button', { name: 'Send invitations' }));
		await waitFor(() => expect(toast.success).toHaveBeenCalledWith('3 invitations sent'));
		expect(onClose).toHaveBeenCalled();
	});

	it('uses the singular form for one invitation', async () => {
		sdk.organizationadminmemberregisterlinkingInviteAllMemberRegister.mockResolvedValue({
			data: { invited: 1 },
			response: { status: 202 }
		});
		renderIn(InviteAllDialog, { ...props, onClose: vi.fn() });
		await userEvent.click(screen.getByRole('button', { name: 'Send invitations' }));
		await waitFor(() => expect(toast.success).toHaveBeenCalledWith('1 invitation sent'));
	});

	it('states the limit up front', () => {
		renderIn(InviteAllDialog, { ...props, onClose: vi.fn() });
		expect(
			screen.getByText('You can send bulk invitations up to 5 times in 24 hours.')
		).toBeInTheDocument();
	});

	it('closes and toasts without waiting for the list refresh', async () => {
		const onClose = vi.fn();
		sdk.organizationadminmemberregisterlinkingInviteAllMemberRegister.mockResolvedValue({
			data: { invited: 2 },
			response: { status: 202 }
		});
		const client = new QueryClient();
		vi.spyOn(client, 'invalidateQueries').mockReturnValue(new Promise<void>(() => undefined));
		renderIn(InviteAllDialog, { ...props, onClose }, client);
		await userEvent.click(screen.getByRole('button', { name: 'Send invitations' }));
		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(toast.success).toHaveBeenCalledWith('2 invitations sent');
	});

	it('keeps the dialog open after a server error with a deliberate retry', async () => {
		const onClose = vi.fn();
		sdk.organizationadminmemberregisterlinkingInviteAllMemberRegister.mockResolvedValue({
			error: { detail: 'boom' },
			response: { status: 500 }
		});
		renderIn(InviteAllDialog, { ...props, onClose });
		await userEvent.click(screen.getByRole('button', { name: 'Send invitations' }));
		expect(await screen.findByTestId('register-error')).toBeInTheDocument();
		expect(screen.getByTestId('invite-all-retry-note')).toHaveTextContent(
			/counts towards that limit/
		);
		expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('uses Retry-After to say when to retry (hours)', async () => {
		sdk.organizationadminmemberregisterlinkingInviteAllMemberRegister.mockResolvedValue({
			error: { detail: 'Request was throttled.' },
			response: { status: 429, headers: new Headers({ 'Retry-After': '7300' }) }
		});
		renderIn(InviteAllDialog, { ...props, onClose: vi.fn() });
		await userEvent.click(screen.getByRole('button', { name: 'Send invitations' }));
		expect(
			await screen.findByText(
				"You've reached the limit for bulk invitations. Try again in 3 hours."
			)
		).toBeInTheDocument();
	});

	it('does not call a burst 429 the daily limit (Retry-After in seconds)', async () => {
		sdk.organizationadminmemberregisterlinkingInviteAllMemberRegister.mockResolvedValue({
			error: { detail: 'Request was throttled.' },
			response: { status: 429, headers: new Headers({ 'Retry-After': '30' }) }
		});
		renderIn(InviteAllDialog, { ...props, onClose: vi.fn() });
		await userEvent.click(screen.getByRole('button', { name: 'Send invitations' }));
		const alert = await screen.findByTestId('register-error');
		expect(alert).toHaveTextContent('Try again in 1 minute.');
		expect(alert).not.toHaveTextContent('24 hours');
	});

	it('shows the generic limit copy on a 429 without Retry-After and stays open', async () => {
		const onClose = vi.fn();
		sdk.organizationadminmemberregisterlinkingInviteAllMemberRegister.mockResolvedValue({
			error: { detail: 'Request was throttled.' },
			response: { status: 429 }
		});
		renderIn(InviteAllDialog, { ...props, onClose });
		await userEvent.click(screen.getByRole('button', { name: 'Send invitations' }));
		expect(
			await screen.findByText(
				"You've reached the limit for bulk invitations (5 per 24 hours). Try again later."
			)
		).toBeInTheDocument();
		expect(onClose).not.toHaveBeenCalled();
	});
});
