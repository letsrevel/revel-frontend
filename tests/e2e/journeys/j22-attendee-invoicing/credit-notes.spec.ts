import { test, expect, type Page } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	issueDraftInvoiceFor,
	setOrgInvoicingMode,
	startOnlineCheckout,
	type ThrowawayUser
} from '../../support/factories';
import { PERSONAS } from '../../support/personas';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { waitForEmail } from '../../support/mailpit';
import {
	completeStripeCheckout,
	expectWebhookEffect,
	requireStripeWebhooks
} from '../../support/stripe';

// J22.6 (USER_JOURNEYS.md) — credit notes. Refunding an online purchase that
// carries an ISSUED attendee invoice generates a credit note on the
// `charge.refunded` webhook, emails it to the buyer (PDF attached), and — once
// the credits cover the invoice total — flips the invoice to CANCELLED.
//
// Arrange (API): hybrid-mode checkout with billing info → draft invoice →
// issued via the admin API (the organizer issue UI is hybrid-flow) → refunds
// via the organizer refund endpoint (the refund dialog UI is j10
// organizer-refunds). Assert (UI): the organizer's Attendee Credit Notes and
// Attendee Invoices pages, plus the buyer's email.
//
// Two partial refunds (€4 then the remaining €6) exercise the amount-aware
// path (#865): each refund gets its OWN credit note for its own amount, and
// the invoice stays Issued until the second one completes the credit.
//
// There is no buyer-facing credit-note UI: the buyer dashboard exposes
// issued invoices only (GET /api/dashboard/invoices filters status=ISSUED),
// so the buyer-side assertion is the credit-note email.

const ORG_SLUG = 'revel-events-collective';
const INVOICES_PATH = `/org/${ORG_SLUG}/admin/billing/attendee-invoices`;
const CREDIT_NOTES_PATH = `/org/${ORG_SLUG}/admin/billing/attendee-credit-notes`;

async function ownerApi(): Promise<ApiClient> {
	return ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
}

async function invoiceFor(
	api: ApiClient,
	buyerEmail: string
): Promise<{ id: string; invoice_number: string; status: string }> {
	const page = await api.get<{
		results: Array<{ id: string; invoice_number: string; status: string }>;
	}>(
		`/api/organization-admin/${ORG_SLUG}/attendee-invoices?search=${encodeURIComponent(buyerEmail)}`
	);
	const invoice = page.results[0];
	if (!invoice) throw new Error(`No attendee invoice for ${buyerEmail}`);
	return invoice;
}

async function refundBuyerTicket(
	api: ApiClient,
	eventId: string,
	buyer: ThrowawayUser,
	amount: string
): Promise<void> {
	const tickets = await api.get<{ results: Array<{ id: string }> }>(
		`/api/event-admin/${eventId}/tickets?search=${encodeURIComponent(buyer.email)}`
	);
	const ticket = tickets.results[0];
	if (!ticket) throw new Error(`No ticket for ${buyer.email} on event ${eventId}`);
	await api.post(`/api/event-admin/${eventId}/tickets/${ticket.id}/refund`, {
		amount,
		reason: 'E2E credit note'
	});
}

/** Credit-note rows for this buyer, scoped through the page's search box. */
async function openCreditNotes(page: Page, buyerEmail: string): Promise<void> {
	await gotoHydrated(page, CREDIT_NOTES_PATH);
	await page.getByPlaceholder('Search credit notes...').fill(buyerEmail);
}

test.describe('J22 credit notes @p2', () => {
	test('partial then full refund → one credit note each → invoice cancelled + emails', async ({
		browser,
		asOwner
	}) => {
		// Hosted checkout + three webhook round-trips (payment, 2 refunds).
		test.setTimeout(360_000);
		requireStripeWebhooks();

		await setOrgInvoicingMode('hybrid');
		const [event, buyer] = await Promise.all([
			createTicketedEvent({ freeTier: false }),
			createVerifiedUser('CreditNote')
		]);
		const tier = await createTicketTier(event.id, { name: 'Credited Entry', price: '10.00' });
		const checkoutUrl = await startOnlineCheckout(buyer, event.id, tier.id, {
			billingInfo: {
				billing_name: `${buyer.firstName} ${buyer.lastName}`,
				billing_address: 'Musterstraße 1, 1010 Wien',
				vat_country_code: 'AT',
				billing_email: buyer.email
			}
		});

		const buyerContext = await browser.newContext();
		await authenticateContext(buyerContext, buyer);
		try {
			const buyerPage = await buyerContext.newPage();
			await buyerPage.goto(checkoutUrl);
			await completeStripeCheckout(buyerPage);
		} finally {
			await buyerContext.close();
		}

		// Only an ISSUED invoice gets credit notes (a refunded DRAFT is simply
		// deleted) — issue the draft once the checkout webhook produced it.
		await expectWebhookEffect(
			'the checkout webhook to generate the draft attendee invoice',
			() => issueDraftInvoiceFor(buyer.email),
			{ timeout: 120_000 }
		);
		const api = await ownerApi();
		const invoice = await invoiceFor(api, buyer.email);
		expect(invoice.status).toBe('issued');

		const page = asOwner;
		await gotoHydrated(page, CREDIT_NOTES_PATH);
		await waitForClientAuth(page);
		await expect(
			page.getByRole('heading', { name: 'Attendee Credit Notes', level: 1 })
		).toBeVisible();

		// ── Refund #1: €4 of €10 ────────────────────────────────────────
		await refundBuyerTicket(api, event.id, buyer, '4.00');

		const creditRows = page.getByRole('row').filter({ hasText: invoice.invoice_number });
		const firstNote = creditRows.filter({ hasText: /4[.,]00/ });
		await expectWebhookEffect(
			'the charge.refunded webhook to generate the first credit note',
			async () => {
				await openCreditNotes(page, buyer.email);
				await expect(firstNote).toBeVisible({ timeout: 8_000 });
			},
			{ timeout: 120_000 }
		);
		await expect(creditRows).toHaveCount(1);
		// Credit note numbers use the org's CN sequence, not the invoice's.
		const firstNumber = (await firstNote.getByRole('cell').first().innerText()).trim();
		expect(firstNumber).toMatch(/-CN-\d{4}-\d+$/);

		// The linked invoice cell points back at the Attendee Invoices page.
		await expect(firstNote.getByRole('link', { name: invoice.invoice_number })).toHaveAttribute(
			'href',
			INVOICES_PATH
		);

		// Partial credit: the invoice is still Issued.
		const invoiceRow = page.getByRole('row').filter({ hasText: invoice.invoice_number });
		await gotoHydrated(page, INVOICES_PATH);
		await page.getByPlaceholder('Search invoices...').fill(buyer.email);
		await expect(invoiceRow.filter({ hasText: 'Issued' })).toBeVisible({ timeout: 15_000 });

		// The buyer is emailed the credit note.
		const firstEmail = await waitForEmail({ to: buyer.email, subject: firstNumber }, 60_000);
		expect(firstEmail.Subject).toBe(`Credit Note ${firstNumber} — ${event.name}`);

		// ── Refund #2: the remaining €6 ─────────────────────────────────
		await refundBuyerTicket(api, event.id, buyer, '6.00');

		const secondNote = creditRows.filter({ hasText: /6[.,]00/ });
		await expect(async () => {
			await openCreditNotes(page, buyer.email);
			await expect(secondNote).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 120_000 });
		await expect(creditRows).toHaveCount(2);
		const secondNumber = (await secondNote.getByRole('cell').first().innerText()).trim();
		expect(secondNumber).toMatch(/-CN-\d{4}-\d+$/);
		expect(secondNumber).not.toBe(firstNumber);

		// Credits now cover the invoice total → CANCELLED.
		await expect(async () => {
			await gotoHydrated(page, INVOICES_PATH);
			await page.getByPlaceholder('Search invoices...').fill(buyer.email);
			await expect(invoiceRow.filter({ hasText: 'Cancelled' })).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });

		const secondEmail = await waitForEmail({ to: buyer.email, subject: secondNumber }, 60_000);
		expect(secondEmail.Subject).toBe(`Credit Note ${secondNumber} — ${event.name}`);
	});
});
