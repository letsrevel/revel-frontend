import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs build script, no type declarations
import { scanSource } from '../../../scripts/check-i18n-hardcoded.mjs';

const scan = scanSource as (content: string, file: string) => string[];

/**
 * Regression contract for `scripts/check-i18n-hardcoded.mjs` (#730).
 *
 * The text-node rule (`>text<`) used to run over the whole file, script bodies
 * included, where the `>` of an arrow function opens a match that runs to the
 * closing `</script>`. Ordinary TypeScript then got reported as untranslated prose.
 */
describe('i18n hardcoded scanner — script bodies', () => {
	it('does not report a concise arrow function as a text node', () => {
		const source = `<script lang="ts">
	let { tier } = $props();
	// a comment, blanked to whitespace before the scan
	const plans = $derived([...tier.plans].sort((a, b) => Number(a.price) - Number(b.price)));
</script>

<p>{plans.length}</p>
`;
		expect(scan(source, 'TierCard.svelte')).toEqual([]);
	});

	it('does not report a comparison operator followed by prose-looking code', () => {
		const source = `<script lang="ts">
	const isBig = total > Some.threshold value
</script>
<div>{isBig}</div>
`;
		expect(scan(source, 'Thing.svelte')).toEqual([]);
	});

	it('still reports genuine untranslated markup text', () => {
		const source = `<script lang="ts">
	const n = 1;
</script>

<p>Your account has been permanently deleted</p>
`;
		expect(scan(source, 'Thing.svelte')).toEqual([
			'text: Your account has been permanently deleted'
		]);
	});

	it('still reports untranslated toast calls and attributes inside script bodies', () => {
		const source = `<script lang="ts">
	function save() {
		toast.success('Your changes were saved');
	}
</script>

<button aria-label="Close the dialog">x</button>
`;
		expect(scan(source, 'Thing.svelte').sort()).toEqual([
			'aria-label="Close the dialog"',
			'toast: Your changes were saved'
		]);
	});
});
