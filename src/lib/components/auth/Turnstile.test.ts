import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import Turnstile from './Turnstile.svelte';

afterEach(() => {
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
});
