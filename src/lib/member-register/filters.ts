import type {
	MembershipRecordKind,
	OrganizationadminmemberregisterListMemberRegisterFbd88DcfData
} from '$lib/api/generated/types.gen';
import { isCalendarDay } from './calendar-day';

export const REGISTER_PAGE_SIZE = 20;

export type OpenFilter = 'all' | 'open' | 'closed';
export type AccountFilter = 'all' | 'with' | 'without';

/** Filter state of the register list. Mirrors the URL query one-to-one. */
export interface RegisterFilters {
	kind: MembershipRecordKind | null;
	tierId: string | null;
	open: OpenFilter;
	account: AccountFilter;
	/** Calendar day `YYYY-MM-DD` (org timezone), or null. */
	activeOn: string | null;
	search: string;
	page: number;
}

export const DEFAULT_FILTERS: RegisterFilters = {
	kind: null,
	tierId: null,
	open: 'all',
	account: 'all',
	activeOn: null,
	search: '',
	page: 1
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KINDS: readonly MembershipRecordKind[] = ['standard', 'temporary'];

/** Read filters from a URL query. Unknown or malformed values fall back to the default. */
export function parseFilters(params: URLSearchParams): RegisterFilters {
	const kind = params.get('kind');
	const open = params.get('status');
	const account = params.get('account');
	const on = params.get('on');
	const tier = params.get('tier')?.trim() ?? '';
	const page = Number.parseInt(params.get('page') ?? '', 10);
	return {
		kind: (KINDS as readonly string[]).includes(kind ?? '') ? (kind as MembershipRecordKind) : null,
		tierId: UUID_RE.test(tier) ? tier : null,
		open: open === 'open' || open === 'closed' ? open : 'all',
		account: account === 'with' || account === 'without' ? account : 'all',
		activeOn: isCalendarDay(on) ? on : null,
		search: params.get('q')?.trim() ?? '',
		page: Number.isFinite(page) && page > 1 ? page : 1
	};
}

/** Serialise filters to a URL query (without the leading `?`); defaults are omitted. */
export function filtersToSearch(filters: RegisterFilters): string {
	const params = new URLSearchParams();
	if (filters.kind) params.set('kind', filters.kind);
	if (filters.tierId) params.set('tier', filters.tierId);
	if (filters.open !== 'all') params.set('status', filters.open);
	if (filters.account !== 'all') params.set('account', filters.account);
	if (filters.activeOn && isCalendarDay(filters.activeOn)) params.set('on', filters.activeOn);
	if (filters.search.trim()) params.set('q', filters.search.trim());
	if (filters.page > 1) params.set('page', String(filters.page));
	return params.toString();
}

/**
 * Query object for `GET /member-register`, derived from the generated
 * operation. `page`/`page_size` are always present; `active_on` is the raw day,
 * never a datetime.
 */
export type RegisterListQuery = NonNullable<
	OrganizationadminmemberregisterListMemberRegisterFbd88DcfData['query']
> &
	Required<
		Pick<
			NonNullable<OrganizationadminmemberregisterListMemberRegisterFbd88DcfData['query']>,
			'page' | 'page_size'
		>
	>;

export function filtersToQuery(filters: RegisterFilters): RegisterListQuery {
	const query: RegisterListQuery = { page: filters.page, page_size: REGISTER_PAGE_SIZE };
	if (filters.kind) query.kind = filters.kind;
	if (filters.tierId) query.tier_id = filters.tierId;
	if (filters.open !== 'all') query.is_open = filters.open === 'open';
	if (filters.account !== 'all') query.has_account = filters.account === 'with';
	if (filters.activeOn && isCalendarDay(filters.activeOn)) query.active_on = filters.activeOn;
	if (filters.search.trim()) query.search = filters.search.trim();
	return query;
}

/** Anything beyond the page number narrowing the list (drives filtered vs truly-empty copy). */
export function hasActiveFilters(filters: RegisterFilters): boolean {
	return (
		filters.kind !== null ||
		filters.tierId !== null ||
		filters.open !== 'all' ||
		filters.account !== 'all' ||
		filters.activeOn !== null ||
		filters.search.trim() !== ''
	);
}

/**
 * The page to move to when the current one is past the end (e.g. after the last
 * row of the last page was deleted, or a stale `?page=`): the last valid page.
 * Null when the current page is fine.
 */
export function pageToRedirect(resultCount: number, total: number, page: number): number | null {
	if (resultCount > 0 || total <= 0 || page <= 1) return null;
	return Math.max(1, Math.ceil(total / REGISTER_PAGE_SIZE));
}
