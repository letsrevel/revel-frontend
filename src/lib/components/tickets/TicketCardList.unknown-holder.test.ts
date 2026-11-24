import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import TicketCardList from './TicketCardList.svelte';
import TicketTable from './TicketTable.svelte';
import * as m from '$lib/paraglide/messages.js';
import type { AdminTicketSchema } from '$lib/api/generated/types.gen';

/**
 * ADR-0020: a holder staff alone linked in (box-office sale, staff invitation)
 * arrives masked: only id, email and the name staff typed.
 */
function ticket(user: Partial<AdminTicketSchema['user']>): AdminTicketSchema {
	return {
		id: 't1',
		user,
		tier: { name: 'General', payment_method: 'free', currency: 'EUR' },
		guest_name: '',
		created_at: '2026-01-01T00:00:00Z',
		status: 'active'
	} as unknown as AdminTicketSchema;
}

const unknownUser = {
	id: 'u1',
	known: false,
	display_name: 'Guest Gina',
	email: 'gina@example.com',
	first_name: null,
	last_name: null,
	pronouns: null,
	profile_picture_url: null,
	profile_picture_thumbnail_url: null,
	profile_picture_preview_url: null
};

const knownUser = {
	id: 'u2',
	known: true,
	display_name: 'Alice Anderson',
	email: 'alice@example.com',
	first_name: 'Alice',
	last_name: 'Anderson',
	pronouns: 'she/her'
};

// The card list (mobile) and the table (desktop) render the same row contract.
const VIEWS = [
	['TicketCardList', TicketCardList],
	['TicketTable', TicketTable]
] as const;

function renderView(
	view: (typeof VIEWS)[number][1],
	tickets: AdminTicketSchema[],
	onEditNote?: (t: AdminTicketSchema) => void
) {
	const noop = vi.fn();
	return render(view as typeof TicketCardList, {
		props: {
			tickets,
			checkInPending: false,
			confirmPaymentPending: false,
			cancelTicketPending: false,
			addMemberPending: false,
			unconfirmPaymentPending: false,
			tiersLoading: false,
			onCheckIn: noop,
			onConfirmPayment: noop,
			onMakeMember: noop,
			onCancelTicket: noop,
			onBlacklist: noop,
			onUnconfirmPayment: noop,
			onEditNote
		}
	});
}

describe.each(VIEWS)('%s unknown holders', (_name, view) => {
	it('shows the supplied name, the email and the badge, and never "null"', () => {
		const { container } = renderView(view, [ticket(unknownUser)]);
		expect(screen.getByText('Guest Gina')).toBeInTheDocument();
		expect(screen.getByText('gina@example.com')).toBeInTheDocument();
		expect(screen.getByTestId('unknown-holder-badge')).toBeInTheDocument();
		expect(container.textContent).not.toMatch(/null|undefined/);
		expect(container.querySelector('img')).toBeNull();
	});

	it('shows the kept name and email with a "Deleted account" badge for an erased holder (BE #1509)', () => {
		const { container } = renderView(view, [
			ticket({
				id: 'u3',
				known: false,
				erased: true,
				display_name: 'Eve Erased',
				email: 'eve@example.com',
				profile_picture_url: null
			})
		]);
		expect(screen.getByText('Eve Erased')).toBeInTheDocument();
		expect(screen.getByText('eve@example.com')).toBeInTheDocument();
		expect(screen.getByTestId('erased-holder-badge')).toHaveTextContent('Deleted account');
		expect(screen.queryByTestId('unknown-holder-badge')).not.toBeInTheDocument();
		expect(container.querySelector('img')).toBeNull();
	});

	it('shows N/A, not "null", for an erased holder without a kept email', () => {
		const { container } = renderView(view, [
			ticket({ id: 'u4', erased: true, display_name: 'Deleted user', email: null })
		]);
		expect(screen.getByText('Deleted user')).toBeInTheDocument();
		expect(container.textContent).not.toMatch(/null|undefined/);
	});

	it('shows no badge for a known holder, and still shows pronouns', () => {
		renderView(view, [ticket(knownUser)]);
		expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
		expect(screen.getByText('(she/her)')).toBeInTheDocument();
		expect(screen.queryByTestId('unknown-holder-badge')).not.toBeInTheDocument();
	});

	it('disables the staff-note action for an unknown holder', async () => {
		const onEditNote = vi.fn();
		renderView(view, [ticket(unknownUser)], onEditNote);
		await userEvent.click(screen.getByRole('button', { name: /actions|more|menu/i }));
		const item = await screen.findByTestId('note-unavailable');
		expect(item).toHaveTextContent(m['unknownHolder.noteUnavailable']());
		expect(item).toHaveAttribute('aria-disabled', 'true');
	});

	it('offers the staff-note action for a known holder', async () => {
		const onEditNote = vi.fn();
		renderView(view, [ticket(knownUser)], onEditNote);
		await userEvent.click(screen.getByRole('button', { name: /actions|more|menu/i }));
		await userEvent.click(await screen.findByText(m['userNote.editAction']()));
		expect(onEditNote).toHaveBeenCalledTimes(1);
	});
});
