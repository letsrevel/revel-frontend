import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import InvitationFormDialogs from './InvitationFormDialogs.svelte';

type SubmitFn = (input: {
	cancel: () => void;
}) => ((opts: { result: unknown; update: () => Promise<void> }) => Promise<void>) | void;

// Capture each form's enhance submit callback so the test can drive results.
const submits = vi.hoisted(() => [] as SubmitFn[]);
vi.mock('$app/forms', () => ({
	enhance: (_node: HTMLFormElement, submit: SubmitFn) => {
		submits.push(submit);
		return { destroy: () => undefined };
	},
	applyAction: vi.fn()
}));

function renderDialogs() {
	const result = render(InvitationFormDialogs, {
		organizationSlug: 'acme',
		accessToken: null,
		registeredInvitations: [],
		pendingInvitations: [],
		selectedRegisteredIds: new SvelteSet<string>(),
		selectedPendingIds: new SvelteSet<string>(),
		onClearSelections: () => undefined
	});
	flushSync(() => (result.component as unknown as { openCreate: () => void }).openCreate());
	return result;
}

async function addEmails(emails: string[]) {
	const input = await screen.findByRole('combobox', { name: /email/i });
	const user = userEvent.setup();
	for (const email of emails) {
		await user.type(input, `${email}{Enter}`);
	}
}

describe('InvitationFormDialogs create dialog (#987)', () => {
	beforeEach(() => {
		submits.length = 0;
	});

	it('keeps the dialog and every address when the backend refuses (daily budget)', async () => {
		renderDialogs();
		await addEmails(['a@example.com', 'b@example.com']);

		const submit = submits.at(-1);
		if (!submit) throw new Error('enhance not attached');
		const after = submit({ cancel: vi.fn() });
		const update = vi.fn();
		await after?.({
			result: {
				type: 'failure',
				status: 400,
				data: { errors: { form: 'This would exceed today’s invitation limit.' } }
			},
			update
		});

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'This would exceed today’s invitation limit.'
		);
		expect(update).not.toHaveBeenCalled();
		expect(screen.getByText('a@example.com')).toBeInTheDocument();
		expect(screen.getByText('b@example.com')).toBeInTheDocument();
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('blocks sending more than 500 addresses (the endpoint 422s beyond that)', async () => {
		renderDialogs();
		const input = await screen.findByRole('combobox', { name: /email/i });
		const emails = Array.from({ length: 501 }, (_, i) => `u${i}@example.com`).join('\n');
		await fireEvent.paste(input, { clipboardData: { getData: () => emails } });

		expect(await screen.findByRole('alert')).toHaveTextContent(/up to 500 addresses/i);
		expect(screen.getByRole('button', { name: /send invitations/i })).toBeDisabled();

		const cancel = vi.fn();
		expect(submits.at(-1)?.({ cancel })).toBeUndefined();
		expect(cancel).toHaveBeenCalledOnce();
	});

	it('closes and resets on success', async () => {
		renderDialogs();
		await addEmails(['a@example.com']);
		const after = submits.at(-1)?.({ cancel: vi.fn() });
		const update = vi.fn().mockResolvedValue(undefined);
		await after?.({ result: { type: 'success', status: 200, data: {} }, update });
		expect(update).toHaveBeenCalledOnce();
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});
});
