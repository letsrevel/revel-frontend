import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
import type { Tone } from '$lib/components/common/tones';
import {
	filtersToQuery,
	filtersToSearch,
	hasActiveFilters,
	parseFilters,
	type RegisterFilters,
	type RegisterListQuery
} from './filters';

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

/**
 * Chip -> URL filter state, so a chip round-trips through `?view=` / raw params.
 * What a chip SENDS to the backend is `chipToQuery`, not these fields ("Current"
 * is not `is_open`: it needs today's date).
 */
export const VIEW_FILTERS: Record<PeopleView, ViewFilters> = {
	current: { kind: 'standard', open: 'all', account: 'all' },
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
	return hasActiveFilters({ ...filters, ...VIEW_FILTERS.everyone });
}

/** Filters for a chip, keeping search / tier / day. Resets the page. */
export function filtersForView(view: PeopleView, current: RegisterFilters): RegisterFilters {
	return { ...current, ...VIEW_FILTERS[view], page: 1 };
}

/** The People list query: the register's list query (the Ended chip sends `ended`). */
export type PeopleQuery = RegisterListQuery;

type ChipQuery = Pick<RegisterListQuery, 'kind' | 'active_on' | 'has_account' | 'ended'>;

/**
 * THE chip -> query mapping (the only place a chip becomes backend params).
 * `today` is the calendar day in the ORGANIZATION's timezone.
 *
 * - Current: `active_on=<today>` + `kind=standard`. Not `is_open`: that is
 *   `valid_until IS NULL`, which misses a standard entry with a future end and
 *   would include nothing time-aware.
 * - Day members: `kind=temporary`. No account: `has_account=false`.
 * - Ended: `ended=true` (`valid_until <= now` or revoked; the backend decides).
 * - Everyone: nothing.
 */
export function chipToQuery(view: PeopleView, today: string): ChipQuery {
	switch (view) {
		case 'current':
			return { active_on: today, kind: 'standard' };
		case 'day':
			return { kind: 'temporary' };
		case 'ended':
			return { ended: true };
		case 'no-account':
			return { has_account: false };
		case 'everyone':
			return {};
	}
}

/**
 * Filters -> People list query. An "As of" day is a snapshot of everyone active
 * that day, so it drops EVERY chip filter (kind, account, open, ended). A
 * combination no chip covers (a legacy raw link) keeps its raw filters.
 */
export function peopleQuery(filters: RegisterFilters, today: string): PeopleQuery {
	const bare = filtersToQuery({ ...filters, ...VIEW_FILTERS.everyone });
	if (filters.activeOn) return bare;
	const view = viewFromFilters(filters);
	return view ? { ...bare, ...chipToQuery(view, today) } : filtersToQuery(filters);
}

/** One status per row. Precedence is the order of the checks in `getPersonStatus`. */
export type PersonStatusId =
	'active' | 'paused' | 'day-member' | 'ended' | 'upcoming' | 'no-account' | 'invited';

export interface PersonStatus {
	id: PersonStatusId;
	tone: Tone;
}

const STATUS_TONE: Record<PersonStatusId, Tone> = {
	active: 'success',
	paused: 'warning',
	'day-member': 'info',
	ended: 'neutral',
	upcoming: 'neutral',
	'no-account': 'neutral',
	invited: 'info'
};

/** The register fields the status mapping reads. */
export type PersonStatusInput = Pick<
	MembershipRecordSchema,
	'valid_from' | 'valid_until' | 'kind' | 'has_account' | 'invite_status'
> &
	Partial<Pick<MembershipRecordSchema, 'is_current' | 'member_status'>>;

/**
 * The single status vocabulary of a People row. The backend's `is_current`
 * (started, not ended, not revoked) and `member_status` (set only for linked,
 * open, standard entries) win; the date logic below is only the fallback for a
 * record that lacks `is_current`. "Open" (`valid_until` empty) is NOT "valid
 * now": a ticket-granted day membership always has an end, and a standard entry
 * can end in the future. The secondary signals (approximate dates, auto-linked,
 * duplicate claim, merged) stay on the record and are surfaced elsewhere
 * (`getRecordBadges`).
 */
export function getPersonStatus(record: PersonStatusInput, now: Date = new Date()): PersonStatus {
	const at = now.getTime();
	const notStarted = !!record.valid_from && Date.parse(record.valid_from) > at;
	let id: PersonStatusId;
	if (record.is_current === false) id = notStarted ? 'upcoming' : 'ended';
	else if (
		record.is_current === undefined &&
		record.valid_until &&
		Date.parse(record.valid_until) <= at
	)
		id = 'ended';
	else if (record.is_current === undefined && notStarted) id = 'upcoming';
	// An access row that was banned or cancelled has no live membership behind it,
	// whatever the entry's dates say.
	else if (record.member_status === 'banned' || record.member_status === 'cancelled') id = 'ended';
	else if (record.kind === 'temporary') id = 'day-member';
	else if (!record.has_account) id = record.invite_status === 'invited' ? 'invited' : 'no-account';
	else if (record.member_status === 'paused') id = 'paused';
	else id = 'active';
	return { id, tone: STATUS_TONE[id] };
}

/**
 * Whether the member actions (change tier, pause / resume, remove, ban) apply:
 * only a linked, current standard entry has a live access row behind it.
 */
export function canManageMember(
	record: PersonStatusInput & Pick<MembershipRecordSchema, 'user_id'>
): boolean {
	if (!record.user_id || record.kind !== 'standard') return false;
	const id = getPersonStatus(record).id;
	return id === 'active' || id === 'paused';
}
