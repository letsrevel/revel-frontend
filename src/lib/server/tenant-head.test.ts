import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { rewriteHeadForTenant, TENANT_MANIFEST_PATH } from './tenant-head';
import type { TenantOrganizationSchema } from '$lib/api/generated/types.gen';

// The REAL shell, with the SvelteKit placeholders SvelteKit would have filled.
const shell = readFileSync(resolve(process.cwd(), 'src/app.html'), 'utf-8')
	.replaceAll('%sveltekit.assets%', '')
	.replaceAll('%paraglide.lang%', 'en')
	.replaceAll('%paraglide.textDirection%', 'ltr')
	.replaceAll('%revel.rootAttributes%', '');

const tenant = {
	id: 'o1',
	slug: 'acme',
	name: 'Acme "Club"',
	logo: '/media/logos/acme.png',
	logo_thumbnail_url: '/media/logos/acme-thumb.png',
	accept_membership_requests: false,
	has_membership_plans: false,
	has_resources: false
} as TenantOrganizationSchema;

describe('rewriteHeadForTenant (against the real app.html)', () => {
	it('the platform shell carries every tag the rewrite targets', () => {
		for (const needle of [
			'rel="icon"',
			'rel="apple-touch-icon"',
			'name="theme-color"',
			'rel="manifest"',
			'application/rss+xml',
			'rel="search"'
		]) {
			expect(shell).toContain(needle);
		}
	});

	it('swaps favicon, apple icon, theme color, manifest and feed title; drops opensearch', () => {
		const out = rewriteHeadForTenant(shell, tenant);
		expect(out.match(/rel="icon"/g)).toHaveLength(1);
		expect(out).toMatch(/<link rel="icon" href="[^"]*acme-thumb\.png" \/>/);
		expect(out).toMatch(/<link rel="apple-touch-icon" href="[^"]*acme-thumb\.png" \/>/);
		expect(out).toContain('<meta name="theme-color" content="#8C3CDD" />');
		expect(out).toContain(`<link rel="manifest" href="${TENANT_MANIFEST_PATH}" />`);
		expect(out).toContain('title="Acme &quot;Club&quot; Events Feed"');
		expect(out).not.toContain('opensearch.xml');
		// Comments are never removed (SvelteKit's hydration-safety check counts them).
		expect((out.match(/<!--/g) ?? []).length).toBe((shell.match(/<!--/g) ?? []).length);
		expect(out).not.toContain('logo-v2.svg');
		expect(out).not.toContain('Revel Events Feed');
	});

	it('uses brand_theme.light.primary for theme-color when the backend sends it', () => {
		const out = rewriteHeadForTenant(shell, {
			...tenant,
			brand_theme: { light: { primary: '#123456' } }
		} as TenantOrganizationSchema);
		expect(out).toContain('<meta name="theme-color" content="#123456" />');
	});

	it('keeps Revel icons when the org has no logo', () => {
		const out = rewriteHeadForTenant(shell, { ...tenant, logo: null, logo_thumbnail_url: null });
		expect(out).toContain('/favicon-v2.png');
		expect(out).toContain('/apple-touch-icon-v2.png');
	});

	it('keeps replacement patterns in the org name literal', () => {
		const out = rewriteHeadForTenant(shell, { ...tenant, name: "Rock$'n$`Roll$&" });
		expect(out).toContain('title="Rock$\'n$`Roll$&amp; Events Feed"');
		// No copy of the surrounding document was spliced in.
		expect(out.match(/<head>/g)).toHaveLength(1);
	});
});
