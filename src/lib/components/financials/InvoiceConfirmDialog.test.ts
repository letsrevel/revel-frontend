import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import InvoiceConfirmDialog from './InvoiceConfirmDialog.svelte';

function props(overrides: Record<string, unknown> = {}) {
	return {
		open: true,
		onOpenChange: vi.fn(),
		title: 'Issue this invoice?',
		description: 'It gets a number.',
		buttonLabel: 'Yes, Issue',
		onConfirm: vi.fn(),
		isPending: false,
		variant: 'default' as const,
		...overrides
	};
}

describe('InvoiceConfirmDialog', () => {
	it('confirms through the action button', async () => {
		const p = props();
		render(InvoiceConfirmDialog, { props: p });
		await userEvent.click(await screen.findByRole('button', { name: 'Yes, Issue' }));
		expect(p.onConfirm).toHaveBeenCalled();
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it("shows the issue endpoint's 422 inline", async () => {
		render(InvoiceConfirmDialog, {
			props: props({ refusal: "Revel can't issue invoices to your attendees in Croatia." })
		});
		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent("Revel can't issue invoices to your attendees in Croatia.");
		// The refused request can't be sent again; Cancel stays available.
		expect(screen.getByRole('button', { name: 'Yes, Issue' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
	});

	it('disables the action while pending', async () => {
		render(InvoiceConfirmDialog, { props: props({ isPending: true }) });
		expect(await screen.findByRole('button', { name: 'Yes, Issue' })).toBeDisabled();
	});
});
