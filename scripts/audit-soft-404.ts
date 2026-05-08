#!/usr/bin/env tsx
// scripts/audit-soft-404.ts
const BASE = process.env.AUDIT_BASE_URL ?? 'http://localhost:4173';

async function check(url: string): Promise<{ url: string; status: number; noindex: boolean }> {
	const res = await fetch(url);
	const text = await res.text();
	const noindex = /<meta\s+name=["']robots["']\s+content=["']noindex/i.test(text);
	return { url, status: res.status, noindex };
}

async function main() {
	const sitemap = await (await fetch(`${BASE}/sitemap-static.xml`)).text();
	const urls = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);

	const violations: string[] = [];
	for (const u of urls) {
		const r = await check(u);
		if (r.status === 200 && r.noindex) {
			violations.push(`200+noindex on a sitemap URL: ${u}`);
		}
		if (r.status >= 500) {
			violations.push(`5xx on a sitemap URL: ${u} (${r.status})`);
		}
	}

	const missing = await check(`${BASE}/events/__nope__/__nope__`);
	if (missing.status !== 404) {
		violations.push(`Expected 404 on /events/__nope__/__nope__ but got ${missing.status}`);
	}

	if (violations.length === 0) {
		console.log('✓ soft-404 audit clean');
		return;
	}
	console.error(`✗ ${violations.length} soft-404 violations:`);
	violations.forEach((v) => console.error('  ' + v));
	process.exit(1);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
