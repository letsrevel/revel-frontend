import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import AttendeeInvoiceDraftActions from './AttendeeInvoiceDraftActions.svelte';

const handlers = () => ({ onEdit: vi.fn(), onIssue: vi.fn(), onDelete: vi.fn() });

describe('AttendeeInvoiceDraftActions', () => {
	it('enables Issue for an issuable draft', () => {
		render(AttendeeInvoiceDraftActions, { props: { blockedReason: '', ...handlers() } });
		expect(screen.getByRole('button', { name: /Issue/ })).toBeEnabled();
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
	});

	it('disables Issue with the reason linked, and keeps Delete', () => {
		const reason = "Revel can't issue invoices to your attendees in Croatia.";
		render(AttendeeInvoiceDraftActions, { props: { blockedReason: reason, ...handlers() } });
		const status = screen.getByRole('status');
		expect(status).toHaveTextContent(reason);
		const issue = screen.getByRole('button', { name: /Issue/ });
		expect(issue).toBeDisabled();
		expect(issue).toHaveAttribute('aria-describedby', status.id);
		expect(issue).toHaveAccessibleDescription(reason);
		expect(screen.getByRole('button', { name: /Delete/ })).toBeEnabled();
	});
});
