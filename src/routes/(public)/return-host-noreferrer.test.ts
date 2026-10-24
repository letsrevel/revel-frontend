import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// The account-token pages (#1070) offer "Continue to {org}" back to the
// custom domain. Their own URL carries the token (the unsubscribe token is
// reusable), so every such link sends no Referer, whatever referrer policy is
// in force. Source scan: each link built from `returnTo.origin` is checked.
const PAGES = [
	'src/routes/(public)/verify/+page.svelte',
	'src/routes/(public)/unsubscribe/+page.svelte',
	'src/routes/(public)/account/confirm-deletion/+page.svelte',
	'src/routes/(public)/account/confirm-email-change/+page.svelte',
	'src/routes/(public)/login/reset-password/+page.svelte'
];

/** The opening tag of every element whose href starts at `returnTo.origin`. */
function returnLinks(source: string): string[] {
	return [...source.matchAll(/<(?:a|Button)\b[^>]*returnTo\.origin[^>]*>/g)].map((m) => m[0]);
}

describe('Continue-to-tenant links on account-token pages', () => {
	it.each(PAGES)('%s sends no Referer to the custom domain', (path) => {
		const links = returnLinks(readFileSync(resolve(process.cwd(), path), 'utf-8'));
		expect(links.length, 'the page renders a return link').toBeGreaterThan(0);
		for (const tag of links) {
			expect(tag).toMatch(/\brel="[^"]*\bnoreferrer\b[^"]*"/);
		}
	});
});
