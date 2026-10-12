import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import NotificationTypeSettings from './NotificationTypeSettings.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

vi.mock('$lib/api', () => ({
	notificationpreferenceGetAvailableNotificationTypes: vi.fn().mockResolvedValue({
		data: [
			'payment_confirmation',
			'ticket_created',
			'staff_ticket_created',
			'questionnaire_submitted'
		]
	})
}));

async function renderOpen() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: NotificationTypeSettings,
			componentProps: {
				notificationTypeSettings: {},
				enabledChannels: ['in_app', 'email'],
				isFormDisabled: false,
				isTelegramConnected: false,
				authToken: 't'
			}
		}
	});
	await userEvent.setup().click(screen.getByRole('button', { name: /advanced settings/i }));
	return screen.findByText('payment confirmation');
}

describe('NotificationTypeSettings mandatory types', () => {
	it('offers no toggle for receipts that cannot be turned off', async () => {
		await renderOpen();
		expect(screen.queryByRole('checkbox', { name: /payment confirmation/i })).toBeNull();
		expect(screen.queryByRole('checkbox', { name: /^ticket created/i })).toBeNull();
		expect(screen.getAllByText('Always on')).toHaveLength(2);
		// Types with no mandatory behaviour keep their toggle
		expect(screen.getByRole('checkbox', { name: /questionnaire submitted/i })).toBeInTheDocument();
	});

	it('keeps a toggle on the organizer staff_ticket_created alert (never mandatory)', async () => {
		await renderOpen();
		expect(screen.getByRole('checkbox', { name: /ticket sold/i })).toBeInTheDocument();
	});
});
