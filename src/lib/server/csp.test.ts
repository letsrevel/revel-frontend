import { describe, it, expect } from 'vitest';
import { appendCspApiOrigin } from './csp';

const ORIGIN = 'https://demo-api.letsrevel.io';

describe('appendCspApiOrigin', () => {
	it('appends the runtime origin to connect-src, img-src and media-src', () => {
		const csp =
			"default-src 'self'; connect-src 'self' https://api.github.com; " +
			"img-src 'self' data: blob:; media-src 'self' blob:";
		const result = appendCspApiOrigin(csp, ORIGIN);

		expect(result).toContain(`connect-src 'self' https://api.github.com ${ORIGIN}`);
		expect(result).toContain(`img-src 'self' data: blob: ${ORIGIN}`);
		expect(result).toContain(`media-src 'self' blob: ${ORIGIN}`);
	});

	it('leaves unrelated directives (incl. the script nonce) untouched', () => {
		const csp = "default-src 'self'; script-src 'self' 'nonce-abc123'; connect-src 'self'";
		const result = appendCspApiOrigin(csp, ORIGIN);

		expect(result).toContain("default-src 'self'");
		expect(result).toContain("script-src 'self' 'nonce-abc123'");
		expect(result).toContain(`connect-src 'self' ${ORIGIN}`);
	});

	it('is idempotent when the origin is already present', () => {
		const csp = `connect-src 'self' ${ORIGIN}; img-src 'self' ${ORIGIN}; media-src 'self' ${ORIGIN}`;
		expect(appendCspApiOrigin(csp, ORIGIN)).toBe(csp);
	});

	it('does not match an origin that is a prefix of another token', () => {
		// `https://api.letsrevel.io` must not be treated as already-present just
		// because `https://api.letsrevel.io.evil.com` appears.
		const csp = "connect-src 'self' https://api.letsrevel.io.evil.com";
		const result = appendCspApiOrigin(csp, 'https://api.letsrevel.io');
		expect(result).toBe(
			"connect-src 'self' https://api.letsrevel.io.evil.com https://api.letsrevel.io"
		);
	});

	it('returns the policy unchanged for a non-http(s) origin', () => {
		const csp = "connect-src 'self'";
		expect(appendCspApiOrigin(csp, 'localhost:8000')).toBe(csp);
		expect(appendCspApiOrigin(csp, '')).toBe(csp);
	});
});
