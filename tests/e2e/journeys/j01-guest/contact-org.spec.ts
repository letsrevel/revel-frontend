import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import { createOrganization, createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { waitForEmail } from '../../support/mailpit';
import { ContactDialogPage } from '../../support/pages/contact-dialog';

// J1.7 (USER_JOURNEYS.md) — public org contact form: a signed-in visitor sends
// a message from the org page, the organizer receives it by email (subject
// "[{org}] {subject}", Reply-To the sender). Seeded orgs default to
// contact_method=none, so arrange an own public org with the form enabled.

test.describe('J01 contact organizer @p2', () => {
	test('submits the contact form and the organizer gets the email', async ({ browser }) => {
		const [org, sender] = await Promise.all([
			createOrganization(),
			createVerifiedUser('Contacter')
		]);
		// Make the org publicly visible and switch its contact method to the form.
		const ownerApi = await ApiClient.login(org.owner.email, org.owner.password);
		await ownerApi.put(`/api/organization-admin/${org.slug}`, {
			visibility: 'public',
			contact_method: 'form'
		});

		const context = await browser.newContext();
		await authenticateContext(context, sender);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);

		const contactDialog = new ContactDialogPage(page, org.name);
		await contactDialog.open();

		const subject = `E2E hello ${org.slug}`;
		await contactDialog.fillForm(subject, 'Is this event wheelchair accessible?');
		await contactDialog.submit();

		await contactDialog.expectSuccess();

		// The organizer's mailbox (the throwaway owner's address) receives it.
		const mail = await waitForEmail({ to: org.owner.email, subject: `[${org.name}] ${subject}` });
		expect(mail.Subject).toContain(subject);
		expect(mail.ReplyTo?.[0]?.Address).toBe(sender.email);

		await context.close();
	});
});
