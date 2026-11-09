import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
import type { Tone } from '$lib/components/common/tones';
import { filtersToSearch, parseFilters, type RegisterFilters } from './filters';

/** The People tab's group chips. Each one is a preset of the register filters. */
export type PeopleView = 'current' | 'day' | 'ended' | 'no-account' | 'everyone';

export const PEOPLE_VIEWS: readonly PeopleView[] = [
	'current',
	'day',
	'ended',
	'no-account',
	'everyone'
];

/** Shown when the URL carries no group and no legacy filters. */
export const DEFAULT_PEOPLE_VIEW: PeopleView = 'current';

type ViewFilters = Pick<RegisterFilters, 'kind' | 'open' | 'account'>;

/** Chip -> register filters (`kind` / `is_open` / `has_account`). */
export const VIEW_FILTERS: Record<PeopleView, ViewFilters> = {
	current: { kind: 'standard', open: 'open', account: 'all' },
	day: { kind: 'temporary', open: 'all', account: 'all' },
	ended: { kind: null, open: 'closed', account: 'all' },
	'no-account': { kind: null, open: 'all', account: 'without' },
	everyone: { kind: null, open: 'all', account: 'all' }
};

export function isPeopleView(value: string | null | undefined): value is PeopleView {
	return !!value && (PEOPLE_VIEWS as readonly string[]).includes(value);
}

/** The chip a set of filters corresponds to, or null for a combination no chip covers. */
export function viewFromFilters(filters: ViewFilters): PeopleView | null {
	return (
		PEOPLE_VIEWS.find((view) => {
			const preset = VIEW_FILTERS[view];
			return (
				preset.kind === filters.kind &&
				preset.open === filters.open &&
				preset.account === filters.account
			);
		}) ?? null
	);
}

/**
 * Read the People tab's filters from the URL.
 *
 * - `view=<chip>` wins and expands to its preset.
 * - Without `view`, raw `kind` / `status` / `account` params still work (links
 *   from the retired register page); a combination matching a chip lights it.
 * - Without either, the default chip applies ("Current").
 */
export function parsePeopleFilters(params: URLSearchParams): RegisterFilters {
	const base = parseFilters(params);
	const view = params.get('view');
	if (isPeopleView(view)) return { ...base, ...VIEW_FILTERS[view] };
	const hasRaw = base.kind !== null || base.open !== 'all' || base.account !== 'all';
	if (hasRaw) return base;
	return { ...base, ...VIEW_FILTERS[DEFAULT_PEOPLE_VIEW] };
}

/**
 * Serialise People filters to a query (no leading `?`), always on the People
 * tab. The default chip is omitted; a combination no chip covers is written as
 * raw params so it survives a reload.
 */
export function peopleFiltersToSearch(filters: RegisterFilters): string {
	const view = viewFromFilters(filters);
	const params = new URLSearchParams({ tab: 'people' });
	if (view && view !== DEFAULT_PEOPLE_VIEW) params.set('view', view);
	const rest = filtersToSearch(view ? { ...filters, ...VIEW_FILTERS.everyone } : filters);
	for (const [key, value] of new URLSearchParams(rest)) params.set(key, value);
	return params.toString();
}

/** Anything narrowing the list beyond the group chip (drives "clear filters"). */
export function hasExtraFilters(filters: RegisterFilters): boolean {
	return filters.tierId !== null || filters.activeOn !== null || filters.search.trim() !== '';
}

/** Filters for a chip, keeping search / tier / day. Resets the page. */
export function filtersForView(view: PeopleView, current: RegisterFilters): RegisterFilters {
	return { ...current, ...VIEW_FILTERS[view], page: 1 };
}

/** One status per row. Precedence is the order of the checks in `getPersonStatus`. */
export type PersonStatusId = 'active' | 'day-member' | 'ended' | 'no-account' | 'invited';

// TODO(member_status): add a 'paused' status once the backend exposes
// `member_status` on the register record (pending). Map it before 'active':
// a paused member is linked and open, so today it reads as "Active".

export interface PersonStatus {
	id: PersonStatusId;
	tone: Tone;
}

const STATUS_TONE: Record<PersonStatusId, Tone> = {
	active: 'success',
	'day-member': 'info',
	ended: 'neutral',
	'no-account': 'neutral',
	invited: 'info'
};

/**
 * The single status vocabulary of a People row. The secondary signals
 * (approximate dates, auto-linked, duplicate claim, merged) stay on the record
 * and are surfaced elsewhere (`getRecordBadges`).
 */
export function getPersonStatus(
	record: Pick<MembershipRecordSchema, 'valid_until' | 'kind' | 'has_account' | 'invite_status'>
): PersonStatus {
	let id: PersonStatusId;
	if (record.valid_until) id = 'ended';
	else if (record.kind === 'temporary') id = 'day-member';
	else if (record.has_account) id = 'active';
	else if (record.invite_status === 'invited') id = 'invited';
	else id = 'no-account';
	return { id, tone: STATUS_TONE[id] };
}
