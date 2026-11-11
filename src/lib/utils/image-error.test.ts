import { describe, it, expect, vi } from 'vitest';
import { onImageError } from './image-error';

describe('onImageError', () => {
	it('calls the handler on error and stops after cleanup', () => {
		const handler = vi.fn();
		const img = document.createElement('img');
		const cleanup = onImageError(handler)(img);

		img.dispatchEvent(new Event('error'));
		expect(handler).toHaveBeenCalledTimes(1);

		(cleanup as () => void)();
		img.dispatchEvent(new Event('error'));
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('never writes an inline onerror attribute', () => {
		const img = document.createElement('img');
		onImageError(vi.fn())(img);
		expect(img.hasAttribute('onerror')).toBe(false);
	});

	function settledImage(decode: () => Promise<void>): HTMLImageElement {
		const img = document.createElement('img');
		Object.defineProperty(img, 'complete', { value: true });
		Object.defineProperty(img, 'naturalWidth', { value: 0 });
		Object.defineProperty(img, 'naturalHeight', { value: 0 });
		Object.defineProperty(img, 'currentSrc', { value: 'https://example.test/logo.svg' });
		img.decode = decode;
		return img;
	}

	it('does not flag an already-settled SVG without intrinsic size (decode resolves)', async () => {
		const handler = vi.fn();
		const img = settledImage(() => Promise.resolve());
		onImageError(handler)(img);
		await Promise.resolve();
		await Promise.resolve();
		expect(handler).not.toHaveBeenCalled();
	});

	it('flags an already-failed image once decode rejects', async () => {
		const handler = vi.fn();
		const img = settledImage(() => Promise.reject(new Error('broken')));
		onImageError(handler)(img);
		await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
	});

	it('does not call the handler after cleanup even if decode rejects late', async () => {
		const handler = vi.fn();
		let reject: (e: Error) => void = () => undefined;
		const img = settledImage(() => new Promise<void>((_, r) => (reject = r)));
		const cleanup = onImageError(handler)(img);
		(cleanup as () => void)();
		reject(new Error('late'));
		await Promise.resolve();
		await Promise.resolve();
		expect(handler).not.toHaveBeenCalled();
	});
});
