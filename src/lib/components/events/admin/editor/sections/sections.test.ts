import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import AccessSection from './AccessSection.svelte';
import { buildEditorSections } from '../sections';

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
