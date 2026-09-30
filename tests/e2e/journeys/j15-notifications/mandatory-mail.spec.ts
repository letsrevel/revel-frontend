import { test } from '../../support/fixtures';
import {
	claimTicketViaApi,
	createTicketedEvent,
	createVerifiedUser
} from '../../support/factories';
import { ApiClient } from '../../support/api';
import { waitForEmail } from '../../support/mailpit';

// J15.1 (USER_JOURNEYS.md) — mandatory mail: tickets, receipts, payment/refund
// and legal/platform notices always arrive by email, whatever "silence all",
// the channel switches or per-type settings say.
//
// Throwaway user who silences everything and turns email off, then claims a
// free ticket: the ticket confirmation still lands in their inbox.

test.describe('J15 mandatory mail @p2', () => {
	test('a ticket confirmation arrives even with everything silenced', async () => {
		const [user, event] = await Promise.all([
			createVerifiedUser('Silenced'),
			createTicketedEvent({ freeTier: true })
		]);
		const api = await ApiClient.login(user.email, user.password);
		await api.patch('/api/notification-preferences', {
			silence_all_notifications: true,
			enabled_channels: ['in_app']
		});

		if (!event.freeTierId) throw new Error('free tier missing');
		await claimTicketViaApi(user, event.id, event.freeTierId);

		await waitForEmail({ to: user.email, subject: 'Ticket Confirmed' });
	});
});
