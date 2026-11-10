import type { QueryClient } from '@tanstack/svelte-query';
import {
	organizationadminmemberregisterCreateMemberRegisterRecord,
	organizationadminmemberregisterDeleteMemberRegisterRecord,
	organizationadminmemberregisterEndMemberRegisterRecord,
	organizationadminmemberregisterExportMemberRegister,
	organizationadminmemberregisterGetMemberRegisterRecord,
	organizationadminmemberregisterListMemberRegister,
	organizationadminmemberregisterUpdateMemberRegisterRecord,
	organizationadminmemberregisterlinkingInviteAllMemberRegister,
	organizationadminmemberregisterlinkingInviteMemberRegisterRecord,
	organizationadminmemberregisterlinkingListMembershipRequestRegisterMatches,
	organizationadminmemberregisterlinkingListPossibleDuplicates,
	organizationadminmemberregisterlinkingMergeMemberRegisterRecord,
	organizationadminmemberregisterlinkingUnlinkMemberRegisterRecord,
	organizationadminmembersAddMember,
	organizationadminuserlookupLookupUser
} from '$lib/api';
import type {
	MembershipRecordCreateSchema,
	MembershipRecordSchema,
	OrgUserLookupSchema,
	PaginatedResponseSchemaMembershipRecordSchema,
	PossibleDuplicateSchema,
	RegisterMatchSchema
} from '$lib/api/generated/types.gen';
import { backendMessage } from '$lib/utils/api-error-detail';
import { filtersToQuery, type RegisterFilters, type RegisterListQuery } from './filters';
import type { PeopleQuery } from './people-view';
import type { EndBody, RecordUpdateBody } from './form-values';

/**
 * Failure of a register call. Carries the HTTP status (the generated client's
 * `error` is only the body) so dialogs can tell a stale-state 409 from a
 * validation 400. `body` is the untouched `res.error`.
 *
 * `silent`: the dialogs render these inline, so the global mutation toast
 * ("Action failed") would be a duplicate.
 */
export class RegisterApiError extends Error {
	readonly status: number;
	readonly body: unknown;
	/** Seconds from the `Retry-After` header of a throttled (429) answer, when sent. */
	readonly retryAfterSeconds: number | null;
	readonly silent = true;

	constructor(status: number, body: unknown, retryAfterSeconds: number | null = null) {
		super(backendMessage(body) ?? `Member register request failed (${status})`);
		this.name = 'RegisterApiError';
		this.status = status;
		this.body = body;
		this.retryAfterSeconds = retryAfterSeconds;
	}
}

interface Settled {
	error?: unknown;
	response?: { status?: number; headers?: { get?: (name: string) => string | null } };
}

/** `Retry-After` in delta-seconds (what DRF sends); HTTP-date form is ignored. */
function retryAfterOf(res: Settled): number | null {
	const raw = res.response?.headers?.get?.('Retry-After');
	if (!raw || !/^\d+$/.test(raw.trim())) return null;
	const seconds = Number.parseInt(raw, 10);
	return seconds > 0 ? seconds : null;
}

function ensureOk(res: Settled): void {
	if (res.error) {
		throw new RegisterApiError(res.response?.status ?? 0, res.error, retryAfterOf(res));
	}
}

function authHeaders(accessToken: string | null | undefined): { Authorization: string } {
	// Fail clearly instead of sending `Bearer undefined` and surfacing a confusing 401.
	if (!accessToken) throw new Error('member-register: missing access token');
	return { Authorization: `Bearer ${accessToken}` };
}

export const memberRegisterKeys = {
	/** Prefix of everything register-related; invalidate after any write. */
	all: (slug: string) => ['organization', slug, 'member-register'] as const,
	/** `query` is whatever identifies the request: register filters or a People query. */
	list: (slug: string, query: RegisterFilters | PeopleQuery) =>
		['organization', slug, 'member-register', 'list', query] as const,
	/**
	 * Deliberately OUTSIDE the `all` prefix: the possible-duplicates scan is the
	 * expensive call, so an ordinary register write must not refetch it. Callers
	 * that can change the pairs (merge, unlink, approve-and-link) invalidate it
	 * explicitly via `invalidateRegister`.
	 */
	duplicates: (slug: string) => ['organization', slug, 'register-possible-duplicates'] as const,
	/** Unfiltered total; inside `all`, so every register write refreshes it. */
	total: (slug: string) => ['organization', slug, 'member-register', 'total'] as const,
	periods: (slug: string, userId: string) =>
		['organization', slug, 'member-register', 'periods', userId] as const,
	/** Entries absorbed into one (account-less) survivor. */
	mergedInto: (slug: string, recordId: string) =>
		['organization', slug, 'member-register', 'merged-into', recordId] as const,
	matches: (slug: string, requestId: string) =>
		['organization', slug, 'member-register', 'matches', requestId] as const
};

/**
 * Invalidate the possible-duplicates scan after a write that can change the
 * pairs (merge, unlink, approve-and-link). `refetchType: 'all'` also refreshes
 * the scan while the Duplicates tab is closed, which keeps the tab badge true.
 */
export function invalidateDuplicates(queryClient: QueryClient, slug: string): Promise<void> {
	return queryClient.invalidateQueries({
		queryKey: memberRegisterKeys.duplicates(slug),
		refetchType: 'all'
	});
}

/** Invalidate the register queries, plus the duplicates scan for pair-changing actions. */
export async function invalidateRegister(
	queryClient: QueryClient,
	slug: string,
	includeDuplicates: boolean
): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: memberRegisterKeys.all(slug) }),
		includeDuplicates ? invalidateDuplicates(queryClient, slug) : Promise.resolve()
	]);
}

async function fetchRegisterPage(
	slug: string,
	accessToken: string | null | undefined,
	query: RegisterListQuery
): Promise<PaginatedResponseSchemaMembershipRecordSchema> {
	const res = await organizationadminmemberregisterListMemberRegister({
		path: { slug },
		query,
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data;
}

export function listRegister(
	slug: string,
	accessToken: string | null | undefined,
	filters: RegisterFilters
): Promise<PaginatedResponseSchemaMembershipRecordSchema> {
	return fetchRegisterPage(slug, accessToken, filtersToQuery(filters));
}

/** The People list (the Ended chip is filtered by the backend's `ended` param). */
export function listPeople(
	slug: string,
	accessToken: string | null | undefined,
	query: PeopleQuery
): Promise<PaginatedResponseSchemaMembershipRecordSchema> {
	return fetchRegisterPage(slug, accessToken, query);
}

/**
 * Every period of one person: their own entries plus the ones merged into them
 * (`include_merged`). Keyed under `memberRegisterKeys.all`, so every register
 * write refreshes it.
 */
export const PERIODS_PAGE_SIZE = 100;
export function listPersonPeriods(
	slug: string,
	accessToken: string | null | undefined,
	userId: string
): Promise<PaginatedResponseSchemaMembershipRecordSchema> {
	return fetchRegisterPage(slug, accessToken, {
		user_id: userId,
		include_merged: true,
		page: 1,
		page_size: PERIODS_PAGE_SIZE
	});
}

/** The entries absorbed into one survivor (an account-less survivor has no `user_id` to ask by). */
export function listMergedInto(
	slug: string,
	accessToken: string | null | undefined,
	recordId: string
): Promise<PaginatedResponseSchemaMembershipRecordSchema> {
	return fetchRegisterPage(slug, accessToken, {
		merged_into: recordId,
		page: 1,
		page_size: PERIODS_PAGE_SIZE
	});
}

/** Total entries in the register, ignoring every filter (one-row page). */
export async function countRegister(
	slug: string,
	accessToken: string | null | undefined
): Promise<number> {
	const page = await fetchRegisterPage(slug, accessToken, { page: 1, page_size: 1 });
	return page.count;
}

export async function createRecord(
	slug: string,
	accessToken: string | null | undefined,
	body: MembershipRecordCreateSchema
): Promise<MembershipRecordSchema> {
	const res = await organizationadminmemberregisterCreateMemberRegisterRecord({
		path: { slug },
		body,
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data;
}

export async function updateRecord(
	slug: string,
	accessToken: string | null | undefined,
	recordId: string,
	body: RecordUpdateBody
): Promise<MembershipRecordSchema> {
	const res = await organizationadminmemberregisterUpdateMemberRegisterRecord({
		path: { slug, record_id: recordId },
		body,
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data;
}

export async function endRecord(
	slug: string,
	accessToken: string | null | undefined,
	recordId: string,
	body: EndBody
): Promise<MembershipRecordSchema> {
	const res = await organizationadminmemberregisterEndMemberRegisterRecord({
		path: { slug, record_id: recordId },
		body,
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data;
}

export async function deleteRecord(
	slug: string,
	accessToken: string | null | undefined,
	recordId: string
): Promise<void> {
	const res = await organizationadminmemberregisterDeleteMemberRegisterRecord({
		path: { slug, record_id: recordId },
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
}

/**
 * Start the xlsx export; resolves to the export id for the shared polling flow
 * (`ExportButton`). `activeOn` is the raw `YYYY-MM-DD` day (org timezone).
 */
export async function startRegisterExport(
	slug: string,
	accessToken: string | null | undefined,
	activeOn: string | null,
	includeMerged = false
): Promise<string> {
	const res = await organizationadminmemberregisterExportMemberRegister({
		path: { slug },
		body: {
			...(activeOn ? { active_on: activeOn } : {}),
			...(includeMerged ? { include_merged: true } : {})
		},
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	const id = res.data?.id;
	if (!id) throw new RegisterApiError(res.response?.status ?? 0, null);
	return id;
}

/** First send or resend of the claim link for one entry (a resend rotates the link). */
export async function inviteRecord(
	slug: string,
	accessToken: string | null | undefined,
	recordId: string
): Promise<MembershipRecordSchema> {
	const res = await organizationadminmemberregisterlinkingInviteMemberRegisterRecord({
		path: { slug, record_id: recordId },
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data;
}

/** Invite every open, unlinked, never-invited entry; resolves to how many were invited. */
export async function inviteAll(
	slug: string,
	accessToken: string | null | undefined
): Promise<number> {
	const res = await organizationadminmemberregisterlinkingInviteAllMemberRegister({
		path: { slug },
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data.invited;
}

export async function listPossibleDuplicates(
	slug: string,
	accessToken: string | null | undefined
): Promise<PossibleDuplicateSchema[]> {
	const res = await organizationadminmemberregisterlinkingListPossibleDuplicates({
		path: { slug },
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data;
}

/** Merge the account-less `absorbedId` entry into `survivorId`; resolves to the survivor. */
export async function mergeRecords(
	slug: string,
	accessToken: string | null | undefined,
	survivorId: string,
	absorbedId: string
): Promise<MembershipRecordSchema> {
	const res = await organizationadminmemberregisterlinkingMergeMemberRegisterRecord({
		path: { slug, record_id: survivorId },
		body: { absorbed_record_id: absorbedId },
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data;
}

/** Reverse a link or a merge. For an open linked entry this cancels the member's access. */
export async function unlinkRecord(
	slug: string,
	accessToken: string | null | undefined,
	recordId: string
): Promise<MembershipRecordSchema> {
	const res = await organizationadminmemberregisterlinkingUnlinkMemberRegisterRecord({
		path: { slug, record_id: recordId },
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data;
}

/** Unlinked open entries that may be the applicant of a membership request. */
export async function listRegisterMatches(
	slug: string,
	accessToken: string | null | undefined,
	requestId: string
): Promise<RegisterMatchSchema[]> {
	const res = await organizationadminmemberregisterlinkingListMembershipRequestRegisterMatches({
		path: { slug, request_id: requestId },
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data;
}

/** One register entry by id. */
export async function getRecord(
	slug: string,
	accessToken: string | null | undefined,
	recordId: string
): Promise<MembershipRecordSchema> {
	const res = await organizationadminmemberregisterGetMemberRegisterRecord({
		path: { slug, record_id: recordId },
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data;
}

/**
 * Find a verified account by its exact email (throttled: 429 + Retry-After).
 * `null` is the backend's single, deliberately uninformative `user_not_found`
 * answer; it is matched on its `code`, never its text.
 */
export async function lookupAccount(
	slug: string,
	accessToken: string | null | undefined,
	email: string
): Promise<OrgUserLookupSchema | null> {
	const res = await organizationadminuserlookupLookupUser({
		path: { slug },
		query: { email },
		headers: authHeaders(accessToken)
	});
	if (
		res.response?.status === 404 &&
		(res.error as { code?: unknown } | undefined)?.code === 'user_not_found'
	) {
		return null;
	}
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data;
}

/** Add an existing account to a STANDARD tier. A 400 may mean they already hold a membership row. */
export async function addMemberByAccount(
	slug: string,
	accessToken: string | null | undefined,
	userId: string,
	tierId: string
): Promise<void> {
	const res = await organizationadminmembersAddMember({
		path: { slug, user_id: userId },
		body: { tier_id: tierId },
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
}
