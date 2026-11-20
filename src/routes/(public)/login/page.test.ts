import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SubmitFunction } from '@sveltejs/kit';
import Page from './+page.svelte';

type Handler = SubmitFunction;
const handlers = new Map<string, Handler>();
// What applyAction does in the app: swap the page's `form` prop.
let applyHook: () => Promise<void> = async () => undefined;

vi.mock('$app/forms', () => ({
	// Capture each form's submit handler keyed by its action so tests can drive
	// the result callback the way SvelteKit would.
	enhance: (node: HTMLFormElement, fn: Handler) => {
		handlers.set(node.getAttribute('action')?.split('&')[0] ?? '', fn);
		return { destroy: () => undefined };
	},
	applyAction: vi.fn(() => applyHook())
}));
vi.mock('$app/state', () => ({
	page: { url: new URL('https://example.test/login'), data: {} }
}));
vi.mock('$lib/seo', async () => ({
	SeoHead: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
vi.mock('$lib/stores/app.svelte', () => ({ appStore: { isDemoMode: false } }));

const baseData = { seo: {}, demo: false, ssoProviders: [] } as never;
const twoFactorForm = { requires2FA: true, tempToken: 'tmp', email: 'a@example.com' };
const restartForm = {
	errors: { form: "That didn't work. Please sign in again." },
	restartedFrom2FA: true,
	email: 'a@example.com'
};

async function submit(action: string, result: unknown): Promise<void> {
	const fn = handlers.get(action);
	if (!fn) throw new Error(`no handler for ${action}`);
	const callback = (await fn({} as never)) as (opts: { result: unknown }) => Promise<void>;
	await callback({ result });
}

function codeInputs(): HTMLInputElement[] {
	return Array.from({ length: 6 }, (_, i) => document.getElementById(`otp-input-${i}`)).filter(
		(el): el is HTMLInputElement => el instanceof HTMLInputElement
	);
}

function typeCode(code: string): void {
	const first = codeInputs()[0];
	const paste = new Event('paste', { bubbles: true, cancelable: true });
	Object.defineProperty(paste, 'clipboardData', { value: { getData: () => code } });
	first.dispatchEvent(paste);
}

beforeEach(() => {
	handlers.clear();
	applyHook = async () => undefined;
});

describe('login 2FA restart', () => {
	it('does not carry the old wrong code into the next code step', async () => {
		const { rerender } = render(Page, { data: baseData, form: twoFactorForm as never });
		typeCode('111111');
		const verify = () => screen.getByRole('button', { name: /verify/i });
		await waitFor(() => expect(verify()).toBeEnabled());

		// Wrong code: server restarts at the password step.
		applyHook = () => rerender({ data: baseData, form: restartForm as never });
		await submit('?/verify2FA', { type: 'failure', status: 401, data: restartForm });
		expect(document.getElementById('password')).not.toBeNull();

		// Password accepted: code step is entered again with an empty code.
		applyHook = () => rerender({ data: baseData, form: { ...twoFactorForm } as never });
		await submit('?/login', { type: 'success', status: 200, data: twoFactorForm });
		await waitFor(() => expect(codeInputs()).toHaveLength(6));
		expect(codeInputs().map((i) => i.value)).toEqual(['', '', '', '', '', '']);
		expect(verify()).toBeDisabled();
	});

	it('clears a stale code when a successful password step enters the code step', async () => {
		const { rerender } = render(Page, { data: baseData, form: null });
		// The password form registered its handler; now show the code step with a code typed.
		await rerender({ data: baseData, form: twoFactorForm as never });
		typeCode('222222');
		await waitFor(() =>
			expect(
				codeInputs()
					.map((i) => i.value)
					.join('')
			).toBe('222222')
		);
		applyHook = () => rerender({ data: baseData, form: { ...twoFactorForm } as never });
		await submit('?/login', { type: 'success', status: 200, data: twoFactorForm });
		expect(
			codeInputs()
				.map((i) => i.value)
				.join('')
		).toBe('');
	});

	it('announces the restart notice in a polite status region and focuses the password field', async () => {
		const { rerender } = render(Page, { data: baseData, form: twoFactorForm as never });
		applyHook = () => rerender({ data: baseData, form: restartForm as never });
		await submit('?/verify2FA', { type: 'failure', status: 401, data: restartForm });
		const region = document.getElementById('login-restart-notice');
		expect(region).toHaveAttribute('role', 'status');
		expect(region).toHaveTextContent("That didn't work. Please sign in again.");
		expect(screen.queryByRole('alert')).toBeNull();
		await waitFor(() => expect(document.activeElement).toBe(document.getElementById('password')));
	});

	it('other form errors keep role=alert', () => {
		render(Page, {
			data: baseData,
			form: { errors: { form: 'Invalid credentials' }, email: 'a@example.com' } as never
		});
		expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
	});
});

describe('login 2FA restart in demo mode', () => {
	it('falls back to the demo account dropdown for focus', async () => {
		const demoData = { seo: {}, demo: true, ssoProviders: [] } as never;
		const { rerender } = render(Page, { data: demoData, form: twoFactorForm as never });
		applyHook = () => rerender({ data: demoData, form: restartForm as never });
		await submit('?/verify2FA', { type: 'failure', status: 401, data: restartForm });
		expect(document.getElementById('password')).toBeNull();
		await waitFor(() =>
			expect(document.activeElement).toBe(document.getElementById('demo-account'))
		);
	});
});
