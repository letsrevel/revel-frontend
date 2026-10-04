// @vitest-environment node
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

// Server-side sanitizing (isomorphic-dompurify) loads jsdom, which loads its own
// undici. Importing undici installs its agent as the global dispatcher behind
// Node's built-in fetch. In undici <8.11.2 the compat wrapper dropped every
// response header for HTTPS (HTTP/2) responses, so SSR API calls lost
// Content-Type/Content-Encoding and the generated client returned raw streams:
// account-page 500s and "Invalid response from server" on login.
//
// ponytail: pins the version jsdom resolves instead of exercising a live HTTP/2
// round-trip (needs a TLS server + throwaway cert). If undici is ever bumped
// across a major, replace this with an h2 fetch test against a local server.
const requireFromJsdom = createRequire(createRequire(import.meta.url).resolve('jsdom'));

const [major, minor, patch] = (
	requireFromJsdom('undici/package.json') as { version: string }
).version
	.split('.')
	.map(Number);

describe("jsdom's undici", () => {
	it('is a release whose global dispatcher keeps built-in fetch headers (>=8.11.2)', () => {
		const fixed = major > 8 || (major === 8 && (minor > 11 || (minor === 11 && patch >= 2)));
		expect(fixed).toBe(true);
	});
});
