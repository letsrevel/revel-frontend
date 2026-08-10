import { describe, it, expect } from 'vitest';
import { asHttpUrl } from './url';

describe('asHttpUrl', () => {
	it('accepts https and http URLs', () => {
		expect(asHttpUrl('https://meet.example.com/room/42')).toBe('https://meet.example.com/room/42');
		expect(asHttpUrl('http://example.com')).toBe('http://example.com/');
	});

	it('trims surrounding whitespace', () => {
		expect(asHttpUrl('  https://example.com/x  ')).toBe('https://example.com/x');
	});

	it('rejects non-http(s) schemes', () => {
		expect(asHttpUrl('javascript:alert(1)')).toBeNull();
		expect(asHttpUrl('data:text/html,hi')).toBeNull();
		expect(asHttpUrl('ftp://example.com/file')).toBeNull();
		expect(asHttpUrl('mailto:a@example.com')).toBeNull();
	});

	it('rejects street addresses, relative paths and empties', () => {
		expect(asHttpUrl('Karlsplatz 1, 1040 Wien')).toBeNull();
		expect(asHttpUrl('/join/room')).toBeNull();
		expect(asHttpUrl('example.com/no-scheme')).toBeNull();
		expect(asHttpUrl('')).toBeNull();
		expect(asHttpUrl('   ')).toBeNull();
		expect(asHttpUrl(null)).toBeNull();
		expect(asHttpUrl(undefined)).toBeNull();
	});
});
