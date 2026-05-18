import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import type { RevelUserSchema } from '$lib/api/generated/types.gen';
import EmailChangeCard from './email-change-card.svelte';

// $app/forms is not available in jsdom; provide no-op stubs so the component
// mounts without errors. The `enhance` action is used on the form element but
// its progressive-enhancement behaviour is not under test here.
vi.mock('$app/forms', () => ({
	enhance: () => ({ destroy: () => undefined }),
	applyAction: vi.fn()
}));

// svelte-sonner toast is not needed in unit tests.
vi.mock('svelte-sonner', () => ({
	toast: { error: vi.fn(), success: vi.fn() }
}));

const baseUser = {
	id: 'user-1',
	email: 'current@example.com',
	email_verified: true,
	first_name: '',
	last_name: '',
	username: 'current@example.com'
} as unknown as RevelUserSchema;

describe('EmailChangeCard', () => {
	it('renders the current email in resting state', () => {
		render(EmailChangeCard, { user: baseUser, form: null });
		expect(screen.getByText('current@example.com')).toBeTruthy();
		expect(screen.getByRole('button', { name: /change email/i })).toBeTruthy();
	});

	it('reveals the form when the change-email button is clicked', async () => {
		const user = userEvent.setup();
		render(EmailChangeCard, { user: baseUser, form: null });
		await user.click(screen.getByRole('button', { name: /change email/i }));
		expect(screen.getByLabelText(/new email address/i)).toBeTruthy();
		expect(screen.getByLabelText(/current password/i)).toBeTruthy();
	});

	it('cancel closes the form when fields are empty', async () => {
		const user = userEvent.setup();
		render(EmailChangeCard, { user: baseUser, form: null });
		await user.click(screen.getByRole('button', { name: /change email/i }));
		await user.click(screen.getByRole('button', { name: /cancel/i }));
		expect(screen.queryByLabelText(/new email address/i)).toBeNull();
	});

	it('cancel opens the discard dialog when fields have input', async () => {
		const user = userEvent.setup();
		render(EmailChangeCard, { user: baseUser, form: null });
		await user.click(screen.getByRole('button', { name: /change email/i }));
		await user.type(screen.getByLabelText(/new email address/i), 'new@example.com');
		await user.click(screen.getByRole('button', { name: /cancel/i }));
		expect(await screen.findByText(/discard your changes\?/i)).toBeTruthy();
	});

	it('shows the success state when the form returns a new email and no failure', () => {
		render(EmailChangeCard, {
			user: baseUser,
			form: { emailChange: { new_email: 'new@example.com' } }
		});
		expect(screen.getByText(/check your inbox/i)).toBeTruthy();
		expect(screen.getByText(/new@example\.com/)).toBeTruthy();
		expect(screen.getByText(/15 minutes/i)).toBeTruthy();
	});

	it.todo('shows wrong-password inline error after re-opening the form on failure');
});
