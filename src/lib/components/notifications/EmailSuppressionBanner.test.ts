import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import EmailSuppressionBanner from './EmailSuppressionBanner.svelte';

const since = '2026-09-20T10:00:00Z';

describe('EmailSuppressionBanner (#987)', () => {
	it.each(['hard_bounce', 'invalid', 'blocked'] as const)(
		'says emails can’t be delivered for %s',
		(reason) => {
			render(EmailSuppressionBanner, { suppression: { reason, since } });
			expect(
				screen.getByRole('region', { name: "Emails to this address can't be delivered." })
			).toBeInTheDocument();
		}
	);

	it('names the spam complaint', () => {
		render(EmailSuppressionBanner, { suppression: { reason: 'complaint', since } });
		expect(
			screen.getByRole('region', { name: 'This address marked one of our emails as spam.' })
		).toBeInTheDocument();
	});

	it('reassures about tickets, and offers email change and support (no alias hint)', () => {
		render(EmailSuppressionBanner, { suppression: { reason: 'hard_bounce', since } });
		const region = screen.getByRole('region');
		expect(region).toHaveTextContent(/tickets and receipts are still in the app/i);
		expect(region).not.toHaveTextContent(/\+|alias/i);
		expect(screen.getByRole('link', { name: 'Change email address' })).toHaveAttribute(
			'href',
			'/account/security#email'
		);
		expect(screen.getByRole('link', { name: 'Contact support' }).getAttribute('href')).toMatch(
			/^mailto:contact@letsrevel\.io\?subject=/
		);
		expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
	});

	it('offers a dismiss when given a handler', async () => {
		const onDismiss = vi.fn();
		render(EmailSuppressionBanner, { suppression: { reason: 'blocked', since }, onDismiss });
		await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss' }));
		expect(onDismiss).toHaveBeenCalledOnce();
	});
});
