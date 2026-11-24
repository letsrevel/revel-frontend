import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import AttendeeCardList from './AttendeeCardList.svelte';
import * as m from '$lib/paraglide/messages.js';
import type { RsvpDetailSchema } from '$lib/api/generated/types.gen';

/** ADR-0020: an RSVP staff recorded for an account that has no active connection. */
function rsvp(user: Partial<RsvpDetailSchema['user']>): RsvpDetailSchema {
	return {
		id: 'r1',
		status: 'yes',
		user,
		created_at: '2026-01-01T00:00:00Z'
	} as unknown as RsvpDetailSchema;
}

function renderCards(rsvps: RsvpDetailSchema[]) {
	const noop = vi.fn();
	return render(AttendeeCardList, {
		props: {
			rsvps,
			addMemberPending: false,
			tiersLoading: false,
			onMakeMember: noop,
			onEdit: noop,
			onDelete: noop,
			onBlacklist: noop
		}
	});
}

describe('AttendeeCardList unknown holders', () => {
	it('shows the badge and prints the email once when it is also the name', () => {
		const { container } = renderCards([
			rsvp({ id: 'u1', known: false, display_name: 'gina@example.com', email: 'gina@example.com' })
		]);
		expect(screen.getByTestId('unknown-holder-badge')).toBeInTheDocument();
		expect(screen.getAllByText('gina@example.com')).toHaveLength(1);
		expect(container.textContent).not.toMatch(/null|undefined/);
	});

	it('keeps the email line for a known holder with a real name', () => {
		renderCards([
			rsvp({ id: 'u2', known: true, display_name: 'Alice Anderson', email: 'alice@example.com' })
		]);
		expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
		expect(screen.getByText('alice@example.com')).toBeInTheDocument();
		expect(screen.queryByTestId('unknown-holder-badge')).not.toBeInTheDocument();
	});

	it('hides make member but keeps the blacklist menu for an erased holder with a kept email', () => {
		renderCards([
			rsvp({ id: 'u3', erased: true, display_name: 'Eve Erased', email: 'eve@example.com' })
		]);
		expect(screen.queryByText(m['makeMemberAction.button']())).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /more actions/i })).toBeInTheDocument();
	});

	it('hides the actions menu for an erased holder with no kept email', () => {
		renderCards([rsvp({ id: 'u4', erased: true, display_name: 'Deleted user', email: null })]);
		expect(screen.queryByRole('button', { name: /more actions/i })).not.toBeInTheDocument();
	});

	it('offers make member for a known holder', () => {
		renderCards([
			rsvp({ id: 'u2', known: true, display_name: 'Alice Anderson', email: 'alice@example.com' })
		]);
		expect(screen.getByText(m['makeMemberAction.button']())).toBeInTheDocument();
	});
});
