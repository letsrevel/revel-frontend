import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { scrollToFirstInvalid } from './scroll';

beforeAll(() => {
	// jsdom doesn't implement scrollIntoView. Stub it on the prototype so per-element
	// `vi.spyOn(el, 'scrollIntoView')` works in each test.
	if (!Element.prototype.scrollIntoView) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(Element.prototype as any).scrollIntoView = () => {};
	}
});

afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

/**
 * `scrollToFirstInvalid` defers its work to the next animation frame so the
 * caller can set state synchronously. Wait one frame in tests.
 */
function nextFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

describe('scrollToFirstInvalid', () => {
	it('scrolls the first element matching [aria-invalid="true"] into view, smooth + center', async () => {
		const a = document.createElement('input');
		a.setAttribute('aria-invalid', 'true');
		const b = document.createElement('input');
		b.setAttribute('aria-invalid', 'true');
		document.body.append(a, b);

		const spyA = vi.spyOn(a, 'scrollIntoView').mockImplementation(() => {});
		const spyB = vi.spyOn(b, 'scrollIntoView').mockImplementation(() => {});

		scrollToFirstInvalid();
		await nextFrame();

		expect(spyA).toHaveBeenCalledTimes(1);
		expect(spyA).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
		expect(spyB).not.toHaveBeenCalled();
	});

	it('is a no-op when no element is marked aria-invalid', async () => {
		const input = document.createElement('input');
		document.body.append(input);
		const spy = vi.spyOn(input, 'scrollIntoView').mockImplementation(() => {});

		scrollToFirstInvalid();
		await nextFrame();

		expect(spy).not.toHaveBeenCalled();
	});

	it('ignores aria-invalid="false" (matches only "true")', async () => {
		const input = document.createElement('input');
		input.setAttribute('aria-invalid', 'false');
		document.body.append(input);
		const spy = vi.spyOn(input, 'scrollIntoView').mockImplementation(() => {});

		scrollToFirstInvalid();
		await nextFrame();

		expect(spy).not.toHaveBeenCalled();
	});
});
