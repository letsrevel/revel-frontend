import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import ActionButton from './ActionButton.svelte';

// Screenshot bug: a logged-out visitor on a guest-checkout event saw a pale,
// outlined "Get Tickets" CTA while a signed-in user saw it filled, although
// both lead to the same purchase flow.
describe('ActionButton — anonymous variant', () => {
	it('renders the filled primary CTA when guests can attend without login', () => {
		render(ActionButton, {
			props: {
				userStatus: null,
				requiresTicket: true,
				isAuthenticated: false,
				canAttendWithoutLogin: true
			}
		});
		const button = screen.getByRole('button', { name: 'Get Tickets' });
		expect(button).toHaveClass('bg-primary');
		expect(button).not.toBeDisabled();
	});

	it('keeps the secondary style for the login-first detour', () => {
		render(ActionButton, {
			props: {
				userStatus: null,
				requiresTicket: true,
				isAuthenticated: false,
				canAttendWithoutLogin: false
			}
		});
		const button = screen.getByRole('button', { name: 'Login to Get Tickets' });
		expect(button).not.toHaveClass('bg-primary');
		expect(button).toHaveClass('border-input');
	});

	it('uses the same primary style for a signed-in user with no status yet', () => {
		render(ActionButton, {
			props: { userStatus: null, requiresTicket: true, isAuthenticated: true }
		});
		expect(screen.getByRole('button', { name: 'Get Tickets' })).toHaveClass('bg-primary');
	});
});
