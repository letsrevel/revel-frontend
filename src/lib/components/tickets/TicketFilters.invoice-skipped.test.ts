import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TicketFilters from './TicketFilters.svelte';

const base = {
	searchQuery: '',
	selectedStatus: null,
	selectedPaymentMethod: null,
	onSearch: vi.fn(),
	onStatusFilter: vi.fn(),
	onPaymentMethodFilter: vi.fn()
};

describe('TicketFilters — invoice skipped (#1008)', () => {
	it('toggles the labelled checkbox', async () => {
		const onInvoiceSkippedFilter = vi.fn();
		render(TicketFilters, { props: { ...base, onInvoiceSkippedFilter } });
		const box = screen.getByRole('checkbox', { name: 'Invoice skipped by Revel' });
		expect(box).not.toBeChecked();
		await userEvent.click(box);
		expect(onInvoiceSkippedFilter).toHaveBeenCalledWith(true);
	});

	it('reflects the active filter', () => {
		render(TicketFilters, {
			props: { ...base, invoiceSkippedOnly: true, onInvoiceSkippedFilter: vi.fn() }
		});
		expect(screen.getByRole('checkbox', { name: 'Invoice skipped by Revel' })).toBeChecked();
	});

	it('is absent where the page offers no such filter', () => {
		render(TicketFilters, { props: base });
		expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
	});
});
