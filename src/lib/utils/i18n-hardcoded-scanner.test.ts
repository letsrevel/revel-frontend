import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs build script, no type declarations
import { scanSource, isSentence } from '../../../scripts/check-i18n-hardcoded.mjs';

const scan = scanSource as (content: string, file: string) => string[];
const sentence = isSentence as (s: string) => boolean;

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

/**
 * Contract for the structural rules (4-8) of `scripts/check-i18n-hardcoded.mjs`:
 * server errors, <title>, zod messages, attribute expressions, UI-copy assignments.
 * Each rule has a positive case (leak is reported) and a negative case (not reported).
 */
describe('rule 4: server errors', () => {
	it('flags a literal in error(status, ...) and error(status, { message })', () => {
		const src = `export const load = () => {
	if (!x) error(404, 'Event not found');
	if (!y) error(403, { message: 'You may not do this' });
};`;
		expect(scan(src, 'src/routes/a/+page.server.ts')).toEqual([
			'server-error: Event not found',
			'server-error: You may not do this'
		]);
	});

	it('flags a sentence in fail(status, { key })', () => {
		const src = `return fail(400, { error: 'Something went wrong here', code: 'bad_request' });`;
		expect(scan(src, 'src/routes/a/+page.server.ts')).toEqual([
			'server-error: Something went wrong here'
		]);
	});

	it('ignores translated errors, enum tokens, other files and dev errors', () => {
		const src = `error(404, m['serverErrors.common.notFound']());
return fail(400, { errors: { email: 'duplicate' }, kind: 'email_taken' });
throw new Error('Cannot happen in production');
log.error('Upstream request failed badly', { x: 1 });`;
		expect(scan(src, 'src/routes/a/+page.server.ts')).toEqual([]);
		// the same call outside a server/load file is not rule 4's business
		expect(scan(`error(404, 'Event not found');`, 'src/lib/utils/x.ts')).toEqual([]);
	});
});

describe('rule 5: <svelte:head> <title>', () => {
	it('flags literal words in a title', () => {
		const src = `<svelte:head>
	<title>{org.name} Admin Dashboard | Revel</title>
</svelte:head>`;
		expect(scan(src, 'Page.svelte')).toEqual(['title: {org.name} Admin Dashboard | Revel']);
	});

	it('ignores translated titles, brand-only separators, meta and JSON-LD', () => {
		const src = `<svelte:head>
	<title>{m['page.title']()} | Revel</title>
	<meta name="description" content="Plenty of English words in here" />
	<script type="application/ld+json">{"name": "Some Literal Name"}</script>
</svelte:head>`;
		expect(scan(src, 'Page.svelte')).toEqual([]);
	});
});

describe('rule 6: zod messages', () => {
	it('flags literal messages on min/max/email/refine/{ message }', () => {
		const src = `import { z } from 'zod';
export const s = z.object({
	a: z.string().min(1, 'Name is required'),
	b: z.string().email('Enter a valid email'),
	c: z.string().refine((v) => v.length > 2, { message: 'Too short for us' }),
	d: z.string().max(10, { message: 'Ten at most please' })
});`;
		expect(scan(src, 'src/lib/schemas/s.ts')).toEqual([
			'zod: Enter a valid email',
			'zod: Name is required',
			'zod: Ten at most please',
			'zod: Too short for us'
		]);
	});

	it('ignores translated messages, non-zod files and string-method calls', () => {
		const zodSrc = `import { z } from 'zod';
export const s = z.object({ a: z.string().min(1, m['schemas.required']()) });
const found = text.includes('already in use');`;
		expect(scan(zodSrc, 'src/lib/schemas/s.ts')).toEqual([]);
		expect(scan(`const r = { note: 'Plain words here' };`, 'src/lib/utils/x.ts')).toEqual([]);
	});
});

describe('rule 7: attribute expressions', () => {
	it('flags literals in a ternary, a plain literal and a template', () => {
		const src = `<button aria-label={open ? 'Close menu' : 'Open menu'}>x</button>
<img alt={'Cover image'} src={u} />
<input placeholder={\`Search \${kind} here\`} />`;
		expect(scan(src, 'A.svelte')).toEqual(
			[
				"attr-expr: aria-label={... 'Close menu' ...}",
				"attr-expr: aria-label={... 'Open menu' ...}",
				"attr-expr: alt={... 'Cover image' ...}",
				"attr-expr: placeholder={... 'Search {x} here' ...}"
			].sort()
		);
	});

	it('ignores m.*() calls (even with literal args), tokens and non-UI attributes', () => {
		const src = `<button aria-label={open ? m['nav.close']() : m.open({ kind: 'Some Kind' })}>x</button>
<a title={order === 'asc' ? 'start' : '-start'}>y</a>
<div class={big ? 'Large Mode' : 'small'}>z</div>`;
		expect(scan(src, 'A.svelte')).toEqual([]);
	});
});

describe('rule 8: UI-copy assignments', () => {
	it('flags sentence literals on copy-named variables and properties', () => {
		const src = `<script lang="ts">
	let errorMessage = $state<string | null>('Failed to load the thing');
	const items = [{ label: 'Create Event', id: 'create-event' }];
</script>`;
		expect(scan(src, 'A.svelte')).toEqual([
			'copy: errorMessage = Failed to load the thing',
			'copy: label = Create Event'
		]);
	});

	it('ignores enum tokens, css classes, urls, non-copy names and log/throw lines', () => {
		const src = `const status = 'Failed to load the thing';
const labelClass = 'text-sm font-bold';
const title = 'pending_review';
const description = 'https://example.com/a b';
const message = 'Single';
throw new Error('Cannot render this tree');
console.warn('Unexpected state here', { message: 'Nobody sees this' });`;
		expect(scan(src, 'src/lib/utils/x.ts')).toEqual([]);
	});

	it('honours i18n-ignore on the same or previous line', () => {
		const src = `// i18n-ignore
const errorMessage = 'Failed to load the thing';
const label = 'Create Event'; // i18n-ignore`;
		expect(scan(src, 'src/lib/utils/x.ts')).toEqual([]);
	});

	it('isSentence: needs >=2 words, a capital and a lowercase word', () => {
		expect(sentence('Failed to save')).toBe(true);
		expect(sentence('failed to save')).toBe(false);
		expect(sentence('Pending')).toBe(false);
		expect(sentence('PENDING REVIEW')).toBe(false);
		expect(sentence('Hello https://x.y/z')).toBe(false);
	});
});

describe('widened shapes (review round)', () => {
	it('rule 4: any first argument, nested fail objects, ternary values', () => {
		const src = `error(res.status, 'Upstream refused the request');
return fail(400, { errors: { email: 'That address is taken' }, note: ok ? 'All good here' : 'Not so good' });`;
		expect(scan(src, 'src/routes/a/+page.server.ts')).toEqual([
			'server-error: All good here',
			'server-error: Not so good',
			'server-error: That address is taken',
			'server-error: Upstream refused the request'
		]);
	});

	it('rule 5: HTML entities are not prose', () => {
		const src = `<svelte:head><title>{m['a.b']()} &middot; {org.name} &mdash; Revel</title></svelte:head>`;
		expect(scan(src, 'P.svelte')).toEqual([]);
	});

	it('rule 6: a regex literal with a quote does not hide the message', () => {
		const src = `import { z } from 'zod';
export const s = z.string().regex(/^[^']+$/, 'No quotes allowed here');`;
		expect(scan(src, 'src/lib/schemas/s.ts')).toEqual(['zod: No quotes allowed here']);
	});

	it('rule 6: zod 4 { error } literals, but not { error: () => m[..]() }', () => {
		const src = `import { z } from 'zod';
export const s = z.object({
	a: z.string().min(1, { error: 'Name is required' }),
	b: z.string().max(5, { error: () => m['x.y']() })
});`;
		expect(scan(src, 'src/lib/schemas/s.ts')).toEqual(['zod: Name is required']);
	});

	it('rule 7: data-title and other prefixed attributes are not title', () => {
		expect(scan(`<div data-title={a ? 'Some Words' : 'Other Words'}></div>`, 'A.svelte')).toEqual(
			[]
		);
	});

	it('rule 8: if-statements, this., arrow bodies and ternaries', () => {
		const src = `<script lang="ts">
	if (bad) errorMessage = 'Could not save it';
	this.statusMessage = 'Everything went fine';
	const f = () => resendError = 'Try again later';
	const noteText = ok ? 'Saved your changes' : 'Nothing was saved';
	const label = format(x, 'Not a branch literal');
</script>`;
		expect(scan(src, 'A.svelte')).toEqual([
			'copy: errorMessage = Could not save it',
			'copy: noteText = Nothing was saved',
			'copy: noteText = Saved your changes',
			'copy: resendError = Try again later',
			'copy: statusMessage = Everything went fine'
		]);
	});

	it('rule 8: dedup compares exact literals, not substrings', () => {
		const src = `error(404, 'Not found');
const errorMessage = 'Not found anywhere at all';`;
		expect(scan(src, 'src/routes/a/+page.server.ts')).toEqual([
			'copy: errorMessage = Not found anywhere at all',
			'server-error: Not found'
		]);
	});
});

describe('CodeRabbit round', () => {
	it('rule 6: a response body is not a zod message, a zod { message } still is', () => {
		const src = `import { z } from 'zod';
export const s = z.object({ a: z.string().min(1, { message: 'Name is required' }) });
export const GET = () => json({ error: 'Invalid request payload' }, { status: 400 });
const body = { message: 'Something went sideways' };`;
		expect(scan(src, 'src/routes/api/x/+server.ts')).toEqual(['zod: Name is required']);
	});

	it('rule 8: type annotations (union, generic, plain) do not hide the literal', () => {
		const src = `const errorMessage: string | null = 'Failed to load it';
let saveError: Array<string> | undefined = 'Could not save it';
const loadError: string = 'Could not load it';`;
		expect(scan(src, 'src/lib/utils/x.ts')).toEqual([
			'copy: errorMessage = Failed to load it',
			'copy: loadError = Could not load it',
			'copy: saveError = Could not save it'
		]);
	});

	it('i18n-ignore on one occurrence never suppresses an identical one elsewhere', () => {
		const src = `import { z } from 'zod';
// i18n-ignore: fixture
const s = z.string().min(1, 'Name is required');
const errorMessage = 'Name is required';
let other = z.string().min(1, 'Name is required');`;
		expect(scan(src, 'src/lib/schemas/x.ts')).toEqual([
			'copy: errorMessage = Name is required',
			'zod: Name is required'
		]);
	});
});
