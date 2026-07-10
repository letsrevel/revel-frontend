import { test, expect } from '@playwright/test';

const API_ORIGIN = new URL(process.env.PUBLIC_API_URL ?? 'http://localhost:8000').origin;

// Regression guards for the production Content-Security-Policy.
//
// Two incidents shape these assertions:
// - #440: inline scripts without a nonce are silently blocked by the
//   `script-src 'self'` policy (the dark-mode FOUC — see the sibling spec).
//   Here we pin the policy itself: script-src must stay nonce-based and must
//   never regress to 'unsafe-inline'.
// - #396: the CSP is generated at BUILD time, but the API origin is a RUNTIME
//   setting (PUBLIC_API_URL). hooks.server.ts (handleCsp) appends the runtime
//   origin to connect-src/img-src/media-src; if that patch breaks, every API
//   call from the browser is blocked on deployments where the API origin
//   differs from the app origin (like this preview server: 5173 → 8000).
//
// These run against the production build+preview server (playwright.config.ts
// webServer) — the only place the real CSP is enforced.

function directive(csp: string, name: string): string {
	const match = csp.split(';').find((part) => part.trim().startsWith(`${name} `));
	if (!match) {
		throw new Error(`CSP is missing a ${name} directive: ${csp}`);
	}
	return match;
}

test.describe('production CSP', () => {
	test('document responses carry a nonce-based script-src without unsafe-inline', async ({
		request
	}) => {
		const response = await request.get('/');
		expect(response.ok()).toBeTruthy();

		const csp = response.headers()['content-security-policy'];
		expect(csp, 'CSP header present on document responses').toBeTruthy();

		const scriptSrc = directive(csp, 'script-src');
		expect(scriptSrc).toContain("'self'");
		expect(scriptSrc).toContain("'nonce-");
		expect(scriptSrc).not.toContain("'unsafe-inline'");
	});

	test('runtime API origin is appended to connect-src / img-src / media-src (#396)', async ({
		request
	}) => {
		const response = await request.get('/');
		const csp = response.headers()['content-security-policy'];
		expect(csp).toBeTruthy();

		for (const name of ['connect-src', 'img-src', 'media-src']) {
			expect(directive(csp, name), `${name} allows the runtime API origin`).toContain(API_ORIGIN);
		}
	});
});
