import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import TelegramConnectionManager from './TelegramConnectionManager.svelte';
import {
	telegramGetLinkStatus,
	telegramGetBotName,
	telegramConnectAccount
} from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	telegramGetLinkStatus: vi.fn(),
	telegramGetBotName: vi.fn(),
	telegramConnectAccount: vi.fn(),
	telegramDisconnectAccount: vi.fn()
}));

type StatusResult = Awaited<ReturnType<typeof telegramGetLinkStatus>>;
type BotNameResult = Awaited<ReturnType<typeof telegramGetBotName>>;
type ConnectResult = Awaited<ReturnType<typeof telegramConnectAccount>>;

function ok<T>(data: T) {
	return { data, error: undefined, response: { ok: true, status: 200 } as Response };
}

function renderManager() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: TelegramConnectionManager,
			componentProps: { authToken: 'tok' }
		}
	});
}

describe('TelegramConnectionManager connect error handling', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(telegramGetLinkStatus).mockResolvedValue(
			ok({ connected: false }) as unknown as StatusResult
		);
		vi.mocked(telegramGetBotName).mockResolvedValue(
			ok({ botname: 'revel_bot' }) as unknown as BotNameResult
		);
	});

	it('keeps the dialog open and shows the backend detail when the OTP is rejected', async () => {
		vi.mocked(telegramConnectAccount).mockResolvedValue({
			data: undefined,
			error: { detail: 'Invalid or expired code.' },
			response: { ok: false, status: 400 } as Response
		} as unknown as ConnectResult);
		const user = userEvent.setup();
		renderManager();

		await user.click(await screen.findByRole('button', { name: 'Connect Telegram' }));
		const dialog = await screen.findByRole('dialog');
		await user.type(within(dialog).getByLabelText('Verification Code'), '123456789');
		await user.click(within(dialog).getByRole('button', { name: 'Connect Telegram' }));

		await waitFor(() => expect(telegramConnectAccount).toHaveBeenCalled());
		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('Invalid or expired code.')
		);
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});
});
