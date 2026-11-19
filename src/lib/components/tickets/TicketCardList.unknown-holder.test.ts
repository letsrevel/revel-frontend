import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import TicketCardList from './TicketCardList.svelte';
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

function renderCards(tickets: AdminTicketSchema[], onEditNote?: (t: AdminTicketSchema) => void) {
	const noop = vi.fn();
	return render(TicketCardList, {
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

describe('TicketCardList unknown holders', () => {
	it('shows the supplied name, the email and the badge, and never "null"', () => {
		const { container } = renderCards([ticket(unknownUser)]);
		expect(screen.getByText('Guest Gina')).toBeInTheDocument();
		expect(screen.getByText('gina@example.com')).toBeInTheDocument();
		expect(screen.getByTestId('unknown-holder-badge')).toBeInTheDocument();
		expect(container.textContent).not.toMatch(/null|undefined/);
		expect(container.querySelector('img')).toBeNull();
	});

	it('shows no badge for a known holder, and still shows pronouns', () => {
		renderCards([ticket(knownUser)]);
		expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
		expect(screen.getByText('(she/her)')).toBeInTheDocument();
		expect(screen.queryByTestId('unknown-holder-badge')).not.toBeInTheDocument();
	});

	it('disables the staff-note action for an unknown holder', async () => {
		const onEditNote = vi.fn();
		renderCards([ticket(unknownUser)], onEditNote);
		await userEvent.click(screen.getByRole('button', { name: /actions|more|menu/i }));
		const item = await screen.findByTestId('note-unavailable');
		expect(item).toHaveTextContent(m['unknownHolder.noteUnavailable']());
		expect(item).toHaveAttribute('aria-disabled', 'true');
		await userEvent.click(item);
		expect(onEditNote).not.toHaveBeenCalled();
	});

	it('offers the staff-note action for a known holder', async () => {
		const onEditNote = vi.fn();
		renderCards([ticket(knownUser)], onEditNote);
		await userEvent.click(screen.getByRole('button', { name: /actions|more|menu/i }));
		await userEvent.click(await screen.findByText(m['userNote.editAction']()));
		expect(onEditNote).toHaveBeenCalledTimes(1);
	});
});
