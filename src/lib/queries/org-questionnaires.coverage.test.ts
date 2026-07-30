/**
 * Structural guard for #722.
 *
 * The behavioural tests prove `invalidateOrgQuestionnaires` works; nothing in
 * them notices when a *new* mutation site forgets to call it — which is exactly
 * how the bug shipped (create was the only path that never invalidated, and no
 * test could see the omission).
 *
 * So: every source file that calls a mutating org-questionnaire SDK operation
 * must either invalidate the cache itself, or be listed below with the file that
 * covers it. Adding a new mutation site fails this test until one of the two is
 * true.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** SDK operations that add, remove, or retype an organization questionnaire. */
const MUTATING_OPERATIONS = [
	'questionnaireCreateOrgQuestionnaire',
	'questionnaireUpdateOrgQuestionnaire',
	'questionnaireDeleteOrgQuestionnaire',
	'questionnaireDuplicateOrgQuestionnaire',
	'questionnaireUpdateQuestionnaireStatus'
] as const;

const INVALIDATOR = 'invalidateOrgQuestionnaires';

/**
 * Mutation sites that legitimately do not invalidate in place, each mapped to
 * the file that invalidates on their behalf. Both halves are checked, so the
 * exemption cannot outlive its cover.
 */
const COVERED_ELSEWHERE: Record<string, string> = {
	// Pure API-sync helper: it takes ids and payloads, not a QueryClient. Its only
	// caller — the questionnaire edit page — invalidates after awaiting it.
	'src/lib/utils/questionnaire-api-sync.ts':
		'src/routes/(auth)/org/[slug]/admin/questionnaires/[id]/+page.svelte',
	// The card deletes and calls `invalidateAll()`, which re-runs the questionnaire
	// admin list's server load; that route drops the client cache on every (re)load.
	'src/lib/components/questionnaires/QuestionnaireCard.svelte':
		'src/routes/(auth)/org/[slug]/admin/questionnaires/+page.svelte'
};

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			// The generated client declares these operations; it never calls them.
			if (full.endsWith(join('lib', 'api', 'generated'))) continue;
			out.push(...sourceFiles(full));
			continue;
		}
		if (!/\.(svelte|ts)$/.test(entry.name)) continue;
		if (/\.(test|spec)\.ts$/.test(entry.name)) continue;
		out.push(full);
	}
	return out;
}

function toPosix(absolute: string): string {
	return `src/${relative(SRC, absolute).split(sep).join('/')}`;
}

describe('org-questionnaire mutation sites', () => {
	const mutationSites = sourceFiles(SRC)
		.map((path) => ({ path: toPosix(path), source: readFileSync(path, 'utf8') }))
		.filter(({ source }) => MUTATING_OPERATIONS.some((op) => source.includes(`${op}(`)));

	it('finds the known mutation sites (the scan itself still works)', () => {
		expect(mutationSites.map((f) => f.path).sort()).toEqual([
			'src/lib/components/questionnaires/DuplicateQuestionnaireModal.svelte',
			'src/lib/components/questionnaires/QuestionnaireCard.svelte',
			'src/lib/utils/questionnaire-api-sync.ts',
			'src/routes/(auth)/org/[slug]/admin/questionnaires/[id]/+page.svelte',
			'src/routes/(auth)/org/[slug]/admin/questionnaires/new/+page.svelte'
		]);
	});

	it('all invalidate the members admin picker, directly or through their cover', () => {
		const uncovered = mutationSites
			.filter(({ path, source }) => {
				if (source.includes(INVALIDATOR)) return false;
				const cover = COVERED_ELSEWHERE[path];
				if (!cover) return true;
				return !readFileSync(join(process.cwd(), cover), 'utf8').includes(INVALIDATOR);
			})
			.map(({ path }) => path);

		expect(uncovered).toEqual([]);
	});

	it('the create page invalidates before it navigates away', () => {
		// The reported symptom (#722): create succeeds, `goto` takes the user to the
		// new questionnaire, and the members admin still lists the pre-create set.
		// An invalidation issued after the navigation can be lost with the unmounting
		// page, so the call has to come first in the handler.
		const createPage = readFileSync(
			join(SRC, 'routes/(auth)/org/[slug]/admin/questionnaires/new/+page.svelte'),
			'utf8'
		);
		const invalidateAt = createPage.indexOf(`${INVALIDATOR}(`);
		const gotoAt = createPage.indexOf('await goto(');
		expect(invalidateAt).toBeGreaterThan(-1);
		expect(gotoAt).toBeGreaterThan(-1);
		expect(invalidateAt).toBeLessThan(gotoAt);
	});

	it('the members admin reads the shared key instead of spelling one inline', () => {
		const membersPage = readFileSync(
			join(SRC, 'routes/(auth)/org/[slug]/admin/members/+page.svelte'),
			'utf8'
		);
		expect(membersPage).toContain('orgQuestionnairesQueryOptions');
		expect(membersPage).not.toContain("'membership-questionnaires'");
	});
});
