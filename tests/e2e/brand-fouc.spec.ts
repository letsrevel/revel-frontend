import { test, expect, type Page } from '@playwright/test';

// Seed the brand preference before any document script runs, so the inline
// anti-FOUC script sees it on the very first paint.
async function seedBrand(page: Page, brand: string): Promise<void> {
	await page.addInitScript((value: string) => {
		window.localStorage.setItem('revel-brand', value);
	}, brand);
}

// Companion to dark-mode-fouc.spec.ts, for the brand experiment (#523). A
// synchronous, nonced inline script in app.html applies the `data-brand`
// attribute before first paint so testers on a candidate theme don't see a
// Legacy flash on SSR loads. The Header renders both the Legacy wordmark and the
// "let's revel." lockup and toggles them via CSS on that attribute, so SSR and
// client markup match (no hydration mismatch).
//
// These run against the production build+preview server (see
// playwright.config.ts), where the CSP is enforced — the only place the
// nonce/FOUC behaviour actually reproduces.

test.describe('brand anti-FOUC (#523)', () => {
	test('serves a nonced anti-FOUC script that the CSP allow-lists', async ({ request }) => {
		const response = await request.get('/');
		expect(response.ok()).toBeTruthy();

		const html = await response.text();

		// Isolate the brand script (a single <script> whose body mentions the
		// storage key) without crossing into the neighbouring dark-mode script.
		const scriptMatch = html.match(
			/<script nonce="([^"]+)">((?:(?!<\/script>)[\s\S])*?revel-brand(?:(?!<\/script>)[\s\S])*?)<\/script>/
		);
		if (!scriptMatch) {
			throw new Error(
				'brand anti-FOUC inline script with a nonce is not present in the served HTML'
			);
		}
		const [scriptTag, nonce] = scriptMatch;
		expect(scriptTag).not.toMatch(/\b(defer|async)\b/);
		expect(nonce.length).toBeGreaterThan(0);

		const csp = response.headers()['content-security-policy'];
		expect(csp, 'a CSP header is present in production').toBeTruthy();
		expect(csp).toContain(`'nonce-${nonce}'`);
	});

	test('applies data-brand and the lockup logo before hydration for a brand user', async ({
		page
	}) => {
		const hydrationWarnings: string[] = [];
		page.on('console', (msg) => {
			if (/hydrat/i.test(msg.text())) hydrationWarnings.push(msg.text());
		});

		await seedBrand(page, 'midnight');
		await page.goto('/');

		await expect(page.locator('html')).toHaveAttribute('data-brand', 'midnight');
		// The header shows the "let's revel." lockup and hides the Legacy wordmark.
		await expect(page.locator('.revel-logo-lockup').first()).toBeVisible();
		await expect(page.locator('.revel-logo-legacy').first()).toBeHidden();
		// The dual-render + CSS toggle must not produce a hydration mismatch.
		expect(hydrationWarnings, hydrationWarnings.join('\n')).toHaveLength(0);
	});

	test('leaves Legacy untouched when no brand is selected', async ({ page }) => {
		await page.goto('/');

		expect(await page.locator('html').getAttribute('data-brand')).toBeNull();
		await expect(page.locator('.revel-logo-legacy').first()).toBeVisible();
		await expect(page.locator('.revel-logo-lockup').first()).toBeHidden();
	});

	test('ignores an unknown stored brand value', async ({ page }) => {
		await seedBrand(page, 'bogus');
		await page.goto('/');

		expect(await page.locator('html').getAttribute('data-brand')).toBeNull();
		await expect(page.locator('.revel-logo-legacy').first()).toBeVisible();
	});
});
