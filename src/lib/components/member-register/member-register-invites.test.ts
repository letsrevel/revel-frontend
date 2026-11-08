import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';

const sdk = vi.hoisted(() => ({
	organizationadminmemberregisterlinkingInviteAllMemberRegister: vi.fn(),
	organizationadminmemberregisterlinkingInviteMemberRegisterRecord: vi.fn()
}));
vi.mock('$lib/api', () => sdk);
vi.mock('$lib/api/client', () => ({ client: {} }));

const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));

import RegisterRowActions from './RegisterRowActions.svelte';
import InviteRecordDialog from './InviteRecordDialog.svelte';
import InviteAllDialog from './InviteAllDialog.svelte';

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

beforeEach(() => {
	for (const fn of Object.values(sdk)) fn.mockReset();
	for (const fn of Object.values(toast)) fn.mockReset();
	noop.mockReset();
});
afterEach(() => {
	document.body.style.pointerEvents = '';
});

async function menuItems(rec: MembershipRecordSchema): Promise<string[]> {
	renderIn(RegisterRowActions, {
		record: rec,
		isOwner: false,
		onEdit: noop,
		onEnd: noop,
		onDelete: noop,
		onInvite: noop
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

	it('shows the daily-limit copy on a 429 and stays open', async () => {
		const onClose = vi.fn();
		sdk.organizationadminmemberregisterlinkingInviteAllMemberRegister.mockResolvedValue({
			error: { detail: 'Request was throttled.' },
			response: { status: 429 }
		});
		renderIn(InviteAllDialog, { ...props, onClose });
		await userEvent.click(screen.getByRole('button', { name: 'Send invitations' }));
		expect(
			await screen.findByText(
				"You've reached today's limit for bulk invitations. Try again tomorrow."
			)
		).toBeInTheDocument();
		expect(onClose).not.toHaveBeenCalled();
	});
});
