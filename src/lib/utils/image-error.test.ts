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
});
