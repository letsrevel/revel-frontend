import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import RenameTicketHolderDialog from './RenameTicketHolderDialog.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

const dashboardUpdateTicketGuestName = vi.hoisted(() => vi.fn());
const eventadminticketsUpdateTicketGuestName = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', () => ({
	dashboardUpdateTicketGuestName,
	eventadminticketsUpdateTicketGuestName
}));

function renderDialog(props: Record<string, unknown> = {}) {
	const onClose = vi.fn();
	const onRenamed = vi.fn();
	const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
	render(QueryClientTestWrapper, {
		props: {
			client: queryClient,
			component: RenameTicketHolderDialog,
			componentProps: {
				open: true,
				ticketId: 'tick-1',
				eventId: null,
				currentName: 'Old Name',
				accessToken: 'tok',
				onClose,
				onRenamed,
				...props
			}
		}
	});
	return { onClose, onRenamed };
}

describe('RenameTicketHolderDialog', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('prefills the current holder name', () => {
		renderDialog();
		expect(screen.getByRole('textbox')).toHaveValue('Old Name');
	});

	it('submits the trimmed name to the dashboard endpoint and reports success', async () => {
		const user = userEvent.setup();
		dashboardUpdateTicketGuestName.mockResolvedValue({ data: { id: 'tick-1' }, error: undefined });
		const { onRenamed } = renderDialog();
		const input = screen.getByRole('textbox');
		await user.clear(input);
		await user.type(input, '  New Holder  ');
		await user.click(screen.getByRole('button', { name: 'Save' }));
		await waitFor(() => expect(onRenamed).toHaveBeenCalled());
		expect(dashboardUpdateTicketGuestName).toHaveBeenCalledWith(
			expect.objectContaining({
				path: { ticket_id: 'tick-1' },
				body: { guest_name: 'New Holder' }
			})
		);
		expect(eventadminticketsUpdateTicketGuestName).not.toHaveBeenCalled();
	});

	it('uses the event-admin endpoint when an eventId is given', async () => {
		const user = userEvent.setup();
		eventadminticketsUpdateTicketGuestName.mockResolvedValue({
			data: { id: 'tick-1' },
			error: undefined
		});
		renderDialog({ eventId: 'ev-1' });
		await user.click(screen.getByRole('button', { name: 'Save' }));
		await waitFor(() =>
			expect(eventadminticketsUpdateTicketGuestName).toHaveBeenCalledWith(
				expect.objectContaining({ path: { event_id: 'ev-1', ticket_id: 'tick-1' } })
			)
		);
	});

	it('shows an inline error on a 409 (checked-in/cancelled) and does not close', async () => {
		const user = userEvent.setup();
		dashboardUpdateTicketGuestName.mockResolvedValue({
			data: undefined,
			error: { detail: 'conflict' },
			response: { status: 409 }
		});
		const { onClose, onRenamed } = renderDialog();
		await user.click(screen.getByRole('button', { name: 'Save' }));
		expect(await screen.findByRole('alert')).toBeInTheDocument();
		expect(onRenamed).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('surfaces the backend detail on a 400 (clear refused)', async () => {
		const user = userEvent.setup();
		dashboardUpdateTicketGuestName.mockResolvedValue({
			data: undefined,
			error: { detail: 'This event requires a name on every ticket.' },
			response: { status: 400 }
		});
		renderDialog();
		const input = screen.getByRole('textbox');
		await user.clear(input);
		await user.click(screen.getByRole('button', { name: 'Save' }));
		expect(
			await screen.findByText('This event requires a name on every ticket.')
		).toBeInTheDocument();
	});

	it('never fires the mutation without an access token', async () => {
		const user = userEvent.setup();
		renderDialog({ accessToken: null });
		const save = screen.getByRole('button', { name: 'Save' });
		expect(save).toBeDisabled();
		await user.click(save);
		expect(dashboardUpdateTicketGuestName).not.toHaveBeenCalled();
		expect(eventadminticketsUpdateTicketGuestName).not.toHaveBeenCalled();
	});
});
