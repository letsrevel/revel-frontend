import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { gotoHydrated } from '../../support/navigation';

// Cross-cutting WCAG 2.1 AA smoke (@axe-core) over the key pages, public and
// authenticated. Guards against NEW serious/critical violations — the page
// set is small on purpose; deep audits stay with the accessibility-checker
// flow, not E2E.

interface PageCase {
	name: string;
	path: string;
	persona?: 'asUser' | 'asOwner';
}

/**
 * KNOWN pre-existing serious/critical violation RULES, baselined 2026-07-10
 * so the smoke can gate NEW violation classes while the backlog is burned
 * down (issue #595). Rule-level (not per-page): which page trips which rule
 * varies with seeded/arranged data, and a flapping gate is worse than a
 * coarser one. DO NOT add to this list — fix the violation instead.
 */
const BASELINE = new Set([
	'nested-interactive', // footer version tooltips (buttons wrapping links), every page
	'aria-prohibited-attr',
	'aria-allowed-attr',
	'color-contrast',
	'document-title', // /dashboard renders without a <title>
	'definition-list' // ticket cards' <dl> structure
]);

const PAGES: PageCase[] = [
	{ name: 'landing', path: '/' },
	{ name: 'events list', path: '/events' },
	{ name: 'event detail', path: '/events/revel-events-collective/summer-sunset-music-festival' },
	{ name: 'organizations', path: '/organizations' },
	{ name: 'org profile', path: '/org/revel-events-collective' },
	{ name: 'login', path: '/login' },
	{ name: 'dashboard', path: '/dashboard', persona: 'asUser' },
	{ name: 'my tickets', path: '/dashboard/tickets', persona: 'asUser' },
	{ name: 'account profile', path: '/account/profile', persona: 'asUser' },
	{
		name: 'org admin events',
		path: '/org/revel-events-collective/admin/events',
		persona: 'asOwner'
	}
];

async function scan(page: Page, path: string, name: string): Promise<void> {
	await gotoHydrated(page, path);
	const results = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze();

	const severe = results.violations.filter(
		(v) => (v.impact === 'serious' || v.impact === 'critical') && !BASELINE.has(v.id)
	);
	const report = severe
		.map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`)
		.join('\n');
	expect(severe, `NEW serious/critical axe violations on ${name}:\n${report}`).toHaveLength(0);
}

test.describe('a11y smoke (axe, WCAG 2.1 AA) @p1', () => {
	for (const pageCase of PAGES.filter((p) => !p.persona)) {
		test(`${pageCase.name} has no serious/critical violations`, async ({ page }) => {
			await scan(page, pageCase.path, pageCase.name);
		});
	}

	for (const pageCase of PAGES.filter((p) => p.persona)) {
		test(`${pageCase.name} has no serious/critical violations`, async ({ asUser, asOwner }) => {
			const page = pageCase.persona === 'asOwner' ? asOwner : asUser;
			await scan(page, pageCase.path, pageCase.name);
		});
	}
});
