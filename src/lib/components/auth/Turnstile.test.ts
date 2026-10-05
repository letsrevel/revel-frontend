import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Turnstile from './Turnstile.svelte';

afterEach(() => {
	vi.useRealTimers();
	delete (window as { turnstile?: unknown }).turnstile;
	document.head.querySelectorAll('script[data-turnstile]').forEach((s) => s.remove());
});

function tokenInput(container: HTMLElement): HTMLInputElement {
	return container.querySelector('input[name="turnstileToken"]') as HTMLInputElement;
}

describe('Turnstile', () => {
	it('renders the widget container and an empty hidden token input', () => {
		const { container } = render(Turnstile, { props: { siteKey: 'site-key' } });
		expect(container.querySelector('[data-testid="turnstile"]')).not.toBeNull();
		expect(tokenInput(container).type).toBe('hidden');
		expect(tokenInput(container).value).toBe('');
	});

	it('injects the Cloudflare script once', () => {
		render(Turnstile, { props: { siteKey: 'a' } });
		render(Turnstile, { props: { siteKey: 'a' } });
		expect(document.head.querySelectorAll('script[data-turnstile]')).toHaveLength(1);
	});

	it('renders through window.turnstile and stores the token from the callback', async () => {
		let cb: ((token: string) => void) | undefined;
		window.turnstile = {
			render: vi.fn((_el: HTMLElement, opts: { callback: (token: string) => void }) => {
				cb = opts.callback;
				return 'w1';
			}),
			reset: vi.fn(),
			remove: vi.fn()
		};
		const { container } = render(Turnstile, { props: { siteKey: 'site-key' } });
		await vi.waitFor(() => expect(window.turnstile?.render).toHaveBeenCalled());
		cb?.('tok-123');
		await vi.waitFor(() => expect(tokenInput(container).value).toBe('tok-123'));
	});

	it('shows an inline error and drops the script tag when the script fails to load', async () => {
		render(Turnstile, { props: { siteKey: 'site-key' } });
		const script = document.head.querySelector('script[data-turnstile]') as HTMLScriptElement;
		script.dispatchEvent(new Event('error'));
		expect(await screen.findByRole('alert')).toBeTruthy();
		expect(document.head.querySelector('script[data-turnstile]')).toBeNull();
	});

	it('gives up after the load timeout instead of polling forever', async () => {
		vi.useFakeTimers();
		render(Turnstile, { props: { siteKey: 'site-key' } });
		await vi.advanceTimersByTimeAsync(15_000);
		expect(screen.getByRole('alert')).toBeTruthy();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('shows the inline error when render throws', async () => {
		window.turnstile = {
			render: vi.fn(() => {
				throw new Error('bad sitekey');
			}),
			reset: vi.fn(),
			remove: vi.fn()
		};
		render(Turnstile, { props: { siteKey: 'site-key' } });
		expect(await screen.findByRole('alert')).toBeTruthy();
	});

	it('clears its timers on unmount', () => {
		vi.useFakeTimers();
		const { unmount } = render(Turnstile, { props: { siteKey: 'site-key' } });
		expect(vi.getTimerCount()).toBeGreaterThan(0);
		unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
});
