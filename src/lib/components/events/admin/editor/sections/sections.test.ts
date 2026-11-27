import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import AccessSection from './AccessSection.svelte';
import { buildEditorSections, buildNavTabs } from '../sections';

const baseProps = {
	formData: {
		visibility: 'public' as const,
		event_type: 'public' as const,
		requires_ticket: false
	},
	onUpdate: vi.fn()
};

describe('AccessSection', () => {
	it('renders visibility and event type as radio tiles with stable names/values', () => {
		render(AccessSection, { props: { ...baseProps, mode: 'create', ticketingLocked: false } });
		const visibility = document.querySelectorAll('input[type="radio"][name="visibility"]');
		const types = document.querySelectorAll('input[type="radio"][name="event_type"]');
		expect([...visibility].map((r) => (r as HTMLInputElement).value)).toEqual([
			'public',
			'unlisted',
			'private',
			'members-only',
			'staff-only'
		]);
		expect(types).toHaveLength(3);
	});

	it('emits the selected visibility', async () => {
		const onUpdate = vi.fn();
		render(AccessSection, {
			props: { ...baseProps, onUpdate, mode: 'create', ticketingLocked: false }
		});
		await fireEvent.click(screen.getByRole('radio', { name: /Staff Only/i }));
		expect(onUpdate).toHaveBeenCalledWith({ visibility: 'staff-only' });
	});

	it('create mode offers RSVP/Tickets radio tiles and hides admission/guest settings', async () => {
		const onUpdate = vi.fn();
		render(AccessSection, {
			props: { ...baseProps, onUpdate, mode: 'create', ticketingLocked: false }
		});
		expect(screen.queryByRole('checkbox', { name: /Requires Ticket/i })).not.toBeInTheDocument();
		expect(screen.getByRole('radio', { name: /^RSVP/ })).toBeChecked();
		await fireEvent.click(screen.getByRole('radio', { name: /^Tickets/ }));
		expect(onUpdate).toHaveBeenCalledWith({ requires_ticket: true });
		expect(screen.queryByLabelText(/without logging in|guest/i)).not.toBeInTheDocument();
	});

	it('locks ticketing to a read-only statement once the event exists', () => {
		render(AccessSection, { props: { ...baseProps, mode: 'edit', ticketingLocked: true } });
		expect(screen.queryByRole('checkbox', { name: /Requires Ticket/i })).not.toBeInTheDocument();
		expect(screen.getByTestId('ticketing-mode-statement')).toHaveTextContent('RSVP');
	});
});

describe('AccessSection admin warnings', () => {
	const warnIn = (id: string) => document.querySelector(`[data-warning-id="${id}"]`);

	it('shows the B1 warning with a fix link in edit mode', () => {
		render(AccessSection, {
			props: {
				...baseProps,
				formData: {
					visibility: 'public',
					event_type: 'private',
					accept_invitation_requests: false
				},
				mode: 'edit',
				ticketingLocked: true,
				eventId: 'evt-1'
			}
		});
		expect(warnIn('B1')).toHaveTextContent('Private event is visible to everyone');
		expect(screen.getByRole('link', { name: 'Allow invitation requests' })).toHaveAttribute(
			'href',
			'#accept-invitation-requests'
		);
		// Warn level is never dismissible.
		expect(screen.queryByRole('button', { name: /^Dismiss/ })).not.toBeInTheDocument();
	});

	it('B1 has no fix link in create mode (the field is edit-only)', () => {
		render(AccessSection, {
			props: {
				...baseProps,
				formData: { visibility: 'public', event_type: 'private' },
				mode: 'create',
				ticketingLocked: false
			}
		});
		expect(warnIn('B1')).not.toBeNull();
		expect(screen.queryByRole('link', { name: 'Allow invitation requests' })).toBeNull();
	});

	it('shows the dismissible B2 info for a saved event', () => {
		render(AccessSection, {
			props: {
				...baseProps,
				formData: { visibility: 'public', event_type: 'public', accept_invitation_requests: true },
				mode: 'edit',
				ticketingLocked: true,
				eventId: 'evt-2'
			}
		});
		expect(warnIn('B2')).toHaveTextContent('Invitation requests need a private event');
		expect(
			screen.getByRole('button', { name: 'Dismiss: Invitation requests need a private event' })
		).toBeInTheDocument();
	});

	it('B4 needs a saved status: hidden without one, shown with status open', () => {
		const formData = { visibility: 'private' as const, event_type: 'public' as const };
		const { unmount } = render(AccessSection, {
			props: { ...baseProps, formData, mode: 'create', ticketingLocked: false }
		});
		expect(warnIn('B4')).toBeNull();
		unmount();
		render(AccessSection, {
			props: { ...baseProps, formData, mode: 'edit', ticketingLocked: true, status: 'open' }
		});
		expect(warnIn('B4')).not.toBeNull();
	});

	it('B5a renders after the existing guest alert', () => {
		render(AccessSection, {
			props: {
				...baseProps,
				formData: {
					visibility: 'public',
					event_type: 'public',
					can_attend_without_login: true,
					requires_full_profile: true
				},
				mode: 'edit',
				ticketingLocked: true
			}
		});
		const alert = screen.getByRole('alert');
		const b5a = warnIn('B5a');
		expect(b5a).not.toBeNull();
		expect(
			alert.compareDocumentPosition(b5a as Element) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
	});
});

describe('buildEditorSections', () => {
	it('lists the seven sections in page order', () => {
		expect(buildEditorSections({}).map((s) => s.id)).toEqual([
			'section-basics',
			'section-when',
			'section-where',
			'section-access',
			'section-attendance',
			'section-page',
			'section-extras'
		]);
	});

	it('maps errors to the section that owns the field', () => {
		const byId = (errors: Record<string, string>, sched = false) =>
			Object.fromEntries(buildEditorSections(errors, sched).map((s) => [s.id, !!s.hasError]));
		expect(byId({ name: 'x' })['section-basics']).toBe(true);
		expect(byId({ end: 'x' })['section-when']).toBe(true);
		expect(byId({}, true)['section-when']).toBe(true);
		expect(byId({ city_id: 'x' })['section-where']).toBe(true);
		expect(byId({ city_id: 'x' })['section-basics']).toBe(false);
	});
});

describe('buildNavTabs', () => {
	const labels = { details: 'D', ticketing: 'T', listings: 'L' };
	it('lists only ticketing and listings on the details tab', () => {
		expect(buildNavTabs('details', labels).map((t) => t.value)).toEqual(['ticketing', 'listings']);
	});
	it('lists all three elsewhere, flagging the active one', () => {
		const tabs = buildNavTabs('listings', labels);
		expect(tabs.map((t) => t.value)).toEqual(['details', 'ticketing', 'listings']);
		expect(tabs.filter((t) => t.current).map((t) => t.value)).toEqual(['listings']);
	});
});
