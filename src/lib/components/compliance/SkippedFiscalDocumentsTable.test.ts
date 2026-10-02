import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { SkippedFiscalDocumentSchema } from '$lib/api/generated/types.gen';
import SkippedFiscalDocumentsTable from './SkippedFiscalDocumentsTable.svelte';

function doc(overrides: Partial<SkippedFiscalDocumentSchema> = {}): SkippedFiscalDocumentSchema {
	return {
		id: 'doc-1',
		kind: 'invoice',
		reason_code: 'b2b_e_invoicing',
		policy_country: 'BE',
		reason: 'Peppol text',
		event_id: 'event-1',
		event_name: 'BE Business Summit',
		stripe_session_id: 'cs_test',
		ticket_ids: ['t-1'],
		invoice_id: null,
		invoice_number: null,
		parent_id: null,
		buyer_name: 'E2E Business BE',
		buyer_email: 'buyer@example.com',
		buyer_vat_id: 'BE0123456789',
		buyer_vat_country: 'BE',
		buyer_vat_id_status: 'valid',
		buyer_address: '',
		currency: 'EUR',
		total_gross: '120.00',
		total_net: '100.00',
		total_vat: '20.00',
		line_items: [],
		vat_breakdown: [],
		decided_at: '2026-09-30T10:00:00Z',
		resolved_at: null,
		external_reference: '',
		...overrides
	};
}

describe('SkippedFiscalDocumentsTable', () => {
	it('captions the table and shows an open row in words, not colour', () => {
		render(SkippedFiscalDocumentsTable, {
			props: { documents: [doc()], orgSlug: 'compliance-be', onResolve: vi.fn() }
		});
		expect(screen.getByRole('table', { name: 'Invoices to issue yourself' })).toBeInTheDocument();
		expect(screen.getByText('To issue')).toBeInTheDocument();
		expect(screen.getByText('VAT ID BE0123456789')).toBeInTheDocument();
		expect(screen.getByText('Belgium')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /View tickets/ })).toHaveAttribute(
			'href',
			'/org/compliance-be/admin/events/event-1/tickets?invoice_skipped=true'
		);
	});

	it('hands the row to onResolve', async () => {
		const onResolve = vi.fn();
		render(SkippedFiscalDocumentsTable, {
			props: { documents: [doc()], orgSlug: 'compliance-be', onResolve }
		});
		const action = screen.getByRole('button', { name: /Mark as issued/ });
		expect(action).toHaveAttribute('id', 'skipped-document-resolve-doc-1');
		await userEvent.click(action);
		expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ id: 'doc-1' }));
	});

	it('shows the reference of an issued document and offers to edit it', () => {
		render(SkippedFiscalDocumentsTable, {
			props: {
				documents: [
					doc({ resolved_at: '2026-10-01T10:00:00Z', external_reference: 'PEPPOL-2026-0042' })
				],
				orgSlug: 'compliance-be',
				onResolve: vi.fn()
			}
		});
		expect(screen.getByText('Issued')).toBeInTheDocument();
		expect(screen.getByText('Ref. PEPPOL-2026-0042')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Edit reference/ })).toBeInTheDocument();
	});

	it('handles a credit note on a deleted event', () => {
		render(SkippedFiscalDocumentsTable, {
			props: {
				documents: [
					doc({
						kind: 'credit_note',
						event_id: null,
						event_name: null,
						invoice_number: 'ORG-2026-000001'
					})
				],
				orgSlug: 'compliance-be',
				onResolve: vi.fn()
			}
		});
		expect(screen.getAllByText('Credit note').length).toBeGreaterThan(0);
		expect(screen.getByText('Corrects ORG-2026-000001')).toBeInTheDocument();
		expect(screen.getByText('Deleted event')).toBeInTheDocument();
		expect(screen.queryByRole('link')).not.toBeInTheDocument();
	});
});
