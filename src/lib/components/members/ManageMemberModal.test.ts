import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import ManageMemberModal from './ManageMemberModal.svelte';
import type { MembershipStatus, OrganizationMemberSchema } from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';

function makeMember(status: MembershipStatus): OrganizationMemberSchema {
	return {
		user: { id: 'u1', email: 'ada@example.com', first_name: 'Ada', last_name: 'Lovelace' },
		member_since: '2026-08-01T00:00:00Z',
		status,
		tier: null,
		subscription: null
	} as unknown as OrganizationMemberSchema;
}

function setup(status: MembershipStatus, extra: Record<string, unknown> = {}) {
	const onUpdateStatus = vi.fn();
	const props = {
		...extra,
		member: makeMember(status),
		tiers: [],
		isStaff: false,
		open: true,
		onClose: vi.fn(),
		onUpdateStatus,
		onUpdateTier: vi.fn(),
		onMakeStaff: vi.fn(),
		onRemove: vi.fn()
	};
	const result = render(ManageMemberModal, { props });
	return {
		onUpdateStatus,
		serverMoves: (next: MembershipStatus) => result.rerender({ ...props, member: makeMember(next) })
	};
}

const statusTrigger = () =>
	screen.getByRole('button', { name: m['manageMemberModal.statusLabel']() });

describe('ManageMemberModal status sync', () => {
	beforeAll(() => {
		// jsdom lacks these; bits-ui's select needs them to open.
		Element.prototype.hasPointerCapture ??= () => false;
		Element.prototype.setPointerCapture ??= vi.fn();
		Element.prototype.releasePointerCapture ??= vi.fn();
		Element.prototype.scrollIntoView ??= vi.fn();
	});

	it('follows the server when a held member is activated mid-session, and never submits awaiting_payment', async () => {
		const { onUpdateStatus, serverMoves } = setup('awaiting_payment');

		await serverMoves('active');

		await waitFor(() => expect(statusTrigger()).toHaveTextContent(m['memberStatus.active']()));
		// Nothing is staged, so there is no unsaved-change state to submit.
		expect(screen.queryByRole('button', { name: m['manageMemberModal.saveChanges']() })).toBeNull();
		expect(onUpdateStatus).not.toHaveBeenCalled();
	});

	it('follows a server status change while nothing is staged', async () => {
		const { serverMoves } = setup('active');

		await serverMoves('paused');

		await waitFor(() => expect(statusTrigger()).toHaveTextContent(m['memberStatus.paused']()));
	});

	it('keeps a status staff already changed when the server moves', async () => {
		const { serverMoves } = setup('active');

		await fireEvent.keyDown(statusTrigger(), { key: 'ArrowDown' });
		const option = await screen.findByRole('option', { name: m['memberStatus.cancelled']() });
		await fireEvent.pointerUp(option, { pointerType: 'mouse' });
		await fireEvent.click(option);
		await waitFor(() => expect(statusTrigger()).toHaveTextContent(m['memberStatus.cancelled']()));

		await serverMoves('paused');

		expect(statusTrigger()).toHaveTextContent(m['memberStatus.cancelled']());
	});

	async function optionNames(): Promise<string[]> {
		await fireEvent.keyDown(statusTrigger(), { key: 'ArrowDown' });
		await screen.findAllByRole('option');
		return screen.getAllByRole('option').map((o) => o.textContent?.trim() ?? '');
	}

	it('offers an awaiting member exactly awaiting / cancelled / banned', async () => {
		setup('awaiting_payment');
		expect(statusTrigger()).not.toBeDisabled();
		expect(await optionNames()).toEqual([
			m['memberStatus.awaiting_payment'](),
			m['memberStatus.cancelled'](),
			m['memberStatus.banned']()
		]);
	});

	it('leaves the options of an active member unchanged', async () => {
		setup('active');
		expect(await optionNames()).toEqual([
			m['memberStatus.active'](),
			m['memberStatus.paused'](),
			m['memberStatus.cancelled'](),
			m['memberStatus.banned']()
		]);
	});

	it('confirms, then sends cancelled for an awaiting member', async () => {
		const { onUpdateStatus } = setup('awaiting_payment');
		await fireEvent.keyDown(statusTrigger(), { key: 'ArrowDown' });
		const option = await screen.findByRole('option', { name: m['memberStatus.cancelled']() });
		await fireEvent.pointerUp(option, { pointerType: 'mouse' });
		await fireEvent.click(option);
		await fireEvent.click(
			await screen.findByRole('button', { name: m['manageMemberModal.saveChanges']() })
		);
		// The confirmation says the pending request is cancelled too.
		expect(onUpdateStatus).not.toHaveBeenCalled();
		expect(screen.getByText(m['manageMemberModal.awaitingCancelConfirmMessage']())).toBeTruthy();
		await fireEvent.click(
			screen.getByRole('button', { name: m['manageMemberModal.awaitingCancelConfirmButton']() })
		);
		expect(onUpdateStatus).toHaveBeenCalledWith('cancelled');
	});

	it('renders the backend detail of a refused status change', () => {
		setup('awaiting_payment', { statusErrorDetail: 'Cannot activate: no payment yet.' });
		expect(screen.getByRole('alert')).toHaveTextContent('Cannot activate: no payment yet.');
	});
});
