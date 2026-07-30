import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import EventVisibilityFields from './EventVisibilityFields.svelte';
import type { ResolvedVisibilityToggles } from '$lib/utils/event-visibility';

function setup(settings?: Partial<ResolvedVisibilityToggles>) {
	const onChange = vi.fn<(next: ResolvedVisibilityToggles) => void>();
	render(EventVisibilityFields, { props: { settings, onChange } });
	return { onChange, user: userEvent.setup() };
}

describe('EventVisibilityFields', () => {
	it('reflects the backend defaults when no settings are supplied', () => {
		setup();

		for (const name of [/attendee count/i, /capacity/i, /guest list/i]) {
			expect(screen.getByRole('checkbox', { name })).toBeChecked();
		}
	});

	it('reflects a partially withheld setting', () => {
		setup({ show_capacity: false });

		expect(screen.getByRole('checkbox', { name: /capacity/i })).not.toBeChecked();
		expect(screen.getByRole('checkbox', { name: /attendee count/i })).toBeChecked();
	});

	// Presets are frontend-only: they set the three granular toggles and the
	// preset name is never part of the payload (the backend 422s unknown keys).
	it('the Discreet preset emits all three toggles off — and nothing else', async () => {
		const { onChange, user } = setup();

		await user.click(screen.getByRole('button', { name: /discreet/i }));

		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith({
			show_attendee_count: false,
			show_capacity: false,
			show_attendee_list: false
		});
	});

	it('the Open preset re-enables every disclosure explicitly', async () => {
		const { onChange, user } = setup({
			show_attendee_count: false,
			show_capacity: false,
			show_attendee_list: false
		});

		await user.click(screen.getByRole('button', { name: /open/i }));

		expect(onChange).toHaveBeenCalledWith({
			show_attendee_count: true,
			show_capacity: true,
			show_attendee_list: true
		});
	});

	it('a single toggle emits the complete triple, preserving the others', async () => {
		const { onChange, user } = setup({ show_attendee_count: false });

		await user.click(screen.getByRole('checkbox', { name: /guest list/i }));

		expect(onChange).toHaveBeenCalledWith({
			show_attendee_count: false,
			show_capacity: true,
			show_attendee_list: false
		});
	});

	it('marks the matching preset pressed, and none when the combination is custom', () => {
		const { unmount } = render(EventVisibilityFields, {
			props: { settings: undefined, onChange: vi.fn() }
		});
		expect(screen.getByRole('button', { name: /open/i })).toHaveAttribute('aria-pressed', 'true');
		unmount();

		render(EventVisibilityFields, {
			props: { settings: { show_capacity: false }, onChange: vi.fn() }
		});
		for (const name of [/open/i, /discreet/i]) {
			expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
		}
	});
});
