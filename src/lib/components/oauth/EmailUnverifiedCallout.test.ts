import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import EmailUnverifiedCallout from './EmailUnverifiedCallout.svelte';

describe('EmailUnverifiedCallout', () => {
	it('explains and links to the profile page', () => {
		render(EmailUnverifiedCallout);
		expect(
			screen.getByRole('heading', { name: 'Verify your email address to register apps' })
		).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Go to your profile' })).toHaveAttribute(
			'href',
			'/account/profile'
		);
	});
});
