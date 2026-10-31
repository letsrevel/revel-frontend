import { describe, it, expect, vi, afterEach } from 'vitest';
import { openInNewTab } from './open-external';

describe('openInNewTab', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('opens the url in a new tab without exposing window.opener', () => {
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
		openInNewTab('https://example.com/x');
		expect(openSpy).toHaveBeenCalledWith('https://example.com/x', '_blank', 'noopener,noreferrer');
	});
});
