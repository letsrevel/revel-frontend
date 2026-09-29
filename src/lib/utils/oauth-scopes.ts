import * as m from '$lib/paraglide/messages.js';
import type { AuthorizeScopeSchema } from '$lib/api/generated/types.gen';

/**
 * Presentation helpers for the OAuth scope vocabulary. Labels are the
 * BACKEND's (translated by gettext per Accept-Language, `GET /api/oauth/scopes/`
 * and the consent description); the frontend owns only the three group
 * headings and the money marker.
 */
export type ScopeGroup = AuthorizeScopeSchema['group'];

export const GROUP_ORDER: readonly ScopeGroup[] = ['identity', 'me', 'org'];

/** Scopes whose backend label promises refunds and revenue (spec §Scopes). */
export const MONEY_SCOPES: ReadonlySet<string> = new Set(['org:tickets', 'org:members']);

export function involvesMoney(name: string): boolean {
	return MONEY_SCOPES.has(name);
}

const GROUP_HEADINGS: Record<ScopeGroup, () => string> = {
	identity: m['oauth.scopes.group_identity'],
	me: m['oauth.scopes.group_me'],
	org: m['oauth.scopes.group_org']
};

export function groupHeading(group: ScopeGroup): string {
	return GROUP_HEADINGS[group]();
}

/**
 * Rows for a list of scope NAMES (the connections endpoint returns names
 * sorted alphabetically). Ordered by vocabulary position; a name the
 * vocabulary does not know keeps its raw name as the label and lands last,
 * in the `org` group, so a scope the token still carries is never hidden.
 */
export function rowsFor(
	names: readonly string[],
	vocabulary: readonly AuthorizeScopeSchema[]
): AuthorizeScopeSchema[] {
	const index = new Map(vocabulary.map((row, i) => [row.name, i] as const));
	const known = names
		.filter((name) => index.has(name))
		.sort((a, b) => (index.get(a) ?? 0) - (index.get(b) ?? 0))
		.map((name) => vocabulary[index.get(name) as number]);
	const unknown = names
		.filter((name) => !index.has(name))
		.map((name): AuthorizeScopeSchema => ({ name, label: name, group: 'org' }));
	return [...known, ...unknown];
}

export interface ScopeGroupRows {
	group: ScopeGroup;
	rows: AuthorizeScopeSchema[];
}

/** Rows bucketed by group in `GROUP_ORDER`; input order kept inside a group; empty groups omitted. */
export function groupScopes(rows: readonly AuthorizeScopeSchema[]): ScopeGroupRows[] {
	return GROUP_ORDER.map((group) => ({
		group,
		rows: rows.filter((row) => row.group === group)
	})).filter((bucket) => bucket.rows.length > 0);
}
