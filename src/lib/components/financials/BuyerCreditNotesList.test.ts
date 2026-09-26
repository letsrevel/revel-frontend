import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import BuyerCreditNotesList from './BuyerCreditNotesList.svelte';

const NOTES = [
	{
		id: 'cn-1',
		credit_note_number: 'REV-CN-2026-1',
		invoice_number: 'REV-2026-9',
		amount_gross: '4.00',
		amount_net: '3.33',
		amount_vat: '0.67',
		issued_at: '2026-09-20T10:00:00Z',
		created_at: '2026-09-20T10:00:00Z'
	},
	{
		id: 'cn-2',
		credit_note_number: 'REV-CN-2026-2',
		invoice_number: 'REV-2026-9',
		amount_gross: '6.00',
		amount_net: '5.00',
		amount_vat: '1.00',
		issued_at: null,
		created_at: '2026-09-21T10:00:00Z'
	}
];

describe('BuyerCreditNotesList (#961)', () => {
	it('lists every credit note with its amount and a named download', async () => {
		const user = userEvent.setup();
		const onDownload = vi.fn();
		render(BuyerCreditNotesList, {
			props: { creditNotes: NOTES, currency: 'EUR', downloadingId: null, onDownload }
		});

		expect(screen.getByRole('heading', { name: 'Credit notes' })).toBeInTheDocument();
		expect(screen.getAllByRole('listitem')).toHaveLength(2);
		expect(screen.getByText('-€4.00')).toBeInTheDocument();
		expect(screen.getByText('-€6.00')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Download credit note REV-CN-2026-2' }));
		expect(onDownload).toHaveBeenCalledWith('cn-2');
	});

	it('disables downloads while one is in flight', () => {
		render(BuyerCreditNotesList, {
			props: { creditNotes: NOTES, currency: 'EUR', downloadingId: 'cn-1', onDownload: vi.fn() }
		});
		for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
	});
});
