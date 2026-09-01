import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import TicketTiersDialog from './TicketTiersDialog.svelte';

const content = createRawSnippet(() => ({ render: () => `<div>tier list here</div>` }));

function renderDialog(props: Record<string, unknown> = {}) {
	const onCheckout = vi.fn();
	render(TicketTiersDialog, {
		props: {
			open: true,
			count: 2,
			totalDisplay: '20.00',
			currency: 'EUR',
			isFree: false,
			isPending: false,
			onCheckout,
			children: content,
			...props
		}
	});
	return { onCheckout };
}

describe('TicketTiersDialog', () => {
	it('renders the Get Tickets title and the hosted content when open', () => {
		renderDialog();
		expect(screen.getByRole('dialog', { name: 'Get Tickets' })).toBeInTheDocument();
		expect(screen.getByText('tier list here')).toBeInTheDocument();
	});

	it('renders nothing when closed', () => {
		renderDialog({ open: false });
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('footer shows the ticket count and running total', () => {
		renderDialog();
		expect(screen.getByText(/2 tickets/)).toBeInTheDocument();
		expect(screen.getByText(/EUR 20\.00/)).toBeInTheDocument();
	});

	it('free carts show Free instead of a total', () => {
		renderDialog({ isFree: true, totalDisplay: null, currency: null });
		expect(screen.getByText(/Free/)).toBeInTheDocument();
		expect(screen.queryByText(/EUR/)).not.toBeInTheDocument();
	});

	it('buy closes the dialog and hands off to onCheckout', async () => {
		const user = userEvent.setup();
		const { onCheckout } = renderDialog();
		await user.click(screen.getByRole('button', { name: 'Buy' }));
		expect(onCheckout).toHaveBeenCalledOnce();
		await waitFor(() => {
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		});
	});

	it('buy is disabled with an empty cart', () => {
		renderDialog({ count: 0, totalDisplay: null });
		expect(screen.getByRole('button', { name: 'Buy' })).toBeDisabled();
	});
});
