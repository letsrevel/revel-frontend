import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Page from './+page.svelte';

vi.mock('$app/forms', () => ({
	enhance: () => ({ destroy: () => undefined }),
	applyAction: vi.fn()
}));
vi.mock('$app/navigation', () => ({ invalidate: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: null } }));

const user = { id: 'u1', email: 'a@example.com', email_verified: true };
const data = { totpActive: false, user } as never;
const uri = 'otpauth://totp/Revel:a@example.com?secret=ABCDEFGHIJKLMNOP&issuer=Revel';

const lockedForm = {
	errors: { code: 'Two-factor verification is paused for your security. Try again in 5 minutes.' },
	totpLocked: true,
	retryAfterSeconds: 300
};

function digitInputs(): HTMLInputElement[] {
	return Array.from({ length: 6 }, (_, i) => document.getElementById(`otp-input-${i}`)).filter(
		(el): el is HTMLInputElement => el instanceof HTMLInputElement
	);
}

afterEach(() => {
	vi.useRealTimers();
});

describe('security page: enable flow keeps its setup UI after a failed verify', () => {
	it('shows the input, error and Cancel after a wrong code', async () => {
		const { rerender } = render(Page, { data, form: { success: true, provisioningUri: uri } });
		await screen.findByRole('button', { name: /cancel/i });
		await rerender({ data, form: { errors: { code: 'Invalid code' } } });
		expect(digitInputs()).toHaveLength(6);
		expect(screen.getByText('Invalid code')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
		expect(screen.queryByText(/loading setup data/i)).toBeNull();
		expect(screen.getByText('ABCDEFGHIJKLMNOP')).toBeInTheDocument();
	});

	it('shows the paused state with disabled inputs after totp_locked, and moves focus to the message', async () => {
		const { rerender } = render(Page, { data, form: { success: true, provisioningUri: uri } });
		await screen.findByRole('button', { name: /cancel/i });
		await rerender({ data, form: lockedForm });
		const message = await screen.findByText(/verification is paused/i);
		expect(message).toHaveAttribute('role', 'status');
		expect(message).toHaveAttribute('tabindex', '-1');
		expect(digitInputs().every((i) => i.disabled)).toBe(true);
		expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
		await waitFor(() => expect(document.activeElement).toBe(message));
	});

	it('a plain error keeps role=alert', async () => {
		const { rerender } = render(Page, { data, form: { success: true, provisioningUri: uri } });
		await screen.findByRole('button', { name: /cancel/i });
		await rerender({ data, form: { errors: { code: 'Invalid code' } } });
		expect(screen.getByText('Invalid code')).toHaveAttribute('role', 'alert');
	});
});

describe('security page: lock recovery', () => {
	it('re-enables the inputs once Retry-After elapses', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const { rerender } = render(Page, { data, form: { success: true, provisioningUri: uri } });
		await screen.findByRole('button', { name: /cancel/i });
		await rerender({ data, form: lockedForm });
		await waitFor(() => expect(digitInputs().every((i) => i.disabled)).toBe(true));
		vi.advanceTimersByTime(299_000);
		expect(digitInputs().every((i) => i.disabled)).toBe(true);
		vi.advanceTimersByTime(2_000);
		await waitFor(() => expect(digitInputs().every((i) => !i.disabled)).toBe(true));
		// The "try again in N minutes" text is stale once the lock has run out.
		expect(document.getElementById('totp-code-error')).toBeNull();
	});

	it('clears the lock on cancel and reopen of the disable flow', async () => {
		const ev = userEvent.setup();
		const { rerender } = render(Page, {
			data: { totpActive: true, user } as never,
			form: null
		});
		await ev.click(screen.getByRole('button', { name: /disable/i }));
		await rerender({ data: { totpActive: true, user } as never, form: lockedForm });
		await waitFor(() => expect(digitInputs().every((i) => i.disabled)).toBe(true));
		await ev.click(screen.getByRole('button', { name: /cancel/i }));
		await ev.click(screen.getByRole('button', { name: /disable/i }));
		expect(digitInputs().every((i) => !i.disabled)).toBe(true);
	});

	it('does not leave a timer behind when destroyed', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const { rerender, unmount } = render(Page, {
			data,
			form: { success: true, provisioningUri: uri }
		});
		await screen.findByRole('button', { name: /cancel/i });
		await rerender({ data, form: lockedForm });
		await waitFor(() => expect(vi.getTimerCount()).toBeGreaterThan(0));
		const before = vi.getTimerCount();
		unmount();
		expect(vi.getTimerCount()).toBeLessThan(before);
	});
});
